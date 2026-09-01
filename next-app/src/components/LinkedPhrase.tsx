import Link from 'next/link';
import { splitPhrase } from '@/lib/link-phrase';

type Props = {
  /** The full sentence, kept as a single string by the caller. */
  text: string;
  /** The exact span inside `text` to turn into the link. */
  phrase: string;
  href: string;
  className?: string;
};

/**
 * Renders `text` with the first occurrence of `phrase` wrapped in a <Link>.
 * Falls back to the plain text when the phrase is not present, so a copy edit
 * can never break the page — it only drops the link. See `lib/link-phrase.ts`
 * for why the copy stays one string instead of a duplicated JSX sentence.
 *
 * Server-safe: no client hooks, so it can sit inside any server page.
 */
export default function LinkedPhrase({ text, phrase, href, className }: Props) {
  const split = splitPhrase(text, phrase);
  if (!split) return <>{text}</>;
  return (
    <>
      {split.before}
      <Link href={href} className={className}>
        {split.phrase}
      </Link>
      {split.after}
    </>
  );
}
