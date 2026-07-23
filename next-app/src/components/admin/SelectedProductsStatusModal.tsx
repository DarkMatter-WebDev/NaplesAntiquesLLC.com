'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  MARKETPLACE_STATUS_GROUP_LABELS,
  marketplaceItemStatusLabel,
  marketplaceStatusGroup,
  type CheckedMarketplaceItem,
  type Marketplace,
  type MarketplaceStatusGroup,
} from '@/lib/selected-marketplace-status';

interface SelectedProduct {
  id: string;
  title: string;
  inventoryNumber: number | null;
}

interface CheckResult {
  items: CheckedMarketplaceItem[];
}

interface Props {
  products: SelectedProduct[];
  marketplace: Marketplace;
  onClose: () => void;
  onPost: (productId: string, marketplace: Marketplace) => void;
}

type CheckState =
  | { status: 'checking'; result: null; error: null }
  | { status: 'success'; result: CheckResult; error: null }
  | { status: 'error'; result: null; error: string };

function marketplaceName(marketplace: Marketplace): string {
  return marketplace === 'etsy' ? 'Etsy' : 'eBay';
}

function itemStatusColor(item: CheckedMarketplaceItem | undefined): string {
  if (!item || item.checkError || item.syncState === 'error') return 'var(--color-error)';
  if (item.syncState === 'active' || item.syncState === 'published') return 'var(--color-primary)';
  return 'var(--color-on-surface-variant)';
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: unknown }).error;
    if (typeof error === 'string' && error) return error;
    if (error && typeof error === 'object' && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message) return message;
    }
  }
  return fallback;
}

export default function SelectedProductsStatusModal({ products, marketplace, onClose, onPost }: Props) {
  const productIds = useMemo(() => products.map((product) => product.id), [products]);
  const [detail, setDetail] = useState<{ marketplace: Marketplace; group: MarketplaceStatusGroup } | null>(null);
  const [states, setStates] = useState<Record<Marketplace, CheckState>>({
    etsy: { status: 'checking', result: null, error: null },
    ebay: { status: 'checking', result: null, error: null },
  });

  useEffect(() => {
    let cancelled = false;

    async function checkStatuses(marketplace: Marketplace) {
      const name = marketplaceName(marketplace);
      try {
        const response = await fetch(`/api/admin/${marketplace}/verify-all`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ productIds }),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          throw new Error(errorMessage(data, `Could not check ${name} statuses.`));
        }
        if (!cancelled) {
          setStates((current) => ({
            ...current,
            [marketplace]: { status: 'success', result: data as CheckResult, error: null },
          }));
        }
      } catch (caught) {
        if (!cancelled) {
          setStates((current) => ({
            ...current,
            [marketplace]: {
              status: 'error',
              result: null,
              error: caught instanceof Error ? caught.message : `Could not check ${name} statuses.`,
            },
          }));
        }
      }
    }

    void checkStatuses(marketplace);
    return () => {
      cancelled = true;
    };
  }, [marketplace, productIds]);

  async function retry(marketplace: Marketplace) {
    const name = marketplaceName(marketplace);
    setStates((current) => ({
      ...current,
      [marketplace]: { status: 'checking', result: null, error: null },
    }));
    try {
      const response = await fetch(`/api/admin/${marketplace}/verify-all`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(errorMessage(data, `Could not check ${name} statuses.`));
      }
      setStates((current) => ({
        ...current,
        [marketplace]: { status: 'success', result: data as CheckResult, error: null },
      }));
    } catch (caught) {
      setStates((current) => ({
        ...current,
        [marketplace]: {
          status: 'error',
          result: null,
          error: caught instanceof Error ? caught.message : `Could not check ${name} statuses.`,
        },
      }));
    }
  }

  const checking = states[marketplace].status === 'checking';
  const detailState = detail ? states[detail.marketplace] : null;
  const detailItems = detail && detailState?.status === 'success'
    ? products.flatMap((product) => {
      const item = detailState.result.items.find((candidate) => candidate.productId === product.id);
      return marketplaceStatusGroup(item) === detail.group ? [{ product, item }] : [];
    })
    : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto whitespace-normal p-4 sm:items-center"
      style={{ background: 'rgba(0,0,0,0.52)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="selected-status-title"
    >
      <div
        className={`min-w-0 w-full ${detail ? 'max-w-xl' : 'max-w-md'} max-h-[calc(100dvh-2rem)] overflow-y-auto border p-5 shadow-2xl [overflow-wrap:anywhere] md:p-6`}
        style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-background)' }}
      >
        {detail ? (
          <>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {marketplaceName(detail.marketplace)} · {detailItems.length} {detailItems.length === 1 ? 'item' : 'items'}
            </p>
            <h2 id="selected-status-title" className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
              {MARKETPLACE_STATUS_GROUP_LABELS[detail.group]}
            </h2>
            <ul className="mt-5 border-t" style={{ borderColor: 'var(--color-outline-variant)' }}>
              {detailItems.map(({ product, item }) => (
                <li key={product.id} className="flex min-w-0 flex-col gap-3 border-b py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
                  <div className="min-w-0">
                    {product.inventoryNumber !== null && (
                      <p className="text-[0.6rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                        Item {product.inventoryNumber}
                      </p>
                    )}
                    <p className="break-words text-sm font-medium" style={{ color: 'var(--color-on-surface)' }}>{product.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: itemStatusColor(item), fontFamily: 'var(--font-label)' }}>
                      {marketplaceItemStatusLabel(detail.marketplace, item)}
                    </p>
                    {detail.group === 'not-listed' && (
                      <button
                        type="button"
                        onClick={() => onPost(product.id, detail.marketplace)}
                        className="gold-button min-h-9 shrink-0 px-4 text-xs"
                        aria-label={`Post ${product.title} to ${marketplaceName(detail.marketplace)}`}
                      >
                        Post to {marketplaceName(detail.marketplace)}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
              {products.length} selected {products.length === 1 ? 'item' : 'items'}
            </p>
            <h2 id="selected-status-title" className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>
              Check {marketplaceName(marketplace)} status
            </h2>

            <p className="mt-4 text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>
              This checks {marketplaceName(marketplace)} only and reconciles local status and linkage. No listing content is pushed.
            </p>

            <div className="mt-5 grid gap-3">
          {[marketplace].map((marketplace) => {
            const state = states[marketplace];
            const name = marketplaceName(marketplace);
            return (
              <section key={marketplace} className="border p-4" style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-lowest)' }}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-label)' }}>
                    {name}
                  </h3>
                  {state.status === 'checking' && (
                    <span className="flex items-center gap-2 text-xs" role="status" aria-live="polite" style={{ color: 'var(--color-on-surface-variant)' }}>
                      <span className="material-symbols-outlined animate-spin" aria-hidden="true" style={{ color: 'var(--color-primary)', fontSize: '18px' }}>sync</span>
                      Checking...
                    </span>
                  )}
                </div>

                {state.status === 'error' && (
                  <div className="mt-3">
                    <p className="text-sm" style={{ color: 'var(--color-error)' }}>{state.error}</p>
                    <button type="button" onClick={() => void retry(marketplace)} className="outline-button mt-3 text-xs">
                      Try {name} again
                    </button>
                  </div>
                )}

                {state.status === 'success' && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(['listed', 'not-listed', 'issues'] as MarketplaceStatusGroup[]).map((group) => {
                      const count = products.filter((product) => {
                        const item = state.result.items.find((candidate) => candidate.productId === product.id);
                        return marketplaceStatusGroup(item) === group;
                      }).length;
                      return (
                        <button
                          key={group}
                          type="button"
                          disabled={count === 0}
                          onClick={() => setDetail({ marketplace, group })}
                          className="flex min-h-[76px] min-w-0 flex-col justify-between border px-2 py-2 text-left transition-colors hover:bg-[var(--color-surface-container)] disabled:cursor-default disabled:opacity-45"
                          style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-background)' }}
                          aria-label={`View ${count} ${name} ${MARKETPLACE_STATUS_GROUP_LABELS[group].toLowerCase()} ${count === 1 ? 'item' : 'items'}`}
                        >
                          <span className="flex w-full items-start justify-between gap-1">
                            <span className="text-xl font-bold" style={{ color: group === 'issues' && count ? 'var(--color-error)' : 'var(--color-on-surface)', fontFamily: 'var(--font-headline)' }}>{count}</span>
                            {count > 0 && <span className="material-symbols-outlined" aria-hidden="true" style={{ color: 'var(--color-primary)', fontSize: '17px' }}>chevron_right</span>}
                          </span>
                          <span className="break-words text-[0.56rem] font-bold uppercase tracking-wider" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                            {MARKETPLACE_STATUS_GROUP_LABELS[group]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
            </div>
          </>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {detail && (
            <button type="button" onClick={() => setDetail(null)} className="outline-button text-sm">
              <span aria-hidden="true" className="text-base leading-none">&larr;</span>
              Back
            </button>
          )}
          <button type="button" onClick={onClose} className="gold-button text-sm">
            {checking ? 'Close' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
