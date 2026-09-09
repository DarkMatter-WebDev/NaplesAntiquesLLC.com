import type { ReactNode } from 'react';
import { jsonLdHtml } from '@/lib/json-ld';

/**
 * A page's FAQ block: the visible `<details>` accordion AND the matching
 * FAQPage JSON-LD, generated from ONE list so the markup can never describe
 * questions the visitor cannot see (Google's rule for FAQ structured data).
 *
 * Extracted 2026-09-08 when `/gold-services` and `/silver-services` gained
 * the FAQ the diamond, watch and appraisal pages already had (the
 * "why are the calls about diamonds?" parity item). Same markup as the
 * diamond page's inline block, which stays inline; new pages use this.
 *
 * Every answer must be sourced from copy that already exists on the site
 * (the owner's framing rules in `DECISIONS.md`) — this component renders,
 * it does not know facts.
 */
export type Faq = {
  qEn: string;
  qEs: string;
  aEn: string;
  aEs: string;
};

type Props = {
  isEs: boolean;
  /** Section heading, already localized. */
  heading: string;
  faqs: readonly Faq[];
  /** Optional closing line under the accordion (cross-links to sibling pages). */
  footer?: ReactNode;
};

export default function FaqSection({ isEs, heading, faqs, footer }: Props) {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: isEs ? f.qEs : f.qEn,
      acceptedAnswer: { '@type': 'Answer', text: isEs ? f.aEs : f.aEn },
    })),
  };

  return (
    <section className="border-t border-[#d0c5af] bg-[#f3f3f3] py-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(faqLd) }} />
      <div className="mx-auto max-w-3xl px-4 md:px-8">
        <h2 className="mb-10 text-center text-3xl font-bold text-[#1a1c1c] md:text-4xl" style={{ fontFamily: 'var(--font-headline)' }}>
          {heading}
        </h2>
        <div className="flex flex-col gap-4">
          {faqs.map((f) => (
            <details key={f.qEn} className="group rounded-2xl border border-[#d0c5af] bg-white p-5 shadow-[0_10px_28px_rgba(38,28,6,0.04)]">
              <summary className="cursor-pointer list-none text-base font-bold text-[#1a1c1c]" style={{ fontFamily: 'var(--font-headline)' }}>
                {isEs ? f.qEs : f.qEn}
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[#4d4635]">{isEs ? f.aEs : f.aEn}</p>
            </details>
          ))}
        </div>
        {footer && <p className="mt-8 text-center text-sm leading-relaxed text-[#4d4635]">{footer}</p>}
      </div>
    </section>
  );
}
