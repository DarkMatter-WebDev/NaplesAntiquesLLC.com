import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import BreadcrumbJsonLd from '@/components/BreadcrumbJsonLd';
import BreadcrumbTrail from '@/components/BreadcrumbTrail';

export interface LegalSection {
  title: string;
  body?: string[];
  bullets?: string[];
}

export interface LegalPolicyPageProps {
  locale: string;
  /**
   * Locale-agnostic path of the page (e.g. '/privacy'). When set, the page
   * emits BreadcrumbList JSON-LD (Home → this page, named by `title`). Leave
   * unset on pages that are not in the sitemap (e.g. /unsubscribe).
   */
  path?: string;
  eyebrow?: string;
  title: string;
  updated?: string;
  intro?: string[];
  sections: LegalSection[];
  children?: React.ReactNode;
}

export default function LegalPolicyPage({
  locale,
  path,
  eyebrow = 'Legal',
  title,
  updated = 'June 19, 2026',
  intro = [],
  sections,
  children,
}: LegalPolicyPageProps) {
  const isEs = locale === 'es';
  const homeHref = isEs ? '/es' : '/';
  // One crumbs array feeds both the JSON-LD and the visible trail.
  const crumbs = path ? [{ name: title, path }] : null;

  return (
    <>
      {crumbs && <BreadcrumbJsonLd locale={locale} crumbs={crumbs} />}
      <SiteHeader />
      <main className="px-4 py-14 pt-28 md:px-8 md:py-18 md:pt-32">
        <div className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-2xl border bg-white/78 p-6 shadow-[0_18px_60px_rgba(38,28,6,0.06)] backdrop-blur md:p-8" style={{ borderColor: 'rgba(115, 92, 0, 0.12)' }}>
          {crumbs && <BreadcrumbTrail locale={locale} crumbs={crumbs} tone="light" />}
          <span className="text-[#735c00] text-xs font-bold uppercase tracking-[0.4em]">
            {eyebrow}
          </span>
          <h1 className="font-[family-name:var(--font-headline)] text-4xl md:text-5xl font-bold text-[#1a1c1c] mt-2 mb-4">
            {title}
          </h1>
          <p className="text-sm text-[#4d4635]">
            {isEs ? 'Última actualización: ' : 'Last updated: '}{updated}
          </p>
          {intro.length > 0 && (
            <div className="mt-6 space-y-3 text-[#4d4635] leading-relaxed">
              {intro.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          )}
        </header>

        <article className="space-y-5 text-[#4d4635] leading-relaxed">
          {sections.map((section, index) => (
            <section
              key={section.title}
              className="rounded-2xl border bg-white/70 p-5 shadow-[0_10px_34px_rgba(38,28,6,0.045)] md:p-6"
              style={{ borderColor: 'rgba(115, 92, 0, 0.12)' }}
            >
              <h2 className="mb-3 flex items-start gap-3 font-[family-name:var(--font-headline)] text-2xl font-bold text-[#1a1c1c]">
                <span className="mt-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#f7efd7] text-[0.72rem] font-bold text-[#735c00]" style={{ fontFamily: 'var(--font-label)' }}>
                  {index + 1}
                </span>
                <span>{section.title}</span>
              </h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="mb-3 text-sm">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 text-sm">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#b5890c]" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        {children}

        <div className="mt-8 border-t border-[#d0c5af] pt-6">
          <Link href={homeHref} className="outline-button text-xs">
            &lt; {isEs ? 'Volver al inicio' : 'Back to Home'}
          </Link>
        </div>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
