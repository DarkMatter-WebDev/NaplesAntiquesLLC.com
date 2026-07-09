import type { Metadata } from 'next';
import { alternatesFor } from '@/lib/seo';
import { renderShopPage } from '@/app/[locale]/shop/(list)/page';

// Static/ISR twin of the real /shop page, for the bare "no filters" visit
// only. next.config.ts rewrites /shop (and /es/shop) here WHEN NONE of the
// filter query keys are present — the browser URL stays /shop throughout
// (a rewrite, not a redirect). This page's own signature never receives a
// `searchParams` prop, so it never touches Next's tracked dynamic APIs and
// can be prerendered/ISR'd (revalidate below) instead of forced into
// per-request dynamic SSR the way the real page is once it awaits
// searchParams. Any request that has even one filter/sort/page param never
// reaches this route — the rewrite condition excludes it, so it keeps
// getting the fully dynamic, always-correct render from the real page.
// Canonical/alternates point at /shop (not this internal path) so it is
// never treated as separate, indexable content — see project-docs/DECISIONS.md
// 2026-07-09 for the full writeup of why this two-page split exists instead
// of enabling Cache Components / PPR (too broad a blast-radius change) or
// force-static (would incorrectly serve the unfiltered view for direct
// visits to a filtered URL).

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Shop Estate Jewelry in Naples, FL',
    description: 'Browse estate gold jewelry, chains, bracelets, and rings with live gold-spot pricing on every piece.',
    alternates: alternatesFor('/shop', locale),
  };
}

export const revalidate = 300;

export default async function ShopIndexPage({ params }: Props) {
  return renderShopPage({ params, searchParams: Promise.resolve({}), variant: 'modern' });
}
