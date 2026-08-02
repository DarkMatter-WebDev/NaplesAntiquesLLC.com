'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import InstagramCropEditor, { type CropRect } from './InstagramCropEditor';
import AdminModal from './AdminModal';
import SocialPublishBothModal from './SocialPublishBothModal';

interface PreviewResponse {
  caption: string;
  captionLength: number;
  imageCount: number;
  imageUrls: string[];
  renditionUrls: string[];
  /** Per-slide: whether it is the generated card rather than a photo. */
  renditionIsCard: boolean[];
  /** Ordered source images that will be posted. */
  lineup: string[];
  /** Product photos deliberately left out of the carousel. */
  notIncluded: string[];
  hasCustomLineup: boolean;
  /** Instagram-only crop rects, keyed by source image URL. */
  crops: Record<string, CropRect>;
  /** Product image the generated card is built from; null = lineup cover. */
  cardSourceUrl: string | null;
  /** Hex background override for the generated card; null = auto-detect. */
  cardBackground: string | null;
  /** Copy for the generated card that leads every carousel. */
  cardContent: { title: string; price: string | null; specs: string | null };
  altText: string;
  quotedPrice: number | null;
  warnings: string[];
  blockedReason: string | null;
  spotSource: string | null;
  current: {
    syncState: string;
    permalink: string | null;
    postedAt: string | null;
    queuedAt: string | null;
  } | null;
}

const STATE_LABELS: Record<string, string> = {
  pending: 'Queued',
  review: 'Ready to publish',
  publishing: 'Publishing…',
  published: 'Published',
  out_of_date: 'Out of date',
  deleted: 'Removed',
  error: 'Error',
};

function stateTone(state: string): string {
  if (state === 'published') return 'var(--color-primary)';
  if (state === 'error') return 'var(--color-error)';
  if (state === 'out_of_date') return '#8a6400';
  return 'var(--color-on-surface-variant)';
}

/**
 * Per-product Instagram review and publish surface.
 *
 * The caption preview is the heart of this panel rather than a nicety:
 * Instagram captions cannot be edited after publishing and posts cannot be
 * deleted through the API, so this is the operator's only chance to catch a
 * mistake. The images shown are the actual square JPEG renditions that will be
 * uploaded, not the source photos.
 */
export default function InstagramProductPanel({ productId }: { productId: string }) {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | 'prepare' | 'publish' | 'queue' | 'remove' | 'forget' | 'discard'>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [manualDelete, setManualDelete] = useState<{ permalink: string | null } | null>(null);
  // Draft lineup being edited. `null` means "not editing" — the panel shows the
  // saved lineup from the server. Edits stay local until Save, so a mis-click
  // never silently changes what would be published.
  const [draftLineup, setDraftLineup] = useState<string[] | null>(null);
  // Same draft-until-Save rule as the lineup, and saved by the same request so
  // order and crops can never drift apart.
  const [draftCrops, setDraftCrops] = useState<Record<string, CropRect> | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);
  // `undefined` = no unsaved change; `null` = explicitly back to the cover.
  const [draftCardSource, setDraftCardSource] = useState<string | null | undefined>(undefined);
  // Same sentinel pattern; `null` = auto-detect, a hex string forces it.
  const [draftCardBackground, setDraftCardBackground] = useState<string | null | undefined>(undefined);
  const [savingLineup, setSavingLineup] = useState(false);
  // Object URL of an on-demand card render, shown in a pop-up window.
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  // The thumbnail the single action toolbar operates on.
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  // Prepared slide opened full-size in a pop-up window (site convention).
  const [enlargedSlide, setEnlargedSlide] = useState<{ url: string; label: string } | null>(null);
  const [showPublishBoth, setShowPublishBoth] = useState(false);
  const [copying, setCopying] = useState(false);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 6000);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/instagram/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load the Instagram preview.');
      setPreview(data as PreviewResponse);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not load the Instagram preview.', false);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // Wrapped so the first setState lands after an await, not synchronously in
    // the effect body (react-hooks/set-state-in-effect).
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const runAction = async (action: 'prepare' | 'publish' | 'queue' | 'unqueue') => {
    setBusy(action === 'unqueue' ? 'queue' : action);
    try {
      const res = await fetch('/api/admin/instagram/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.error || 'That action failed.');
      showNotice(data?.message ?? 'Done.', true);
      if (data?.warnings?.length) showNotice(data.warnings.join(' '), true);
      setConfirmPublish(false);
      await load();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'That action failed.', false);
    } finally {
      setBusy(null);
    }
  };

  // Deletes the prepared slides/caption and un-queues, but KEEPS the lineup,
  // crops and card choices — cancelling a draft must not cost curation work.
  const discardDraft = async () => {
    setBusy('discard');
    try {
      const res = await fetch('/api/admin/instagram/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, action: 'discard' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.error || 'Could not discard the prepared upload.');
      showNotice(data?.message ?? 'Discarded.', true);
      setConfirmDiscard(false);
      await load();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not discard the prepared upload.', false);
    } finally {
      setBusy(null);
    }
  };

  // Copies the SAVED lineup/crops/card setup onto Facebook — drafts stay
  // local, so the button is hidden while there are unsaved changes.
  const copyCuration = async () => {
    setCopying(true);
    try {
      const res = await fetch('/api/admin/social/copy-curation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, from: 'instagram' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not copy the setup.');
      showNotice(data?.message ?? 'Copied to Facebook.', true);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not copy the setup.', false);
    } finally {
      setCopying(false);
    }
  };

  const removePost = async () => {
    setBusy('remove');
    try {
      const res = await fetch('/api/admin/instagram/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, confirm: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.error || 'Could not remove the post.');
      if (data?.manualDeleteRequired) {
        setManualDelete({ permalink: data.permalink ?? null });
      } else {
        showNotice(data?.message ?? 'Removed.', true);
      }
      await load();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not remove the post.', false);
    } finally {
      setBusy(null);
    }
  };

  const forgetPost = async () => {
    setBusy('forget');
    try {
      const res = await fetch('/api/admin/instagram/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, confirm: true, mode: 'forget' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.error || 'Could not clear the record.');
      setManualDelete(null);
      showNotice(data?.message ?? 'Cleared.', true);
      await load();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not clear the record.', false);
    } finally {
      setBusy(null);
    }
  };

  const saveLineup = async (
    urls: string[],
    crops: Record<string, CropRect>,
    cardSource: string | null | undefined,
    cardBackground: string | null | undefined,
  ) => {
    setSavingLineup(true);
    try {
      const res = await fetch('/api/admin/instagram/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          imageUrls: urls,
          crops,
          // Only sent when there is an actual change; the route treats an
          // omitted key as "leave as is".
          ...(cardSource !== undefined ? { cardSourceUrl: cardSource } : {}),
          ...(cardBackground !== undefined ? { cardBackground } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not save the image lineup.');
      setDraftLineup(null);
      setDraftCrops(null);
      setDraftCardSource(undefined);
      setDraftCardBackground(undefined);
      showNotice('Image lineup saved. Prepare again to rebuild the images.');
      await load();
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not save the image lineup.', false);
    } finally {
      setSavingLineup(false);
    }
  };

  const generateCardPreview = async (sourceUrl: string | null, background: string | null) => {
    setGeneratingCard(true);
    try {
      const res = await fetch('/api/admin/card-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          ...(sourceUrl ? { imageUrl: sourceUrl } : {}),
          ...(background ? { background } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Could not render the card.');
      }
      const blob = await res.blob();
      setCardPreviewUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return URL.createObjectURL(blob);
      });
      // Site convention: results open in a pop-up window, never inline.
      setShowCardModal(true);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not render the card.', false);
    } finally {
      setGeneratingCard(false);
    }
  };

  const state = preview?.current?.syncState ?? null;
  const isPublished = state === 'published';
  const canPublish = state === 'review' && !preview?.blockedReason;

  // What the editor is currently showing: the unsaved draft when editing,
  // otherwise the saved lineup.
  const shownLineup = draftLineup ?? preview?.lineup ?? [];
  const shownExcluded = draftLineup
    ? [...(preview?.lineup ?? []), ...(preview?.notIncluded ?? [])].filter(
        (url) => !draftLineup.includes(url),
      )
    : preview?.notIncluded ?? [];
  const shownCrops = draftCrops ?? preview?.crops ?? {};
  const shownCardSource =
    draftCardSource !== undefined ? draftCardSource : preview?.cardSourceUrl ?? null;
  // The image the card will actually be built from right now.
  const effectiveCardSource = shownCardSource ?? shownLineup[0] ?? null;
  const shownCardBackground =
    draftCardBackground !== undefined ? draftCardBackground : preview?.cardBackground ?? null;
  const lineupDirty =
    draftLineup !== null ||
    draftCrops !== null ||
    draftCardSource !== undefined ||
    draftCardBackground !== undefined;
  const selectedIndex = selectedUrl ? shownLineup.indexOf(selectedUrl) : -1;

  const setCrop = (url: string, rect: CropRect | null) => {
    const next = { ...shownCrops };
    if (rect) next[url] = rect;
    else delete next[url];
    setDraftCrops(next);
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const next = [...shownLineup];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setDraftLineup(next);
  };

  const makeFirst = (index: number) => {
    if (index === 0) return;
    const next = [...shownLineup];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    setDraftLineup(next);
  };

  const removeImage = (index: number) => {
    const url = shownLineup[index];
    setDraftLineup(shownLineup.filter((_, i) => i !== index));
    // Drop the crop too, so it cannot silently reapply if the image is added
    // back later expecting a full frame.
    if (url && shownCrops[url]) setCrop(url, null);
    if (cropping === url) setCropping(null);
    // A removed image can no longer be the card's base.
    if (url && shownCardSource === url) setDraftCardSource(null);
    if (url && selectedUrl === url) setSelectedUrl(null);
  };

  const addImage = (url: string) => {
    setDraftLineup([...shownLineup, url]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}>
          Instagram
        </h2>
        {state && (
          <span
            className="border px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide"
            style={{ borderColor: 'var(--color-outline-variant)', color: stateTone(state), fontFamily: 'var(--font-label)' }}
          >
            {/* 'pending' only means "queued" when a queue entry actually
                exists — after a discard it just means "not posted". */}
            {state === 'pending' && !preview?.current?.queuedAt
              ? 'Not posted'
              : STATE_LABELS[state] ?? state}
          </span>
        )}
      </div>

      {notice && (
        <div
          className="px-3 py-2 text-xs font-medium"
          role="status"
          style={{
            background: notice.ok
              ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)'
              : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            border: `1px solid ${notice.ok ? 'color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
            color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
          }}
        >
          {notice.text}
        </div>
      )}

      {loading && (
        <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          Loading…
        </p>
      )}

      {!loading && preview?.blockedReason && (
        <div
          className="px-3 py-2 text-xs font-medium"
          style={{
            background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
            color: 'var(--color-error)',
          }}
        >
          Cannot post: {preview.blockedReason}
        </div>
      )}

      {!loading && preview && preview.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs" style={{ color: '#8a6400' }}>
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {manualDelete && (
        <div
          className="flex flex-col gap-2 px-3 py-3 text-xs"
          style={{
            background: 'color-mix(in srgb, #b8860b 14%, transparent)',
            border: '1px solid color-mix(in srgb, #b8860b 30%, transparent)',
            color: '#8a6400',
          }}
        >
          <p className="font-semibold">
            Instagram does not allow deleting posts through its API.
          </p>
          <p>
            Open the post in the Instagram app and delete it there, then clear it here.
          </p>
          {manualDelete.permalink && (
            <a
              href={manualDelete.permalink}
              target="_blank"
              rel="noopener"
              className="hover-underline-grow w-fit font-bold"
              style={{ color: '#8a6400' }}
            >
              Open the post ↗
            </a>
          )}
          <button
            type="button"
            onClick={forgetPost}
            disabled={busy === 'forget'}
            className="outline-button w-fit text-xs disabled:opacity-50"
          >
            {busy === 'forget' ? 'Clearing…' : 'I deleted it — clear this record'}
          </button>
        </div>
      )}

      {!loading && preview && (
        <>
          {isPublished && preview.current?.permalink && (
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Published{' '}
              {preview.current.postedAt
                ? new Date(preview.current.postedAt).toLocaleString()
                : ''}{' '}
              ·{' '}
              <a
                href={preview.current.permalink}
                target="_blank"
                rel="noopener"
                className="hover-underline-grow font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                View on Instagram ↗
              </a>
            </p>
          )}

          <div>
            <p
              className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
            >
              Caption preview · {preview.captionLength} / 2200 characters
            </p>
            {/* Captions are permanent once published, so this is shown verbatim
                and monospaced rather than prettified. */}
            <pre
              className="max-h-72 overflow-auto whitespace-pre-wrap border p-3 text-xs leading-relaxed"
              style={{
                borderColor: 'var(--color-outline-variant)',
                background: 'var(--color-surface-container-low)',
                color: 'var(--color-on-surface)',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {preview.caption}
            </pre>
            <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
              Captions cannot be edited after publishing, and Instagram&rsquo;s API cannot delete posts.
              Check this carefully.
            </p>
          </div>

          {/* ---- Image lineup editor ------------------------------------ */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p
                className="text-[0.65rem] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                Photos · {shownLineup.length} of max 9
              </p>
              {!lineupDirty && (
                <button
                  type="button"
                  onClick={copyCuration}
                  disabled={copying || busy !== null}
                  title="Copy this lineup, crops and card choices to the Facebook post"
                  className="outline-button text-xs disabled:opacity-50"
                >
                  {copying ? 'Copying…' : 'Copy setup to Facebook'}
                </button>
              )}
              {lineupDirty && (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => saveLineup(shownLineup, shownCrops, draftCardSource, draftCardBackground)}
                    disabled={savingLineup || shownLineup.length === 0}
                    className="gold-button text-xs disabled:opacity-50"
                  >
                    {savingLineup ? 'Saving…' : 'Save lineup'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftLineup(null);
                      setDraftCrops(null);
                      setCropping(null);
                      setDraftCardSource(undefined);
                      setDraftCardBackground(undefined);
                    }}
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                  >
                    Cancel
                  </button>
                </span>
              )}
            </div>

            {isPublished ? (
              <p className="mb-2 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                This post is already live, so its images can no longer be changed.
              </p>
            ) : null}

            {shownLineup.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-error)' }}>
                No images selected. Add at least one below.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-3">
                {shownLineup.map((url, index) => (
                  // Thumbnails are selection targets only. Every action lives
                  // in the single toolbar below, and editors open in pop-up
                  // windows — the site convention is never to expand inline.
                  <li key={url}>
                    <button
                      type="button"
                      onClick={() => setSelectedUrl(selectedUrl === url ? null : url)}
                      disabled={isPublished}
                      aria-label={`Select photo ${index + 1}`}
                      aria-pressed={selectedUrl === url}
                      className="relative block h-24 w-24 overflow-hidden border disabled:cursor-default"
                      style={{
                        borderColor:
                          selectedUrl === url
                            ? 'var(--color-primary)'
                            : 'var(--color-outline-variant)',
                        borderWidth: selectedUrl === url ? 2 : 1,
                        boxShadow:
                          selectedUrl === url
                            ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 40%, transparent)'
                            : undefined,
                      }}
                    >
                      <Image
                        src={url}
                        alt={`Carousel position ${index + 1}`}
                        fill
                        sizes="96px"
                        className="object-cover"
                        unoptimized={url.startsWith('/assets/')}
                      />
                      <span
                        className="absolute left-0 top-0 px-1 text-[0.6rem] font-bold"
                        style={{
                          background: index === 0 ? 'var(--color-primary)' : 'rgba(0,0,0,0.6)',
                          color: '#fff',
                        }}
                      >
                        {index === 0 ? 'COVER' : index + 1}
                      </span>
                      {effectiveCardSource === url && (
                        <span
                          className="absolute right-0 top-0 px-1 text-[0.55rem] font-bold uppercase"
                          style={{ background: '#1c1815', color: '#d6b872' }}
                          title="The generated card is built from this photo"
                        >
                          Card
                        </span>
                      )}
                      {shownCrops[url] && (
                        <span
                          className="absolute bottom-0 right-0 px-1 text-[0.55rem] font-bold uppercase"
                          style={{ background: 'var(--color-primary)', color: '#fff' }}
                          title="This image is cropped for this post"
                        >
                          Crop
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* ---- Single action toolbar for the selected photo --------- */}
            {!isPublished && shownLineup.length > 0 && (
              <div
                className="mt-3 flex flex-wrap items-center gap-2 border px-3 py-2"
                style={{
                  borderColor: 'var(--color-outline-variant)',
                  background: 'var(--color-surface-container-low)',
                }}
              >
                {selectedIndex === -1 ? (
                  <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Click a photo above to move, crop, or feature it.
                  </span>
                ) : (
                  <>
                    <span
                      className="text-[0.65rem] font-bold uppercase tracking-wide"
                      style={{ color: 'var(--color-on-surface)', fontFamily: 'var(--font-label)' }}
                    >
                      Photo {selectedIndex + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveImage(selectedIndex, -1)}
                      disabled={selectedIndex === 0}
                      className="outline-button text-xs disabled:opacity-40"
                    >
                      ← Move
                    </button>
                    <button
                      type="button"
                      onClick={() => moveImage(selectedIndex, 1)}
                      disabled={selectedIndex === shownLineup.length - 1}
                      className="outline-button text-xs disabled:opacity-40"
                    >
                      Move →
                    </button>
                    <button
                      type="button"
                      onClick={() => makeFirst(selectedIndex)}
                      disabled={selectedIndex === 0}
                      className="outline-button text-xs disabled:opacity-40"
                    >
                      Set as cover
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedUrl && setCropping(selectedUrl)}
                      className="outline-button text-xs"
                    >
                      {selectedUrl && shownCrops[selectedUrl] ? 'Edit crop…' : 'Crop…'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        selectedUrl &&
                        // Choosing the cover again clears the override.
                        setDraftCardSource(
                          selectedUrl === (shownLineup[0] ?? null) || shownCardSource === selectedUrl
                            ? null
                            : selectedUrl,
                        )
                      }
                      className="outline-button text-xs"
                      style={
                        effectiveCardSource === selectedUrl
                          ? { color: 'var(--color-primary)', borderColor: 'var(--color-primary)' }
                          : undefined
                      }
                    >
                      {effectiveCardSource === selectedUrl ? 'Card photo ✓' : 'Use for card'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(selectedIndex)}
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}
                    >
                      Remove
                    </button>
                  </>
                )}
                <span className="flex-1" />
                <label
                  className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-wide"
                  style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                >
                  Card bg
                  <select
                    className="form-field text-xs"
                    value={shownCardBackground ?? 'auto'}
                    onChange={(event) =>
                      setDraftCardBackground(event.target.value === 'auto' ? null : event.target.value)
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="#ffffff">White</option>
                    <option value="#000000">Black</option>
                    <option value="#fbf8f3">Cream</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => generateCardPreview(effectiveCardSource, shownCardBackground)}
                  disabled={generatingCard}
                  className="gold-button text-xs disabled:opacity-50"
                >
                  {generatingCard ? 'Generating…' : 'Generate card'}
                </button>
              </div>
            )}

            {/* ---- Pop-up windows (site convention: never expand inline) - */}
            {cropping && !isPublished && (
              <AdminModal
                title={`Crop photo ${shownLineup.indexOf(cropping) + 1}`}
                onClose={() => setCropping(null)}
                maxWidth="max-w-xl"
              >
                <InstagramCropEditor
                  productId={productId}
                  imageUrl={cropping}
                  value={shownCrops[cropping] ?? null}
                  onChange={(next) => setCrop(cropping, next)}
                  onClose={() => setCropping(null)}
                />
              </AdminModal>
            )}

            {showCardModal && cardPreviewUrl && (
              <AdminModal
                title="Generated card"
                onClose={() => setShowCardModal(false)}
                maxWidth="max-w-md"
              >
                <div className="flex flex-col gap-3">
                  {/* Object URL from an ephemeral render — next/image cannot
                      optimize blob: sources, so a plain img is correct here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cardPreviewUrl} alt="Generated card preview" className="block w-full border" style={{ borderColor: 'var(--color-outline-variant)' }} />
                  <p className="text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    Built from the photo marked CARD
                    {lineupDirty ? ' — including unsaved choices' : ''}. Nothing is posted or stored;
                    Prepare builds the real slide.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => generateCardPreview(effectiveCardSource, shownCardBackground)}
                      disabled={generatingCard}
                      className="outline-button text-xs disabled:opacity-50"
                    >
                      {generatingCard ? 'Generating…' : 'Regenerate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCardModal(false)}
                      className="gold-button text-xs"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </AdminModal>
            )}

            {enlargedSlide && (
              <AdminModal
                title={enlargedSlide.label}
                onClose={() => setEnlargedSlide(null)}
                maxWidth="max-w-xl"
              >
                <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
                  <Image
                    src={enlargedSlide.url}
                    alt={enlargedSlide.label}
                    fill
                    sizes="(max-width: 640px) 100vw, 576px"
                    className="object-contain"
                  />
                </div>
              </AdminModal>
            )}

            {showPublishBoth && (
              <SocialPublishBothModal
                productId={productId}
                onClose={() => setShowPublishBoth(false)}
                onDone={() => void load()}
              />
            )}

            {!isPublished && shownExcluded.length > 0 && (
              <div className="mt-4">
                <p
                  className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]"
                  style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                >
                  Not in this post ({shownExcluded.length})
                </p>
                <ul className="flex flex-wrap gap-2">
                  {shownExcluded.map((url) => (
                    <li key={url}>
                      <button
                        type="button"
                        onClick={() => addImage(url)}
                        disabled={shownLineup.length >= 9}
                        aria-label="Add this image to the post"
                        className="relative block h-16 w-16 overflow-hidden border opacity-60 transition-opacity hover:opacity-100 disabled:cursor-not-allowed"
                        style={{ borderColor: 'var(--color-outline-variant)' }}
                      >
                        <Image
                          src={url}
                          alt="Excluded product photo"
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized={url.startsWith('/assets/')}
                        />
                        <span
                          className="absolute inset-x-0 bottom-0 text-center text-[0.6rem] font-bold"
                          style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                        >
                          + Add
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lineupDirty && (
              <p className="mt-2 text-xs" style={{ color: '#8a6400' }}>
                Unsaved image changes. Save the lineup, then Prepare to rebuild the images.
              </p>
            )}
          </div>

          {preview.renditionUrls.length > 0 && !lineupDirty && (
            <div>
              <p
                className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                Prepared for upload · {preview.renditionUrls.length} slide(s) · first is the card
              </p>
              <div className="flex flex-wrap gap-2">
                {preview.renditionUrls.map((url, index) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() =>
                      setEnlargedSlide({
                        url,
                        label: preview.renditionIsCard?.[index]
                          ? `Slide ${index + 1} · generated card`
                          : `Slide ${index + 1}`,
                      })
                    }
                    className="relative h-20 w-20 cursor-zoom-in overflow-hidden border"
                    style={{
                      borderColor: preview.renditionIsCard?.[index]
                        ? 'var(--color-primary)'
                        : 'var(--color-outline-variant)',
                    }}
                    title="Click to view full size"
                  >
                    <Image src={url} alt={`Instagram slide ${index + 1}`} fill sizes="80px" className="object-cover" />
                    {preview.renditionIsCard?.[index] && (
                      <span
                        className="absolute inset-x-0 bottom-0 text-center text-[0.55rem] font-bold uppercase"
                        style={{ background: 'var(--color-primary)', color: '#fff' }}
                      >
                        Card
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <button
              type="button"
              onClick={() => runAction('prepare')}
              disabled={busy !== null || Boolean(preview.blockedReason)}
              className="outline-button text-sm disabled:opacity-50"
            >
              {busy === 'prepare' ? 'Preparing…' : isPublished ? 'Re-prepare' : 'Prepare images & caption'}
            </button>

            {canPublish && !confirmPublish && (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmPublish(true)}
                  disabled={busy !== null}
                  className="gold-button text-sm disabled:opacity-50"
                >
                  Publish to Instagram
                </button>
                <button
                  type="button"
                  onClick={() => setShowPublishBoth(true)}
                  disabled={busy !== null}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  Publish to both…
                </button>
              </>
            )}

            {canPublish && confirmPublish && (
              <>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
                  Publish now? This cannot be edited or deleted afterwards.
                </span>
                <button
                  type="button"
                  onClick={() => runAction('publish')}
                  disabled={busy !== null}
                  className="gold-button text-sm disabled:opacity-50"
                >
                  {busy === 'publish' ? 'Publishing…' : 'Yes, publish'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmPublish(false)}
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                >
                  Cancel
                </button>
              </>
            )}

            {!isPublished && (
              <button
                type="button"
                onClick={() => runAction(preview.current?.queuedAt ? 'unqueue' : 'queue')}
                disabled={busy !== null || Boolean(preview.blockedReason)}
                className="outline-button text-sm disabled:opacity-50"
              >
                {preview.current?.queuedAt ? 'Remove from posting queue' : 'Add to posting queue'}
              </button>
            )}

            {!isPublished && preview.renditionUrls.length > 0 && !confirmDiscard && (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                disabled={busy !== null}
                className="text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                Discard prepared upload
              </button>
            )}

            {!isPublished && confirmDiscard && (
              <>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
                  Delete the prepared slides and caption? Your lineup, crops and card choices are kept.
                </span>
                <button
                  type="button"
                  onClick={discardDraft}
                  disabled={busy !== null}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  {busy === 'discard' ? 'Discarding…' : 'Yes, discard'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
                >
                  Cancel
                </button>
              </>
            )}

            {isPublished && (
              <button
                type="button"
                onClick={removePost}
                disabled={busy !== null}
                className="text-xs font-bold uppercase tracking-wide disabled:opacity-50"
                style={{ color: 'var(--color-error)', fontFamily: 'var(--font-label)' }}
              >
                {busy === 'remove' ? 'Working…' : 'Remove post'}
              </button>
            )}
          </div>

          {preview.current?.queuedAt && !isPublished && (
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              In the posting queue since {new Date(preview.current.queuedAt).toLocaleString()}. The scheduled
              drip publishes approved items oldest first.
            </p>
          )}
        </>
      )}
    </div>
  );
}
