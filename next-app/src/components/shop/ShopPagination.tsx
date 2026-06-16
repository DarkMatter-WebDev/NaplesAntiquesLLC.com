'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const GOLD = '#735c00';
const PER_PAGE_OPTIONS = [12, 24, 48, 96];

interface Props {
  locale: string;
  currentPage: number;
  perPage: number;
  totalPages: number;
  totalCount: number;
  showingStart: number;
  showingEnd: number;
}

export default function ShopPagination({
  locale,
  currentPage,
  perPage,
  totalPages,
  totalCount,
  showingStart,
  showingEnd,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEs = locale === 'es';

  function buildHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function updatePerPage(value: string) {
    const nextPerPage = Number(value);
    const params = new URLSearchParams(searchParams.toString());
    if (nextPerPage === 24) {
      params.delete('perPage');
    } else {
      params.set('perPage', String(nextPerPage));
    }
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const pageNumbers = getVisiblePages(currentPage, totalPages);

  return (
    <nav
      aria-label={isEs ? 'Paginacion de productos' : 'Product pagination'}
      className="mt-8 flex flex-col gap-4 border-t pt-5 md:flex-row md:items-center md:justify-between"
      style={{ borderColor: 'rgba(115, 92, 0, 0.24)' }}
    >
      <div
        className="flex flex-wrap items-center gap-3 text-sm"
        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
      >
        <span>
          {totalCount > 0
            ? isEs
              ? `Mostrando ${showingStart}-${showingEnd} de ${totalCount}`
              : `Showing ${showingStart}-${showingEnd} of ${totalCount}`
            : isEs
              ? 'No hay resultados'
              : 'No results'}
        </span>
        <label className="flex items-center gap-2">
          <span>{isEs ? 'Por pagina' : 'Per page'}</span>
          <select
            value={perPage}
            onChange={(event) => updatePerPage(event.target.value)}
            className="border bg-[color:var(--color-background)] px-2 py-1 text-sm"
            style={{
              borderColor: 'rgba(115, 92, 0, 0.35)',
              color: 'var(--color-on-surface)',
              fontFamily: 'var(--font-label)',
            }}
          >
            {PER_PAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <PageLink
            href={buildHref(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            label={isEs ? 'Anterior' : 'Previous'}
          />
          {pageNumbers.map((page) => (
            <PageLink
              key={page}
              href={buildHref(page)}
              active={page === currentPage}
              label={String(page)}
            />
          ))}
          <PageLink
            href={buildHref(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            label={isEs ? 'Siguiente' : 'Next'}
          />
        </div>
      )}
    </nav>
  );
}

function PageLink({
  href,
  label,
  active = false,
  disabled = false,
}: {
  href: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const className = 'inline-flex min-h-9 min-w-9 items-center justify-center border px-3 text-xs font-bold uppercase tracking-wide';
  const style = {
    borderColor: active ? GOLD : 'rgba(115, 92, 0, 0.28)',
    background: active ? GOLD : 'var(--color-background)',
    color: active ? 'var(--color-on-primary)' : disabled ? 'rgba(72, 65, 52, 0.42)' : 'var(--color-on-surface)',
    fontFamily: 'var(--font-label)',
    pointerEvents: disabled ? 'none' as const : 'auto' as const,
  };

  if (disabled) {
    return (
      <span className={className} style={style} aria-disabled="true">
        {label}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} className={className} style={style} aria-current={active ? 'page' : undefined}>
      {label}
    </Link>
  );
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  return Array.from(pages).sort((a, b) => a - b);
}
