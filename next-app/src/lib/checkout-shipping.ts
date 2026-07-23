export const CHECKOUT_SHIPPING_OPTIONS = [
  {
    value: 'local-pickup',
    labelEn: 'Local Pickup',
    labelEs: 'Recogida local',
    price: 0,
  },
  {
    value: 'express-overnight-insured',
    labelEn: 'Express Overnight Insured',
    labelEs: 'Express nocturno asegurado',
    price: 75,
  },
  {
    value: 'priority-insured',
    labelEn: 'Priority Insured',
    labelEs: 'Prioritario asegurado',
    price: 45,
  },
] as const;

export type CheckoutShippingMethod = (typeof CHECKOUT_SHIPPING_OPTIONS)[number]['value'];

export const DEFAULT_SHIPPING_METHOD: CheckoutShippingMethod = 'priority-insured';

export function isCheckoutShippingMethod(value: string): value is CheckoutShippingMethod {
  return CHECKOUT_SHIPPING_OPTIONS.some((option) => option.value === value);
}

export function getCheckoutShippingOption(value: string) {
  return CHECKOUT_SHIPPING_OPTIONS.find((option) => option.value === value) ?? null;
}

export function getCheckoutShippingFee(value: string): number | null {
  return getCheckoutShippingOption(value)?.price ?? null;
}

export function shippingMethodForDb(value: CheckoutShippingMethod): 'pickup' | 'shipping' {
  return value === 'local-pickup' ? 'pickup' : 'shipping';
}
