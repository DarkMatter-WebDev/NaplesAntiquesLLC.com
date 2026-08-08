'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import InstagramCropEditor, { type CropRect } from './InstagramCropEditor';
import {
  hasSquareCanvas,
  SocialSquareFramingImage,
  type SocialSquareFraming,
} from './SocialSquareFramingPreview';
import AdminModal from './AdminModal';
import PreparedSlideViewer from './PreparedSlideViewer';
import SocialPublishBothModal from './SocialPublishBothModal';
import SocialScheduleModal from './SocialScheduleModal';
import { getSocialWorkflowStage } from '@/lib/social-workflow';
import SocialCaptionOpeningEditor, {
  replaceSocialCaptionOpening,
} from './SocialCaptionOpeningEditor';

interface PreviewResponse {
  caption: string;
  captionLength: number;
  captionOpening: string;
  captionOpeningGeneratedByAi: boolean;
  captionOpeningIsDefault: boolean;
  captionOpeningPrepared: boolean;
  imageCount: number;
  imageUrls: string[];
  renditionUrls: string[];
  /** Per-slide: whether it is the generated card rather than a photo. */
  renditionIsCard: boolean[];
  /** Ordered source images that will be posted. */
  lineup: string[];
  /** Renderer-matched contain-to-square framing for each source image. */
  imageFraming: Record<string, SocialSquareFraming>;
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
    scheduledFor: string | null;
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
  const [busy, setBusy] = useState<null | 'prepare' | 'publish' | 'queue' | 'remove' | 'forget' | 'discard' | 'status'>(null);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<{
    text: string;
    tone: 'success' | 'neutral';
  } | null>(null);
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
  // These are deliberate navigation states, not unsaved data. A review only
  // exposes its final output until the owner explicitly chooses to edit it.
  const [editingSetup, setEditingSetup] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  // The thumbnail the single action toolbar operates on.
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  // Prepared-slide index opened in the shared full-size review pop-up.
  const [enlargedSlideIndex, setEnlargedSlideIndex] = useState<number | null>(null);
  const [showPublishBoth, setShowPublishBoth] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [copying, setCopying] = useState(false);
  const [captionOpeningDirection, setCaptionOpeningDirection] = useState('');
  const [captionOpeningDraft, setCaptionOpeningDraft] = useState('');
  const [captionOpeningCanRegenerate, setCaptionOpeningCanRegenerate] = useState(false);
  const [generatingCaptionOpening, setGeneratingCaptionOpening] = useState(false);
  const autoStatusCheckedProduct = useRef<string | null>(null);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 6000);
  };

  const load = useCallback(async ({ preserveCaptionDraft = false }: { preserveCaptionDraft?: boolean } = {}) => {
    try {
      const res = await fetch('/api/admin/instagram/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not load the Instagram preview.');
      const nextPreview = data as PreviewResponse;
      setPreview(nextPreview);
      if (!preserveCaptionDraft) {
        setCaptionOpeningDraft(nextPreview.captionOpening);
        setCaptionOpeningCanRegenerate(
          nextPreview.captionOpeningGeneratedByAi || !nextPreview.captionOpeningIsDefault,
        );
      }
      return nextPreview;
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not load the Instagram preview.', false);
      return null;
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    // Wrapped so the first setState lands after an await, not synchronously in
    // the effect body (react-hooks/set-state-in-effect).
    const run = async () => {
      if (autoStatusCheckedProduct.current === productId) return;
      autoStatusCheckedProduct.current = productId;
      const initial = await load();
      if (initial?.current?.syncState !== 'published') return;

      // Reconcile once whenever a published manager opens. The manual button
      // remains available when Meta is temporarily unreachable.
      const res = await fetch('/api/admin/instagram/refresh-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      }).catch(() => null);
      if (!res?.ok) return;
      const result = await res.json().catch(() => null);
      if (result?.changed) {
        await load();
        setStatusFeedback({ text: 'Instagram status updated to Removed.', tone: 'success' });
      }
    };
    void run();
  }, [load, productId]);

  const refreshRemoteStatus = async () => {
    setBusy('status');
    setStatusFeedback(null);
    try {
      const res = await fetch('/api/admin/instagram/refresh-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) {
        setStatusFeedback({
          text:
            result?.reason === 'not_connected'
              ? 'Instagram isn’t connected, so the saved status was left unchanged.'
              : 'Instagram couldn’t confirm this post, so the saved status was left unchanged.',
          tone: 'neutral',
        });
        return;
      }
      await load();
      setStatusFeedback({
        text: result.changed ? 'Instagram status updated to Removed.' : 'Instagram status is up to date.',
        tone: 'success',
      });
    } catch {
      setStatusFeedback({
        text: 'Instagram couldn’t be reached, so the saved status was left unchanged.',
        tone: 'neutral',
      });
    } finally {
      setBusy(null);
    }
  };

  const generateCaptionOpening = async () => {
    setGeneratingCaptionOpening(true);
    try {
      const res = await fetch('/api/admin/instagram/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          generateCaptionOpening: true,
          captionOpeningDirection,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Could not generate an AI opening.');
      const nextPreview = data as PreviewResponse;
      setPreview(nextPreview);
      setCaptionOpeningDraft(nextPreview.captionOpening);
      setCaptionOpeningCanRegenerate(true);
      if (nextPreview.warnings.length > 0) showNotice(nextPreview.warnings.join(' '), false);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not generate an AI opening.', false);
    } finally {
      setGeneratingCaptionOpening(false);
    }
  };

  const runAction = async (
    action: 'prepare' | 'publish' | 'queue' | 'unqueue',
    scheduledFor?: string,
  ) => {
    setBusy(action === 'unqueue' ? 'queue' : action);
    try {
      const res = await fetch('/api/admin/instagram/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          action,
          ...(action === 'prepare' && captionOpeningDraft
            ? { captionOpening: captionOpeningDraft }
            : {}),
          ...(action === 'queue' && scheduledFor ? { scheduledFor } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || data?.error || 'That action failed.');
      showNotice(data?.message ?? 'Done.', true);
      if (data?.warnings?.length) showNotice(data.warnings.join(' '), true);
      setConfirmPublish(false);
      await load();
      return true;
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'That action failed.', false);
      return false;
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
      await load({ preserveCaptionDraft: true });
      return true;
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Could not save the image lineup.', false);
      return false;
    } finally {
      setSavingLineup(false);
    }
  };

  const state = preview?.current?.syncState ?? null;
  const isPublished = state === 'published';
  const captionOpeningDirty = preview
    ? captionOpeningDraft !== preview.captionOpening || !preview.captionOpeningPrepared
    : false;
  const displayedCaption = preview
    ? replaceSocialCaptionOpening(preview.caption, captionOpeningDraft)
    : '';

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
  const hasPreparedUpload = Boolean(preview?.renditionUrls.length) && !lineupDirty;
  const workflowStage = getSocialWorkflowStage({
    isPublished,
    lineupDirty,
    hasPreparedUpload,
    captionOpeningDirty,
    isEditingSetup: editingSetup,
    isEditingCaption: editingCaption,
  });
  const canPublish = state === 'review' && workflowStage === 'review' && !preview?.blockedReason;
  const canManageQueue = workflowStage === 'review';
  const selectedIndex = selectedUrl ? shownLineup.indexOf(selectedUrl) : -1;
  const hasLocalCaptionChanges = Boolean(
    preview && (captionOpeningDraft !== preview.captionOpening || captionOpeningDirection.trim() || editingCaption),
  );
  const canResetSetupChanges = lineupDirty || editingSetup || hasLocalCaptionChanges;

  const resetSetupChanges = () => {
    setDraftLineup(null);
    setDraftCrops(null);
    setCropping(null);
    setDraftCardSource(undefined);
    setDraftCardBackground(undefined);
    setSelectedUrl(null);
    setCaptionOpeningDirection('');
    setCaptionOpeningDraft(preview?.captionOpening ?? '');
    setCaptionOpeningCanRegenerate(
      Boolean(preview?.captionOpeningGeneratedByAi || !preview?.captionOpeningIsDefault),
    );
    setEditingSetup(false);
    setEditingCaption(false);
  };

  // A saved lineup is a pipeline detail, not a second task for the owner.
  // This one deliberate action persists any local curation, then creates the
  // immutable prepared upload from precisely that saved setup and caption.
  const prepareCurrentSetup = async () => {
    if (busy !== null || savingLineup || preview?.blockedReason) return;
    if (lineupDirty) {
      const saved = await saveLineup(shownLineup, shownCrops, draftCardSource, draftCardBackground);
      if (!saved) return;
    }
    const prepared = await runAction('prepare');
    if (prepared) {
      setEditingSetup(false);
      setEditingCaption(false);
    }
  };

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
            className="outline-button social-danger-button w-fit text-xs disabled:opacity-50"
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

          {isPublished && (
            <button
              type="button"
              onClick={refreshRemoteStatus}
              disabled={busy !== null}
              className="outline-button w-fit text-xs disabled:opacity-50"
            >
              {busy === 'status' ? 'Checking Instagram…' : 'Refresh Instagram status'}
            </button>
          )}

          {statusFeedback && (
            <p
              className="text-xs"
              role="status"
              style={{
                color:
                  statusFeedback.tone === 'success'
                    ? 'var(--color-primary)'
                    : 'var(--color-on-surface-variant)',
              }}
            >
              {statusFeedback.text}
            </p>
          )}

          {!isPublished && (
            <div
              className="border px-3 py-2"
              style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface-container-low)' }}
            >
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}>
                {workflowStage === 'curate'
                  ? 'Step 1 of 3 · curate photos and card'
                  : workflowStage === 'prepare' || workflowStage === 'update'
                    ? 'Step 2 of 3 · prepare the upload'
                    : workflowStage === 'review'
                      ? 'Step 3 of 3 · review before publishing'
                      : 'Published'}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                {workflowStage === 'curate'
                  ? 'Finish the photo setup, then use Save & prepare. Publishing stays unavailable until that completes.'
                  : workflowStage === 'review'
                    ? 'Review the prepared slides and caption. Queue or publish only when this review is current.'
                    : workflowStage === 'update'
                      ? 'The caption has changed. Update the prepared upload before reviewing, queueing, or publishing.'
                      : 'Your saved photo setup is ready. Prepare once to build the final slides and lock the caption for review.'}
              </p>
            </div>
          )}

          {(workflowStage === 'curate' || workflowStage === 'update') && (
            <SocialCaptionOpeningEditor
              directionValue={captionOpeningDirection}
              onDirectionChange={setCaptionOpeningDirection}
              value={captionOpeningDraft}
              onChange={setCaptionOpeningDraft}
              onGenerate={generateCaptionOpening}
              generating={generatingCaptionOpening}
              canRegenerate={captionOpeningCanRegenerate}
              disabled={isPublished || busy !== null}
              needsPrepare={captionOpeningDirty}
            />
          )}

          {workflowStage !== 'prepare' && <div>
            <p
              className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
            >
              Caption preview · {displayedCaption.length} / 2200 characters
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
              {displayedCaption}
            </pre>
            <p className="mt-1 text-[0.68rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
              Captions cannot be edited after publishing, and Instagram&rsquo;s API cannot delete posts.
              Check this carefully.
            </p>
          </div>}

          {/* ---- Image lineup editor ------------------------------------ */}
          {workflowStage === 'curate' && <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p
                className="text-[0.65rem] font-bold uppercase tracking-[0.2em]"
                style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
              >
                Photos · {shownLineup.length} of max 9
              </p>
              {!lineupDirty && !editingSetup && !captionOpeningDirty && !editingCaption && (
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
                      <SocialSquareFramingImage
                        imageUrl={url}
                        crop={shownCrops[url]}
                        framing={preview.imageFraming[url]}
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
                      {hasSquareCanvas(preview.imageFraming[url], shownCrops[url]) && (
                        <span
                          className="absolute bottom-0 left-0 px-1 text-[0.55rem] font-bold uppercase"
                          style={{ background: '#1c1815', color: '#fff' }}
                          title="Prepared framing preserves the full image on a square canvas"
                        >
                          Canvas
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
                      className="outline-button social-danger-button text-xs"
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
              </div>
            )}
            {/* ---- Pop-up windows (site convention: never expand inline) - */}
            {cropping && !isPublished && (
              <AdminModal
                title={`Crop photo ${shownLineup.indexOf(cropping) + 1}`}
                onClose={() => setCropping(null)}
                maxWidth="max-w-3xl"
              >
                <InstagramCropEditor
                  productId={productId}
                  imageUrl={cropping}
                  value={shownCrops[cropping] ?? null}
                  framing={preview.imageFraming[cropping]}
                  onChange={(next) => setCrop(cropping, next)}
                  onClose={() => setCropping(null)}
                />
              </AdminModal>
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
                Photo setup has changed. Save &amp; prepare to create a fresh upload from these choices.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
              <p className="mr-auto text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                Save &amp; prepare uses the photo marked CARD to create the final card as slide 1. You will review that finished first slide before publishing.
              </p>
              <button
                type="button"
                onClick={() => void prepareCurrentSetup()}
                disabled={savingLineup || busy !== null || shownLineup.length === 0}
                className="gold-button text-sm disabled:opacity-50"
              >
                {savingLineup ? 'Saving setup…' : busy === 'prepare' ? 'Preparing…' : 'Save & prepare'}
              </button>
              {canResetSetupChanges && (
                <button
                  type="button"
                  onClick={resetSetupChanges}
                  className="outline-button text-sm"
                >
                  Reset changes
                </button>
              )}
            </div>
          </div>}

          {enlargedSlideIndex !== null && (
            <PreparedSlideViewer
              slides={preview.renditionUrls}
              renditionIsCard={preview.renditionIsCard}
              initialIndex={enlargedSlideIndex}
              onClose={() => setEnlargedSlideIndex(null)}
            />
          )}

          {showPublishBoth && (
            <SocialPublishBothModal
              productId={productId}
              sourceChannel="instagram"
              onClose={() => setShowPublishBoth(false)}
              onDone={() => void load()}
            />
          )}

          {showSchedule && (
            <SocialScheduleModal
              channels={['instagram']}
              initialScheduledFor={{ instagram: preview.current?.scheduledFor ?? null }}
              title={preview.current?.queuedAt ? 'Change Instagram posting time' : 'Schedule Instagram post'}
              confirmLabel={preview.current?.queuedAt ? 'Save new time' : 'Schedule post'}
              onClose={() => setShowSchedule(false)}
              onConfirm={async (values) => runAction('queue', values.instagram)}
            />
          )}

          {workflowStage === 'review' && preview.renditionUrls.length > 0 && !lineupDirty && (
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
                    onClick={() => setEnlargedSlideIndex(index)}
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
            {workflowStage === 'prepare' && (
              <>
                <button
                  type="button"
                  onClick={() => setEditingSetup(true)}
                  disabled={busy !== null}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  Edit photo &amp; caption setup
                </button>
                <button
                  type="button"
                  onClick={() => void prepareCurrentSetup()}
                  disabled={busy !== null || savingLineup || Boolean(preview.blockedReason)}
                  className="gold-button text-sm disabled:opacity-50"
                >
                  {busy === 'prepare' ? 'Preparing…' : 'Prepare images & caption'}
                </button>
              </>
            )}

            {workflowStage === 'update' && (
              <button
                type="button"
                onClick={() => void prepareCurrentSetup()}
                disabled={busy !== null || Boolean(preview.blockedReason)}
                className="gold-button text-sm disabled:opacity-50"
              >
                {busy === 'prepare' ? 'Updating…' : 'Update prepared upload'}
              </button>
            )}

            {workflowStage === 'published' && (
              <button
                type="button"
                onClick={() => void prepareCurrentSetup()}
                disabled={busy !== null || savingLineup || Boolean(preview.blockedReason)}
                className="outline-button text-sm disabled:opacity-50"
              >
                {busy === 'prepare' ? 'Preparing…' : 'Re-prepare'}
              </button>
            )}

            {workflowStage === 'review' && (
              <>
                <button
                  type="button"
                  onClick={() => setEditingCaption(true)}
                  disabled={busy !== null}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  Edit caption
                </button>
                <button
                  type="button"
                  onClick={() => setEditingSetup(true)}
                  disabled={busy !== null}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  Edit photos &amp; card
                </button>
              </>
            )}

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
                  className="outline-button text-sm"
                >
                  Cancel
                </button>
              </>
            )}

            {!isPublished && canManageQueue && !preview.current?.queuedAt && (
              <button
                type="button"
                onClick={() => setShowSchedule(true)}
                disabled={busy !== null || Boolean(preview.blockedReason)}
                className="outline-button text-sm disabled:opacity-50"
              >
                Schedule to posting queue
              </button>
            )}

            {!isPublished && canManageQueue && preview.current?.queuedAt && (
              <>
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  disabled={busy !== null || Boolean(preview.blockedReason)}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  Change scheduled time
                </button>
                <button
                  type="button"
                  onClick={() => void runAction('unqueue')}
                  disabled={busy !== null}
                  className="outline-button social-danger-button text-sm disabled:opacity-50"
                >
                  {busy === 'queue' ? 'Removing…' : 'Remove from posting queue'}
                </button>
              </>
            )}

            {workflowStage === 'review' && !confirmDiscard && (
              <button
                type="button"
                onClick={() => setConfirmDiscard(true)}
                disabled={busy !== null}
                className="outline-button social-danger-button text-sm disabled:opacity-50"
              >
                Discard prepared upload
              </button>
            )}

            {workflowStage === 'review' && confirmDiscard && (
              <>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-error)' }}>
                  Delete the prepared slides and caption? Your lineup, crops and card choices are kept.
                </span>
                <button
                  type="button"
                  onClick={discardDraft}
                  disabled={busy !== null}
                  className="outline-button social-danger-button text-sm disabled:opacity-50"
                >
                  {busy === 'discard' ? 'Discarding…' : 'Yes, discard'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="outline-button text-sm"
                >
                  Cancel
                </button>
              </>
            )}

            {isPublished && !manualDelete && (
              <>
                <button
                  type="button"
                  onClick={removePost}
                  disabled={busy !== null}
                  className="outline-button social-danger-button text-sm disabled:opacity-50"
                >
                  {busy === 'remove' ? 'Working…' : 'Remove post'}
                </button>
                <button
                  type="button"
                  onClick={() => setManualDelete({ permalink: preview.current?.permalink ?? null })}
                  disabled={busy !== null}
                  className="outline-button text-sm disabled:opacity-50"
                >
                  Already removed on Instagram
                </button>
              </>
            )}
          </div>

          {preview.current?.queuedAt && !isPublished && (
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Scheduled for {preview.current.scheduledFor
                ? new Date(preview.current.scheduledFor).toLocaleString([], {
                    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York',
                  })
                : 'a time that still needs to be selected'}. Added to the queue{' '}
              {new Date(preview.current.queuedAt).toLocaleString([], {
                dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York',
              })} ET.
            </p>
          )}
        </>
      )}
    </div>
  );
}
