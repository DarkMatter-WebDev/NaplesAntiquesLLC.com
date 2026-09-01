/**
 * Locate `phrase` inside `text` so a caller can wrap that one span in a link
 * while the surrounding copy stays ONE plain string.
 *
 * Why this exists (2026-09-01): `/faq` and `/trade-in` keep their copy as
 * plain strings because the same string also feeds FAQPage JSON-LD or a data
 * array. Hand-duplicating the sentence as JSX just to underline three words
 * would create a second copy that drifts from the first the next time someone
 * edits the answer. Splitting at render keeps a single source of truth — and
 * if the phrase is ever reworded out of the sentence, the link is dropped
 * rather than the copy forking.
 *
 * First occurrence only, case-sensitive, literal match (no regex).
 */
export function splitPhrase(
  text: string,
  phrase: string,
): { before: string; phrase: string; after: string } | null {
  if (!phrase) return null;
  const at = text.indexOf(phrase);
  if (at === -1) return null;
  return {
    before: text.slice(0, at),
    phrase,
    after: text.slice(at + phrase.length),
  };
}
