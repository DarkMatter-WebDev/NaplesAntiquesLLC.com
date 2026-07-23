export const US_STATES = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'],
] as const;

const stateCodeByName = new Map(
  US_STATES.map(([code, name]) => [name.toLowerCase(), code]),
);
const stateCodes = new Set(US_STATES.map(([code]) => code));

export function normalizeUsState(value: unknown): string | null {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');
  if (!normalized) return null;

  const code = normalized.toUpperCase();
  if (stateCodes.has(code as (typeof US_STATES)[number][0])) return code;
  return stateCodeByName.get(normalized.toLowerCase()) ?? null;
}

export function normalizeUsZip(value: unknown): string | null {
  const compact = String(value ?? '').trim().replace(/\s+/g, '');
  const match = /^(\d{5})(?:-?(\d{4}))?$/.exec(compact);
  if (!match) return null;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

export function isUnitedStatesCountry(value: unknown): boolean {
  return /^(us|usa|united states|united states of america)$/i.test(String(value ?? '').trim());
}

export type NormalizedUsShippingAddress = {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: 'United States';
  countryCode: 'US';
};

export type UsShippingAddressValidation =
  | { address: NormalizedUsShippingAddress; error?: never }
  | { address?: never; error: string };

export function validateUsShippingAddress(input: {
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
}): UsShippingAddressValidation {
  const line1 = String(input.line1 ?? '').trim();
  const line2 = String(input.line2 ?? '').trim() || null;
  const city = String(input.city ?? '').trim();

  if (!line1 || !city || !String(input.state ?? '').trim() || !String(input.postalCode ?? '').trim()) {
    return {
      error: 'A complete shipping address (street, city, state, and ZIP) is required for the selected delivery method.',
    };
  }
  if (!isUnitedStatesCountry(input.country)) {
    return { error: 'Shipping is currently available only to addresses in the United States.' };
  }

  const state = normalizeUsState(input.state);
  if (!state) {
    return { error: 'Select a valid U.S. state.' };
  }

  const postalCode = normalizeUsZip(input.postalCode);
  if (!postalCode) {
    return { error: 'Enter a valid U.S. ZIP code (12345 or 12345-6789).' };
  }

  return {
    address: {
      line1,
      line2,
      city,
      state,
      postalCode,
      country: 'United States',
      countryCode: 'US',
    },
  };
}
