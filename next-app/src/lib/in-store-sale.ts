// Admin → In-Store Sale: the owner's form → a validated sale (pure, testable).
//
// Why (2026-09-16): a sale made in the showroom used to mean "create the item,
// then run checkout" — minutes of typing while the customer waits. The card is
// taken on PayPal Zettle (card-present: cheaper, chip/tap fraud protection);
// this page only RECORDS the sale: one order row like a web sale, the item
// marked sold, the receipt emailed. The money never touches the site.
//
// Two item modes:
// - a LISTED item (an inventory number / title match): the product's row is
//   sold through the same `capture_paypal_order` path a web sale uses, so its
//   eBay/Etsy listings end and Deep Field mirrors the flip exactly as today;
// - NOT LISTED (never on the site): the order line carries the description and
//   price with no product row at all. No hidden product is created — nothing
//   can leak into the shop, the feed or the marketplaces, and there is no fake
//   inventory number to explain later.
import { calculateFlSalesTax, round2 } from '@/lib/checkout-pricing';
import { normalizePersonName } from '@/lib/person-name';
import { normalizePhoneNumber } from '@/lib/phone';

export const IN_STORE_PAYMENT_METHODS = ['zettle', 'cash', 'zelle', 'check'] as const;
export type InStorePaymentMethod = (typeof IN_STORE_PAYMENT_METHODS)[number];

export const IN_STORE_PAYMENT_LABELS: Record<InStorePaymentMethod, string> = {
  zettle: 'Card · Zettle',
  cash: 'Cash',
  zelle: 'Zelle',
  check: 'Check',
};

/** orders.payment_method value for an in-store sale, e.g. `in_store_zettle`. */
export function inStorePaymentMethodValue(method: InStorePaymentMethod): string {
  return `in_store_${method}`;
}

/** Human label for ANY orders.payment_method value (PayPal, manual, in-store). */
export function paymentMethodLabel(value: string | null | undefined): string {
  if (!value) return '-';
  if (value === 'paypal') return 'PayPal';
  if (value === 'manual') return 'Manual';
  const inStore = value.match(/^in_store_(\w+)$/);
  if (inStore) {
    const method = inStore[1] as InStorePaymentMethod;
    return `In store · ${IN_STORE_PAYMENT_LABELS[method] ?? method}`;
  }
  return value;
}

export const IN_STORE_METALS = ['Gold', 'Silver', 'Other'] as const;
export type InStoreMetal = (typeof IN_STORE_METALS)[number];

export const IN_STORE_TITLE_MAX = 120;
export const IN_STORE_NOTE_MAX = 300;
export const IN_STORE_PRICE_MAX = 250_000;

export type InStoreListedItem = { kind: 'listed'; productId: string; price: number };
export type InStoreUnlistedItem = {
  kind: 'unlisted';
  title: string;
  metal: InStoreMetal;
  price: number;
  gramWeight: number | null;
  purity: string | null;
};

export type InStoreSaleInput = {
  item: InStoreListedItem | InStoreUnlistedItem;
  customer: { name: string; phone: string; email: string | null };
  paidBy: InStorePaymentMethod;
  note: string | null;
  subtotal: number;
  tax: number;
  total: number;
};

/** "$1,460", "1460.50", " 1,460 " → 1460 / 1460.5; anything else → null. */
export function parseInStorePrice(raw: unknown): number | null {
  const text = String(raw ?? '').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > IN_STORE_PRICE_MAX) return null;
  return round2(value);
}

/** The totals the form shows and the route records — one function for both. */
export function inStoreTotals(price: number): { subtotal: number; tax: number; total: number } {
  const subtotal = round2(price);
  // Every in-store sale is in Florida: the same rule local pickup uses online.
  const tax = calculateFlSalesTax(subtotal, 0);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

function optionalText(value: unknown, max: number): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

export function normalizeInStoreSaleInput(body: unknown): { value: InStoreSaleInput } | { error: string } {
  const source = (body ?? {}) as Record<string, unknown>;
  const itemSource = (source.item ?? {}) as Record<string, unknown>;
  const customerSource = (source.customer ?? {}) as Record<string, unknown>;

  const price = parseInStorePrice(itemSource.price);
  if (price == null) return { error: 'Enter the price sold, e.g. 1460.' };

  let item: InStoreSaleInput['item'];
  if (itemSource.kind === 'listed') {
    const productId = String(itemSource.productId ?? '').trim();
    if (!productId) return { error: 'Pick the listed item.' };
    item = { kind: 'listed', productId, price };
  } else if (itemSource.kind === 'unlisted') {
    const title = String(itemSource.title ?? '').replace(/\s+/g, ' ').trim();
    if (!title) return { error: 'Describe what sold, e.g. "14K rope chain · 22 in · 18.4 g".' };
    if (title.length > IN_STORE_TITLE_MAX) return { error: `Keep the item under ${IN_STORE_TITLE_MAX} characters.` };
    const metal = String(itemSource.metal ?? 'Other') as InStoreMetal;
    if (!IN_STORE_METALS.includes(metal)) return { error: 'Pick Gold, Silver or Other.' };
    const weightText = String(itemSource.gramWeight ?? '').trim();
    let gramWeight: number | null = null;
    if (weightText) {
      const weight = Number(weightText);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 100_000) return { error: 'Weight must be a number of grams.' };
      gramWeight = round2(weight);
    }
    item = { kind: 'unlisted', title, metal, price, gramWeight, purity: optionalText(itemSource.purity, 20) };
  } else {
    return { error: 'Choose a listed item or describe an unlisted one.' };
  }

  const name = normalizePersonName(`${String(customerSource.firstName ?? '')} ${String(customerSource.lastName ?? '')}`);
  if (!name) return { error: "Enter the customer's first and last name." };
  const phone = normalizePhoneNumber(String(customerSource.phone ?? ''));
  if (!phone) return { error: 'Enter a valid cell number.' };
  const emailText = String(customerSource.email ?? '').trim();
  if (emailText && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailText)) return { error: 'That email does not look right (leave it blank for no receipt).' };

  const paidBy = String(source.paidBy ?? '') as InStorePaymentMethod;
  if (!IN_STORE_PAYMENT_METHODS.includes(paidBy)) return { error: 'Pick how it was paid.' };

  const totals = inStoreTotals(price);
  return {
    value: {
      item,
      customer: { name, phone, email: emailText ? emailText.toLowerCase() : null },
      paidBy,
      note: optionalText(source.note, IN_STORE_NOTE_MAX),
      ...totals,
    },
  };
}
