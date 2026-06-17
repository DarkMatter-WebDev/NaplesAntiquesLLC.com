'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const GOLD = '#735c00';
const BRIGHT_GOLD_GRADIENT = 'linear-gradient(135deg, #dcb336, #b5890c)';
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
      className="shop-pagination"
    >
      <div className="shop-pagination-count">
        <span className="material-symbols-outlined" aria-hidden="true">inventory_2</span>
        <span>
          {totalCount > 0
            ? isEs
              ? `Mostrando ${showingStart}-${showingEnd} de ${totalCount}`
              : `Showing ${showingStart}-${showingEnd} of ${totalCount}`
            : isEs
              ? 'No hay resultados'
              : 'No results'}
        </span>
      </div>

      <div className="shop-pagination-pages">
        {totalPages > 1 && (
          <>
          <PageLink
            href={buildHref(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            label={isEs ? 'Anterior' : 'Previous'}
            icon="chevron_left"
            iconOnly
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
            icon="chevron_right"
            iconOnly
          />
          </>
        )}
      </div>

      <label
        className="shop-pagination-size"
      >
        <span>{isEs ? 'Por pagina' : 'Per page'}</span>
        <select
          value={perPage}
          onChange={(event) => updatePerPage(event.target.value)}
          aria-label={isEs ? 'Productos por pagina' : 'Products per page'}
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <style>{`
        .shop-pagination {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 1rem;
          margin-top: 2rem;
          padding: 0.85rem;
          border: 1px solid rgba(115, 92, 0, 0.12);
          border-radius: 8px;
          background: #ffffff;
          box-shadow: 0 14px 36px rgba(42, 34, 12, 0.07);
        }
        .shop-pagination-count,
        .shop-pagination-size {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          min-width: 0;
          color: var(--color-on-surface-variant);
          font-family: var(--font-label);
          font-size: 0.76rem;
          font-weight: 700;
        }
        .shop-pagination-count .material-symbols-outlined {
          color: ${GOLD};
          font-size: 1.05rem;
          line-height: 1;
        }
        .shop-pagination-pages {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.28rem;
          padding: 0.28rem;
          border: 1px solid rgba(115, 92, 0, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.96);
        }
        .shop-pagination-size {
          justify-self: end;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .shop-pagination-size select {
          min-height: 2.45rem;
          min-width: 4.25rem;
          border: 1px solid rgba(115, 92, 0, 0.18);
          border-radius: 7px;
          background: #ffffff;
          color: var(--color-on-surface);
          font-family: var(--font-label);
          font-size: 0.82rem;
          font-weight: 800;
          outline: none;
          padding: 0 2rem 0 0.85rem;
          box-shadow: 0 8px 18px rgba(42, 34, 12, 0.04);
        }
        .shop-pagination-size select:focus-visible {
          border-color: ${GOLD};
          box-shadow: 0 0 0 3px rgba(115, 92, 0, 0.12);
        }
        .shop-page-control {
          min-width: 2.35rem;
          min-height: 2.35rem;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          border: 1px solid rgba(115, 92, 0, 0.12);
          border-radius: 7px;
          background: #ffffff;
          color: var(--color-on-surface);
          font-family: var(--font-label);
          font-size: 0.75rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          line-height: 1;
          padding: 0 0.78rem;
          text-decoration: none;
          transition: background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease, transform 160ms ease;
        }
        .shop-page-control:hover {
          border-color: rgba(115, 92, 0, 0.28);
          box-shadow: 0 8px 18px rgba(42, 34, 12, 0.07);
          transform: translateY(-1px);
        }
        .shop-page-control.is-active {
          border-color: transparent;
          background: ${BRIGHT_GOLD_GRADIENT};
          color: var(--color-on-primary);
          box-shadow: 0 10px 22px rgba(181, 137, 12, 0.18);
        }
        .shop-page-control.is-disabled {
          color: rgba(72, 65, 52, 0.32);
          pointer-events: none;
          box-shadow: none;
        }
        .shop-page-control.is-icon-only {
          min-width: 2.35rem;
          padding: 0;
        }
        .shop-page-control .material-symbols-outlined {
          font-size: 1.12rem;
          line-height: 1;
        }
        @media (max-width: 760px) {
          .shop-pagination {
            grid-template-columns: 1fr;
            justify-items: stretch;
          }
          .shop-pagination-count,
          .shop-pagination-size,
          .shop-pagination-pages {
            justify-content: center;
            justify-self: stretch;
          }
          .shop-pagination-size {
            justify-content: space-between;
          }
        }
      `}</style>
    </nav>
  );
}

function PageLink({
  href,
  label,
  active = false,
  disabled = false,
  icon,
  iconOnly = false,
}: {
  href: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  icon?: string;
  iconOnly?: boolean;
}) {
  const className = [
    'shop-page-control',
    active ? 'is-active' : '',
    disabled ? 'is-disabled' : '',
    iconOnly ? 'is-icon-only' : '',
  ].filter(Boolean).join(' ');
  const contents = (
    <>
      {icon && <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>}
      {!iconOnly && <span>{label}</span>}
    </>
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true" title={label}>
        {contents}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} className={className} aria-current={active ? 'page' : undefined} title={label} aria-label={label}>
      {contents}
    </Link>
  );
}

function getVisiblePages(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages, currentPage]);
  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  return Array.from(pages).sort((a, b) => a - b);
}
