import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureFreshAccessToken } from './auth';
import {
  EtsyApiError,
  fetchTaxonomyProperties,
  getListingProperties,
  updateListingProperty,
  type EtsyListingPropertyValue,
  type EtsyTaxonomyProperty,
} from './client';
import { type EtsyListingRow } from './store';

// Wearable-length re-investigation (2026-07-08, session 7). Full incident:
// DECISIONS.md session 5 — a guessed `value_ids: [scale_id]` for the
// Bracelet length property returned HTTP 200 but Etsy silently resolved it
// against its own shared global value vocabulary and stored "Gray" (a
// color, from a wholly unrelated property) instead of rejecting the request.
//
// RESOLVED live 2026-07-08 (session 8): `value_ids: ['']` (an empty-string
// placeholder, never a guessed number) + a live-discovered scale_id succeeds
// — Etsy auto-generates and assigns its own real, shop-scoped value_id for
// the custom value under the hood. Read-back-verified correct (property
// name "Length", scale "Inches", value "7.75" — not a color or anything
// unrelated). See DECISIONS.md session 8 for the full trail, including a
// prior false alarm caused by a non-production Etsy endpoint used for
// read-back (fixed — see getListingProperties in client.ts).
//
// GENERALIZED beyond Bracelet (2026-07-08, session 9, owner request): the
// mechanism above never depended on Bracelet specifically — findLengthProperty
// dynamically scans whatever properties are fetched for the LISTING'S OWN
// taxonomy_id, so it already worked correctly for Necklace/Pendant/Charm
// (share Bracelet's exact property id), Earrings/Brooch (a distinct "Small
// jewelry length" property id), and Cufflinks/Watch/Coin/Bullion/Silverware
// (the generic Length property) without any code change — only sync.ts's
// gating condition and the admin UI's visibility check were Bracelet-only,
// and those were widened. Ring has no length-like concept for a buyer (Ring
// size instead — a completely different, enumerated property; see
// ring-size-experiment.ts).
//
// Hard rules this module follows (owner-specified):
//   1. No hardcoded property_id/scale_id/value_ids anywhere below — every id
//      is resolved live from fetchTaxonomyProperties for the listing's own
//      taxonomy_id, every single time.
//   2. Never derive a value_id from the length number or the scale_id.
//   3. Never touches Etsy's `item_length` (package/shipping dimension, not
//      the buyer-facing attribute) — not referenced anywhere here.
//   4. Never calls updateListingInventory — length is not a SKU/quantity/
//      price-affecting variation for a single, one-of-a-kind listing.
//   5. Uses updateListingProperty only, gated on the discovered property's
//      own supports_attributes flag.
//   6. Every write is followed by a live read-back; a mismatch is a FAILED
//      result, never a silently-accepted success.

export interface LengthPropertyMatch {
  propertyId: number;
  propertyName: string;
  inchesScaleId: number;
  possibleValues: { valueId: number; name: string }[];
}

/**
 * Finds the buyer-facing length attribute in a LIVE property list. Requires
 * supports_attributes (the flag that makes a property settable via
 * updateListingProperty — never updateListingInventory here, per rule 4).
 * Requires a real "Inches" scale in THIS property's OWN scales array; a
 * property with no Inches option is treated as unsupported rather than
 * converted from another unit or guessed at.
 *
 * A generic scanner, not category-specific — Ring's taxonomy also happens to
 * carry a generic "Length" property (id 506, meant for something like a
 * chain-style ring's total length, not what a buyer means by "ring size"),
 * so this function WOULD match it if called for Ring. Never calling it for
 * Ring (sync.ts only invokes this for length-bearing categories; Ring goes
 * through ring-size-experiment.ts instead) is what keeps that safe, not
 * anything inside this function.
 */
export function findLengthProperty(properties: EtsyTaxonomyProperty[]): LengthPropertyMatch | null {
  const candidate = properties.find(
    (property) => property.supportsAttributes && /length/i.test(property.name) && !/width|height|diameter/i.test(property.name),
  );
  if (!candidate) return null;

  const inches = candidate.scales.find((scale) => /^inch(es)?$/i.test(scale.displayName.trim()));
  if (!inches) return null;

  return {
    propertyId: candidate.propertyId,
    propertyName: candidate.displayName || candidate.name,
    inchesScaleId: inches.scaleId,
    possibleValues: candidate.possibleValues,
  };
}

export interface LengthPropertyPayload {
  propertyId: number;
  valueIds: (number | '')[];
  values: string[];
  scaleId: number;
}

/**
 * Builds the write payload for a target inches value. NEVER derives a
 * value_id from the length number or the scale_id — that is the exact "Gray"
 * bug (value_ids: [5] got resolved as an unrelated value, apparently a
 * color, from Etsy's shared global vocabulary). If a possible_values entry
 * genuinely names the target value (a few reasonable formats), its real
 * value_id is used.
 *
 * Otherwise, value_ids is `['']` — a single empty-string placeholder, NOT a
 * guessed number and NOT a bare empty array. **Confirmed live 2026-07-08
 * (session 8) as the correct, working mechanism**: a truly empty array
 * (zero `value_ids` keys once serialized as repeated form fields) is
 * rejected outright ("Missing input parameter: [value_ids]"), but `['']`
 * (one key, empty value) succeeds — Etsy auto-generates and assigns its own
 * real, shop-scoped value_id for the custom value under the hood (confirmed
 * via read-back: Etsy returned a real generated id, e.g. 52788369096, for
 * "7.75 Inches", not something we ever supplied). This is never a guess —
 * we never choose or derive that id ourselves, Etsy does.
 */
export function buildLengthPropertyPayload(match: LengthPropertyMatch, inches: number): LengthPropertyPayload {
  const target = String(inches).trim().toLowerCase();
  const acceptableNames = new Set([target, `${target} inches`, `${target} inch`, `${target} in`, `${target}in`, `${target}"`]);
  const matchedValue = match.possibleValues.find((value) => acceptableNames.has(value.name.trim().toLowerCase()));

  return {
    propertyId: match.propertyId,
    valueIds: matchedValue ? [matchedValue.valueId] : [''],
    values: [String(inches)],
    scaleId: match.inchesScaleId,
  };
}

export interface LengthVerification {
  ok: boolean;
  reason?: string;
}

/**
 * Compares Etsy's read-back against what was intended. Fails closed:
 * anything ambiguous (wrong property name, wrong scale, unparsable or
 * mismatched value) is a mismatch, never assumed fine. This is the actual
 * proof of correctness — a 200 from updateListingProperty is not (the "Gray"
 * incident returned 200).
 */
export function verifyLengthReadback(readback: EtsyListingPropertyValue, expectedInches: number): LengthVerification {
  if (readback.propertyName && !/length/i.test(readback.propertyName)) {
    return { ok: false, reason: `Etsy returned property name "${readback.propertyName}", not a length property.` };
  }
  if (readback.scaleName && !/^inch(es)?$/i.test(readback.scaleName.trim())) {
    return { ok: false, reason: `Etsy returned scale "${readback.scaleName}", not Inches.` };
  }
  if (readback.values.length === 0) {
    return { ok: false, reason: 'Etsy returned no value for this property.' };
  }
  const parsed = Number.parseFloat(readback.values[0]);
  if (!Number.isFinite(parsed) || Math.abs(parsed - expectedInches) > 0.01) {
    return { ok: false, reason: `Etsy stored "${readback.values.join(', ')}" — expected ${expectedInches}.` };
  }
  return { ok: true };
}

/** A bare decimal, optionally with an inch unit — same acceptance pattern as ai-product-schema.ts's cleanLength. A ring size, a range, or free text never matches. */
export function parseWearableLengthInches(length: string | null | undefined): number | null {
  const trimmed = length?.trim() ?? '';
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(?:in(?:ch(?:es?)?)?\.?|")?$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 && Number.isFinite(value) ? value : null;
}

export interface LengthExperimentResult {
  attempted: boolean;
  success: boolean;
  message: string;
  detail?: {
    propertyId: number;
    scaleId: number;
    valueIds: (number | '')[];
    values: string[];
    readback: EtsyListingPropertyValue;
  };
}

/**
 * Core write-then-verify cycle, called from the regular sync pipeline
 * (sync.ts, ON by default unless ETSY_SYNC_BRACELET_LENGTH=false — the flag
 * name predates the session-9 generalization to the rest of the
 * length-bearing category family, but keeps it to avoid an unnecessary
 * Netlify env var rename for owners who already set it). The dry-run preview
 * shows the length that WILL be pushed (via parseWearableLengthInches below);
 * this function does the actual discover→write→read-back→verify at sync time.
 * A mismatch or write failure returns success:false so the caller surfaces a
 * warning — it never silently trusts Etsy's HTTP 200. Was originally also
 * reachable from a manual admin "Test Length" button (removed session 9,
 * ninth addendum, once length auto-synced and the preview replaced it).
 */
export async function attemptLengthSync(params: {
  service: SupabaseClient;
  listing: EtsyListingRow;
  inches: number;
}): Promise<LengthExperimentResult> {
  const listingId = params.listing.etsy_listing_id;
  if (!listingId) {
    return { attempted: false, success: false, message: 'This product has no linked Etsy listing yet — sync it first.' };
  }
  const taxonomyId = params.listing.taxonomy_override_id ?? params.listing.taxonomy_id;
  if (!taxonomyId) {
    return { attempted: false, success: false, message: 'No taxonomy id recorded for this listing yet — sync it first.' };
  }

  const { accessToken, shopId } = await ensureFreshAccessToken(params.service);
  const properties = await fetchTaxonomyProperties(taxonomyId);
  const match = findLengthProperty(properties);
  if (!match) {
    return {
      attempted: false,
      success: false,
      message: `No buyer-facing length attribute found on this category's live property list (taxonomy ${taxonomyId}) — length stays unsupported for this product type.`,
    };
  }

  const payload = buildLengthPropertyPayload(match, params.inches);

  // Write and read-back are deliberately separate try/catches — a failure
  // here must say WHICH phase broke. A write failure leaves the listing
  // untouched (safe, known state). A read-back failure is different and
  // more serious: the write may have gone through and we simply can't
  // currently confirm it — never collapse the two into one generic message
  // (session 8 hit exactly this ambiguity when the write may have quietly
  // succeeded while the old, broken single-property GET 404'd).
  try {
    await updateListingProperty({
      shopId,
      listingId,
      accessToken,
      propertyId: payload.propertyId,
      valueIds: payload.valueIds,
      values: payload.values,
      scaleId: payload.scaleId,
    });
  } catch (err) {
    const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Write failed.';
    return { attempted: true, success: false, message: `Write failed — nothing was changed on Etsy. ${message}` };
  }

  // Never trust the write above — read every property back and find ours.
  let allProperties: EtsyListingPropertyValue[];
  try {
    allProperties = await getListingProperties({ shopId, listingId, accessToken });
  } catch (err) {
    const message = err instanceof EtsyApiError ? err.operatorMessage : err instanceof Error ? err.message : 'Read-back failed.';
    return {
      attempted: true,
      success: false,
      message: `Etsy accepted the write, but reading it back to verify failed — this is NOT the same as a confirmed success. Do not assume Etsy stored the right value. ${message}`,
    };
  }

  const readback = allProperties.find((property) => property.propertyId === payload.propertyId) ?? {
    propertyId: payload.propertyId,
    propertyName: null,
    scaleId: null,
    scaleName: null,
    valueIds: [],
    values: [],
  };
  const verification = verifyLengthReadback(readback, params.inches);

  return {
    attempted: true,
    success: verification.ok,
    message: verification.ok
      ? `Verified — Etsy's "${match.propertyName}" property now reads ${readback.values.join(', ')} ${readback.scaleName ?? ''}`.trim() + '.'
      : `Etsy returned success for the write, but the read-back did not match — treating this as FAILED. Do not trust what Etsy now shows for this property. ${verification.reason}`,
    detail: { propertyId: payload.propertyId, scaleId: payload.scaleId, valueIds: payload.valueIds, values: payload.values, readback },
  };
}

