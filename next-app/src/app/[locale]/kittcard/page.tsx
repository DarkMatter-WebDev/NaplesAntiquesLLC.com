import type { Metadata } from 'next';
import CardLanding, { cardMetadata } from '@/components/card/CardLanding';
import { CARD_HOLDERS } from '@/lib/card-holders';

/**
 * `/kittcard` — the QR landing page on Kitt's business cards (2026-09-16). The page itself is `CardLanding`;
 * the name and number come from `lib/card-holders.ts`. Never indexed, never
 * in the sitemap (guarded by `card-page.test.ts`).
 */

interface Props {
  params: Promise<{ locale: string }>;
}

const HOLDER = CARD_HOLDERS.kittcard;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return cardMetadata(HOLDER, locale);
}

export default async function KittCardPage({ params }: Props) {
  const { locale } = await params;
  return <CardLanding locale={locale} holder={HOLDER} />;
}
