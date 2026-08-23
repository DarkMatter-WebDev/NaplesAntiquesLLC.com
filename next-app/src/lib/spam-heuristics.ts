/**
 * Public-form spam heuristics.
 *
 * WHY THIS EXISTS — the inquiry form was being used as an EMAIL RELAY
 * ------------------------------------------------------------------
 * From 2026-08-22T00:25Z a bot submitted the product-inquiry form roughly
 * hourly — 10 submissions in 18 hours. The damage was not the junk in the admin
 * inbox: `/api/inquire` sends a confirmation to whatever address is typed in, so
 * each submission made Resend deliver mail **to a stranger** from
 * `noreply@naplesestatejewelry.com`. One victim address was hit twice.
 *
 * ⛔ That is a sending-reputation problem, not a tidiness problem. The `.com`
 * domain is the ONLY verified Resend sender, so complaints against it also
 * threaten order receipts and marketing.
 *
 * The route already had a `bot-field` honeypot on both paths, but
 * `InquiryForm.tsx` never rendered one — so on the product-inquiry form there
 * was nothing for a bot to fall into. That gap is fixed separately; this module
 * is the layer that still works when a bot posts JSON directly and never sees
 * the form at all.
 *
 * ⚠️ Heuristics, not proof. Everything here must fail OPEN toward the human:
 * a missed bot is spam, a false positive is a lost customer.
 */

/**
 * Count case flips between adjacent letters. Real names have very few; random
 * identifier strings have many.
 *
 * MEASURED separation, not a guess (2026-08-22, against the 10 real spam rows
 * and a list of the most transition-heavy real surnames):
 *
 *   humans  1, 3, 3, 3, 3, 3, 3, 3, 3, 5, 5      <- max 5
 *   spam    7, 8, 8, 10, 10, 11, 12, 12, 13, 13  <- min 7
 *
 * Worked examples:
 *   "Konstantinos"           -> 1
 *   "O'Brien"                -> 1   (the apostrophe breaks the run, not a flip)
 *   "McLaughlin"             -> 3
 *   "MacPherson"             -> 3
 *   "DeLaCruz"               -> 5   ← highest human score found
 *   "VanDerBeek"             -> 5   ← and it is 10 chars, so length cannot save it
 *   "xujmxSZGvFfhHrqUCPXJ"   -> 7   ← lowest real spam score
 *   "eaGqGQKfZrTtwwmRJTEobY" -> 13
 */
export function countCaseTransitions(value: string): number {
  let transitions = 0;
  for (let i = 1; i < value.length; i += 1) {
    const prev = value[i - 1];
    const curr = value[i];
    if (!/[A-Za-z]/.test(prev) || !/[A-Za-z]/.test(curr)) continue;
    if ((prev === prev.toUpperCase()) !== (curr === curr.toUpperCase())) transitions += 1;
  }
  return transitions;
}

/**
 * Minimum case flips before a single-token name is treated as machine-generated.
 *
 * ⛔ 6, and the value is measured rather than chosen. The real separation is
 * human-max 5 / spam-min 7, so 6 is the only value with clearance on BOTH sides.
 *
 * ⚠️ 4 was the first attempt and it was WRONG: "VanDerBeek" scores 5 at ten
 * characters, so the length gate does not save it and a real customer typing
 * only their surname would have been silently discarded. Anything below 6
 * reintroduces that. Above 7 starts missing real spam
 * ("xujmxSZGvFfhHrqUCPXJ" scores exactly 7).
 */
const MIN_CASE_TRANSITIONS = 6;

/** Below this length, a mixed-case token is far more likely to be a real name. */
const MIN_RANDOM_NAME_LENGTH = 10;

/**
 * A single run-together token, long, with repeated case flips — the shape of a
 * generated identifier and not of a person's name.
 *
 * The space check carries most of the safety: a human filling in a name field
 * overwhelmingly types more than one word, and this only ever looks at a lone
 * token.
 */
export function looksLikeRandomToken(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < MIN_RANDOM_NAME_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;
  if (!/^[A-Za-z]+$/.test(trimmed)) return false;
  return countCaseTransitions(trimmed) >= MIN_CASE_TRANSITIONS;
}

export interface SpamCheckInput {
  name?: string | null;
  honeypot?: string | null;
}

export interface SpamVerdict {
  isSpam: boolean;
  /** Short, stable slugs — these get logged, so keep them greppable. */
  reasons: string[];
}

/**
 * Decide whether a public form submission should be silently dropped.
 *
 * Silent on purpose: the caller returns a normal success response. A bot that
 * receives an error learns the shape of the filter and adapts; one that receives
 * "thanks" keeps posting into a void.
 */
export function checkSubmissionForSpam(input: SpamCheckInput): SpamVerdict {
  const reasons: string[] = [];

  // Classic honeypot: a field no human can see, so any value is a bot.
  if (String(input.honeypot ?? '').trim()) reasons.push('honeypot');

  if (looksLikeRandomToken(String(input.name ?? ''))) reasons.push('random-name');

  return { isSpam: reasons.length > 0, reasons };
}
