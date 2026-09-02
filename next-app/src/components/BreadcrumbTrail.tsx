import Link from 'next/link';
import { breadcrumbLd, type Crumb } from '@/lib/breadcrumb-ld';

/**
 * The VISIBLE breadcrumb trail ("Home › Sell Gold"), approved by the owner on
 * 2026-09-02 from a mockup. It renders from the same crumbs the page's
 * BreadcrumbList JSON-LD is built from, so the trail and the schema can never
 * disagree — Google's guideline is that breadcrumb markup reflect a trail the
 * visitor can see.
 *
 * Placement: once per page, directly above the eyebrow label of the opening
 * section. `tone="dark"` on dark heroes (cream links, gold current page),
 * `tone="light"` on light sections (brown links, gold current page);
 * `align="center"` inside centered heroes. Never on the homepage.
 */
type TrailItem = { name: string; item: string };
type LdLike = { itemListElement: ReadonlyArray<TrailItem> };
type Tone = 'dark' | 'light';
type Align = 'start' | 'center';

const ORIGIN = 'https://naplesestatejewelry.com';

function hrefFor(absolute: string): string {
  const rest = absolute.startsWith(ORIGIN) ? absolute.slice(ORIGIN.length) : absolute;
  return rest === '' ? '/' : rest;
}

function Trail({ items, tone, align, className }: { items: ReadonlyArray<TrailItem>; tone: Tone; align: Align; className?: string }) {
  const dark = tone === 'dark';
  const linkClass = dark ? 'text-[#d7d0c3] hover:text-white' : 'text-[#4d4635] hover:text-[#1a1c1c]';
  const separatorClass = dark ? 'text-[#8c8676]' : 'text-[#a39a84]';
  const currentClass = dark ? 'text-[#e9c349]' : 'text-[#735c00]';
  return (
    <nav aria-label="Breadcrumb" className={`breadcrumb-trail mb-4 text-xs tracking-[0.06em] ${className ?? ''}`} style={{ fontFamily: 'var(--font-label)' }}>
      <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${align === 'center' ? 'justify-center' : ''}`}>
        {items.map((entry, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={entry.item} className="flex min-w-0 items-center gap-x-2">
              {isCurrent ? (
                <span aria-current="page" className={`${currentClass} truncate`}>{entry.name}</span>
              ) : (
                <Link href={hrefFor(entry.item)} className={`${linkClass} transition-colors`}>{entry.name}</Link>
              )}
              {!isCurrent && <span aria-hidden="true" className={separatorClass}>›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** For pages that use the `breadcrumbLd` helper: same `locale` + `crumbs` as their `<BreadcrumbJsonLd>`. */
export default function BreadcrumbTrail({ locale, crumbs, tone = 'dark', align = 'start', className }: { locale: string; crumbs: readonly Crumb[]; tone?: Tone; align?: Align; className?: string }) {
  return <Trail items={breadcrumbLd(locale, crumbs).itemListElement} tone={tone} align={align} className={className} />;
}

/** For pages that still build their BreadcrumbList object by hand: pass that object so the trail reads the identical items. */
export function BreadcrumbTrailFromLd({ ld, tone = 'dark', align = 'start', className }: { ld: LdLike; tone?: Tone; align?: Align; className?: string }) {
  return <Trail items={ld.itemListElement} tone={tone} align={align} className={className} />;
}
