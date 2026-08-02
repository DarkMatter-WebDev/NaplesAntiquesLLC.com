// Value-based shipping catalog (2026-07-30). The single source of truth for
// checkout shipping methods, tier fees, and availability — UI labels and
// estimates, the server fee lookup and whitelist, and database fulfillment
// mapping all consume this module. Fees are keyed to the order's merchandise
// subtotal: every band charges above its worst-case postage + USPS carrier
// insurance cost (ShipStation commercial rates from ZIP 34116) so the store
// never pays shipping out of pocket. Full rationale and the cost math:
// project-docs/features/shipping-tiers-plan.md.

export const CHECKOUT_SHIPPING_OPTIONS = [
  {
    value: 'local-pickup',
    labelEn: 'Local Pickup',
    labelEs: 'Recogida local',
  },
  {
    value: 'express-overnight-insured',
    labelEn: 'Express Overnight Insured',
    labelEs: 'Express nocturno asegurado',
  },
  {
    value: 'priority-insured',
    labelEn: 'Insured Shipping',
    labelEs: 'Envío asegurado',
  },
] as const;

export type CheckoutShippingMethod = (typeof CHECKOUT_SHIPPING_OPTIONS)[number]['value'];

export const DEFAULT_SHIPPING_METHOD: CheckoutShippingMethod = 'priority-insured';

export type ShippingTier = {
  /** Inclusive lower bound of the merchandise subtotal. */
  min: number;
  /** Exclusive upper bound; null = open-ended top tier. */
  max: number | null;
  fee: number;
};

// Standard Insured: USPS Priority Mail (small flat-rate box, USPS carrier
// insurance, signature) below $5,000; USPS Registered Mail (plain box sealed
// with kraft paper tape, insured to $50,000, 2-10 business days) at $5,000+
// because USPS Priority/Express insurance is capped at $5,000. The $5,000 and
// $2,500 bands intentionally share a $99 fee — Registered insurance is cheaper
// than Priority insurance, so no buyer-visible price inversion exists.
export const STANDARD_SHIPPING_TIERS: readonly ShippingTier[] = [
  { min: 0, max: 100, fee: 19 },
  { min: 100, max: 250, fee: 25 },
  { min: 250, max: 600, fee: 29 },
  { min: 600, max: 1000, fee: 35 },
  { min: 1000, max: 2500, fee: 59 },
  { min: 2500, max: 5000, fee: 99 },
  { min: 5000, max: 15000, fee: 99 },
  { min: 15000, max: null, fee: 165 },
];

// Express Overnight Insured: USPS Priority Mail Express in the padded
// flat-rate envelope (thin box inside). Not offered at $5,000+ — the USPS
// insurance cap makes those shipments uninsurable overnight, and an
// uninsurable method must be rejected, never silently substituted.
export const EXPRESS_SHIPPING_TIERS: readonly ShippingTier[] = [
  { min: 0, max: 1000, fee: 55 },
  { min: 1000, max: 2500, fee: 79 },
  { min: 2500, max: 5000, fee: 119 },
];

/** Exclusive ceiling above which Express is unavailable (USPS insurance cap). */
export const EXPRESS_SHIPPING_MAX_SUBTOTAL = 5000;

/** Standard shipments at/above this subtotal travel USPS Registered Mail. */
export const REGISTERED_MAIL_MIN_SUBTOTAL = 5000;

function tierFee(tiers: readonly ShippingTier[], merchandiseSubtotal: number): number | null {
  if (!Number.isFinite(merchandiseSubtotal) || merchandiseSubtotal < 0) return null;
  const tier = tiers.find(
    (candidate) => merchandiseSubtotal >= candidate.min
      && (candidate.max === null || merchandiseSubtotal < candidate.max),
  );
  return tier ? tier.fee : null;
}

export function isCheckoutShippingMethod(value: string): value is CheckoutShippingMethod {
  return CHECKOUT_SHIPPING_OPTIONS.some((option) => option.value === value);
}

export function getCheckoutShippingOption(value: string) {
  return CHECKOUT_SHIPPING_OPTIONS.find((option) => option.value === value) ?? null;
}

/**
 * Tier fee for a method at a given merchandise subtotal. Returns null for an
 * unknown method OR a method that is not offered at that subtotal (Express at
 * $5,000+), so callers reject instead of falling back to free shipping.
 */
export function getCheckoutShippingFee(value: string, merchandiseSubtotal: number): number | null {
  if (!isCheckoutShippingMethod(value)) return null;
  if (value === 'local-pickup') {
    return Number.isFinite(merchandiseSubtotal) && merchandiseSubtotal >= 0 ? 0 : null;
  }
  if (value === 'express-overnight-insured') {
    return tierFee(EXPRESS_SHIPPING_TIERS, merchandiseSubtotal);
  }
  return tierFee(STANDARD_SHIPPING_TIERS, merchandiseSubtotal);
}

/** Whether a method may be offered/accepted at this merchandise subtotal. */
export function isShippingMethodAvailable(value: string, merchandiseSubtotal: number): boolean {
  return getCheckoutShippingFee(value, merchandiseSubtotal) !== null;
}

/** Standard shipments at $5,000+ switch from Priority to Registered Mail. */
export function usesRegisteredMail(method: string, merchandiseSubtotal: number): boolean {
  return method === 'priority-insured' && merchandiseSubtotal >= REGISTERED_MAIL_MIN_SUBTOTAL;
}

/**
 * Buyer-facing delivery note for the selected method at this subtotal, or null
 * when no special wording applies. Registered Mail is slower than Priority and
 * that must be stated honestly wherever the method is shown.
 */
export function getShippingServiceNote(
  method: string,
  merchandiseSubtotal: number,
  isEs: boolean,
): string | null {
  if (usesRegisteredMail(method, merchandiseSubtotal)) {
    return isEs
      ? 'Totalmente asegurado por USPS Registered Mail con cadena de custodia. Entrega en 2 a 10 días hábiles.'
      : 'Fully insured via USPS Registered Mail with chain-of-custody handling. Allow 2-10 business days for delivery.';
  }
  return null;
}

export function shippingMethodForDb(value: CheckoutShippingMethod): 'pickup' | 'shipping' {
  return value === 'local-pickup' ? 'pickup' : 'shipping';
}

// ---------------------------------------------------------------------------
// Marketplace scaffolding — NOT wired yet. The next planned update extends
// these tiers to Etsy/eBay listings: marketplace listings quote shipping per
// single item at listing time (no cart), so one unit of the item's price maps
// to the Standard tier fee. Etsy shipping profiles and eBay fulfillment
// policies should be generated from this function so the site and the
// marketplaces can never drift apart. See
// project-docs/features/shipping-tiers-plan.md (Phase 2 / marketplace sync).
// ---------------------------------------------------------------------------

/**
 * Standard-tier shipping fee for a single marketplace listing priced at
 * `itemPrice`. Null when the price is missing/invalid — a listing without a
 * usable price must not receive a guessed shipping fee.
 */
export function getMarketplaceStandardShippingFee(itemPrice: number): number | null {
  if (!Number.isFinite(itemPrice) || itemPrice <= 0) return null;
  return tierFee(STANDARD_SHIPPING_TIERS, itemPrice);
}

/** USPS Priority transit for insured standard shipments below the Registered threshold. */
const PRIORITY_DELIVERY_DAYS = { min: 1, max: 5 } as const;
/** Registered Mail is slower; the site promises 2-10 business days (see getShippingServiceNote). */
const REGISTERED_DELIVERY_DAYS = { min: 2, max: 10 } as const;

export type MarketplaceShippingTier = {
  /** Stable identity used to key provisioned marketplace shipping objects. */
  key: string;
  fee: number;
  /**
   * Buyer-facing transit estimate in business days. Etsy REQUIRES either this
   * pair or a carrier + mail class on every shipping-profile destination
   * (it rejects the create with "You must provide either a carrier and mail
   * class or min/max delivery days" otherwise), and eBay quotes the same
   * window. Carrier-agnostic days are used so no marketplace-specific carrier
   * id has to be looked up or kept in sync.
   */
  minDeliveryDays: number;
  maxDeliveryDays: number;
};

/**
 * The distinct standard fees, ascending — one Etsy shipping profile / eBay
 * fulfillment policy exists per DISTINCT fee (the $2,500 and $5,000 bands
 * intentionally share $99, so they share one marketplace object too).
 */
export const MARKETPLACE_SHIPPING_TIERS: readonly MarketplaceShippingTier[] = Array.from(
  new Set(STANDARD_SHIPPING_TIERS.map((tier) => tier.fee)),
).sort((a, b) => a - b).map((fee) => {
  // One profile per DISTINCT fee, so a fee covering any band at/above the
  // Registered threshold must quote the slower Registered window: the $99 fee
  // spans both a Priority band ($2,500-$5,000) and a Registered band
  // ($5,000-$15,000), and the shared object must not over-promise on the
  // slower one.
  const travelsRegistered = STANDARD_SHIPPING_TIERS.some(
    (tier) => tier.fee === fee && tier.min >= REGISTERED_MAIL_MIN_SUBTOTAL,
  );
  const days = travelsRegistered ? REGISTERED_DELIVERY_DAYS : PRIORITY_DELIVERY_DAYS;
  return { key: `fee-${fee}`, fee, minDeliveryDays: days.min, maxDeliveryDays: days.max };
});

/**
 * The marketplace shipping tier for one listing priced at `itemPrice`, or
 * null when the price is unusable. The key is the durable join between the
 * site's tier table and the provisioned per-marketplace shipping objects in
 * `marketplace_shipping_profiles`.
 */
export function getMarketplaceShippingTier(itemPrice: number): MarketplaceShippingTier | null {
  const fee = getMarketplaceStandardShippingFee(itemPrice);
  if (fee === null) return null;
  return MARKETPLACE_SHIPPING_TIERS.find((tier) => tier.fee === fee) ?? null;
}
