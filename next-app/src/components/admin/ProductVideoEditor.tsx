'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Upload } from 'tus-js-client';
import { formatVideoBytes, formatVideoDuration, validateProductVideoFile } from '@/lib/product-video';

type AdminVideo = {
  cloudflare_uid?: string;
  status: string;
  duration_seconds?: number | null;
  thumbnail_url?: string | null;
  iframe_url?: string | null;
  source_filename?: string | null;
  source_size_bytes?: number | null;
  error_text?: string | null;
};

export interface ProductVideoEditorHandle {
  hasPendingChanges(): boolean;
  commit(productId: string, posterUrl: string | null): Promise<{ ok: boolean; error?: string; committed?: boolean }>;
  discard(): Promise<void>;
}

interface Props {
  productId: string;
  loadExisting: boolean;
  collapsed: boolean;
  onToggle(): void;
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const finish = () => { URL.revokeObjectURL(url); video.remove(); };
    const timeout = window.setTimeout(() => { finish(); reject(new Error('The video duration could not be read.')); }, 15_000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => { window.clearTimeout(timeout); const duration = video.duration; finish(); resolve(duration); };
    video.onerror = () => { window.clearTimeout(timeout); finish(); reject(new Error('This video could not be opened. Try MOV or MP4.')); };
    video.src = url;
  });
}

const ProductVideoEditor = forwardRef<ProductVideoEditorHandle, Props>(function ProductVideoEditor(
  { productId, loadExisting, collapsed, onToggle },
  ref,
) {
  const [current, setCurrent] = useState<AdminVideo | null>(null);
  const [candidate, setCandidate] = useState<AdminVideo | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [stagedRemove, setStagedRemove] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const uploadRef = useRef<Upload | null>(null);

  useEffect(() => {
    if (!loadExisting) return;
    let live = true;
    void fetch(`/api/admin/product-video/${encodeURIComponent(productId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? 'Could not load the product video.');
        if (live) setCurrent(data.video ?? null);
      })
      .catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : 'Could not load the product video.'); });
    return () => { live = false; };
  }, [loadExisting, productId]);

  useEffect(() => {
    if (!uploadId || busy || candidate?.status === 'ready' || candidate?.status === 'failed') return;
    const timer = window.setInterval(() => {
      void fetch(`/api/admin/product-video/status?uploadId=${encodeURIComponent(uploadId)}`, { cache: 'no-store' })
        .then(async (response) => {
          const data = await response.json().catch(() => null);
          if (!response.ok) throw new Error(data?.error ?? 'Could not check processing.');
          setCandidate(data.video);
          if (data.video?.status === 'failed') setError(data.video.error_text ?? 'Cloudflare could not process this video.');
        })
        .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not check processing.'));
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [busy, candidate?.status, uploadId]);

  const discardCandidate = useCallback(async () => {
    await uploadRef.current?.abort().catch(() => undefined);
    uploadRef.current = null;
    if (uploadId) {
      const response = await fetch(`/api/admin/product-video/${encodeURIComponent(productId)}?uploadId=${encodeURIComponent(uploadId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? 'Cloudflare did not accept the video cancellation.');
      }
    }
    setCandidate(null);
    setUploadId(null);
    setProgress(0);
    setShowPreview(false);
  }, [productId, uploadId]);

  async function chooseFile(file: File) {
    setError(null);
    setShowPreview(false);
    if (candidate || uploadId) {
      try { await discardCandidate(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not remove the previous draft upload.'); return; }
    }
    let duration: number;
    try { duration = await readDuration(file); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read the video.'); return; }
    const errors = validateProductVideoFile({ size: file.size, durationSeconds: duration, type: file.type, name: file.name });
    if (errors.length) { setError(errors[0]); return; }
    setCandidate({ status: 'uploading', duration_seconds: duration, source_filename: file.name, source_size_bytes: file.size });
    setBusy(true);
    let sessionId: string | null = null;
    const upload = new Upload(file, {
      endpoint: '/api/admin/product-video/upload',
      chunkSize: 5 * 1024 * 1024,
      retryDelays: [0, 1_000, 3_000, 5_000, 10_000],
      metadata: {
        filename: file.name,
        filetype: file.type || 'video/quicktime',
        productId,
        clientDurationSeconds: String(duration),
      },
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,
      onAfterResponse(request, response) {
        if (request.getMethod() === 'POST') sessionId = response.getHeader('Upload-Session-Id') ?? null;
      },
      onProgress(bytesSent, bytesTotal) { setProgress(bytesTotal ? Math.round((bytesSent / bytesTotal) * 100) : 0); },
      onError(cause) { setBusy(false); setError(cause.message || 'Upload interrupted. Choose the same file to resume.'); },
      onSuccess() {
        setBusy(false);
        setProgress(100);
        setCandidate((value) => value ? { ...value, status: 'processing' } : value);
        if (sessionId) {
          setUploadId(sessionId);
          return;
        }
        const uid = upload.url ? new URL(upload.url).pathname.split('/').filter(Boolean).pop() : null;
        if (!uid) { setError('Upload finished, but its save token was not returned. Remove it and retry.'); return; }
        void fetch(`/api/admin/product-video/status?uid=${encodeURIComponent(uid)}`, { cache: 'no-store' })
          .then(async (response) => {
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.video?.id) throw new Error(data?.error ?? 'Could not recover the resumed upload.');
            setUploadId(data.video.id);
            setCandidate(data.video);
          })
          .catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not recover the resumed upload.'));
      },
    });
    uploadRef.current = upload;
    const previous = await upload.findPreviousUploads().catch(() => []);
    if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
    upload.start();
  }

  useImperativeHandle(ref, () => ({
    hasPendingChanges: () => Boolean(uploadId || stagedRemove),
    async commit(savedProductId, posterUrl) {
      if (!uploadId && !stagedRemove) return { ok: true };
      if (busy || candidate?.status === 'uploading') return { ok: false, error: 'Wait for the video upload to finish before saving.' };
      const response = await fetch(`/api/admin/product-video/${encodeURIComponent(savedProductId)}/commit`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(stagedRemove ? { remove: true } : { uploadId, posterUrl }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) return { ok: false, error: data?.error ?? 'Could not save the product video.', committed: Boolean(data?.committed) };
      setCurrent(data.video ?? null); setCandidate(null); setUploadId(null); setStagedRemove(false); setProgress(0);
      return { ok: true };
    },
    async discard() {
      if (candidate || uploadId) await discardCandidate();
      setStagedRemove(false);
    },
  }), [busy, candidate, discardCandidate, stagedRemove, uploadId]);

  const shown = candidate ?? (stagedRemove ? null : current);
  const statusText = busy ? `Uploading ${progress}%` : shown?.status === 'ready' ? 'Ready' : shown?.status === 'processing' ? 'Processing on Cloudflare' : shown?.status === 'failed' ? 'Processing failed' : shown ? shown.status : 'No video attached';

  return (
    <div className="product-editor-panel" style={{ background: '#f2f0ff', borderColor: '#d9d4ff' }} data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="editor-collapse-header flex items-start gap-3" role="button" tabIndex={0} aria-expanded={!collapsed}
        onClick={onToggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onToggle(); } }}>
        <div className="product-editor-icon" style={{ background: '#ddd6fe', color: '#6d28d9' }}><span className="material-symbols-outlined" aria-hidden="true">videocam</span></div>
        <div><h3 className="product-editor-section-title">Product video</h3><p className={`product-editor-section-copy${collapsed ? ' hidden' : ''}`}>One 5–15 second MOV or MP4, up to 150 MB. Uploads resume on spotty mobile connections.</p></div>
        <span className="material-symbols-outlined ml-auto self-center" style={{ color: '#6d28d9' }} aria-hidden="true">{collapsed ? 'expand_more' : 'expand_less'}</span>
      </div>
      <div className="grid gap-3">
        <div className="rounded-xl border bg-white p-4" style={{ borderColor: '#d9d4ff' }}>
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{statusText}</strong>{shown?.duration_seconds != null && <span className="text-xs">{formatVideoDuration(Number(shown.duration_seconds))}</span>}</div>
          {shown?.source_filename && <p className="mt-1 text-xs text-slate-600">{shown.source_filename}{shown.source_size_bytes ? ` · ${formatVideoBytes(Number(shown.source_size_bytes))}` : ''}</p>}
          {busy && <div className="mt-3 h-2 overflow-hidden rounded bg-slate-200"><div className="h-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} /></div>}
          {candidate && current && <p className="mt-2 text-xs font-semibold text-violet-700">This upload will replace the saved video only when you save the listing.</p>}
          {stagedRemove && <p className="mt-2 text-xs font-semibold text-amber-700">The saved video will be removed when you save the listing.</p>}
          {error && <p className="mt-2 text-sm font-semibold text-red-700" role="alert">{error}</p>}
          {showPreview && shown?.iframe_url && <div className="mt-3 aspect-video overflow-hidden rounded-lg bg-black"><iframe src={shown.iframe_url} title="Product video preview" className="h-full w-full" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-lg bg-violet-700 px-3 py-2 text-sm font-bold text-white"><input type="file" accept="video/quicktime,video/mp4,video/x-m4v,.mov,.mp4,.m4v" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void chooseFile(file); }} />Choose video</label>
            <label className="cursor-pointer rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-bold text-violet-800"><input type="file" accept="video/*" capture="environment" className="sr-only" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void chooseFile(file); }} />Record video</label>
            {shown?.iframe_url && <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold" onClick={() => setShowPreview((value) => !value)}>{showPreview ? 'Hide preview' : 'Preview'}</button>}
            {(candidate || uploadId) && <button type="button" className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-700" onClick={() => { void discardCandidate().catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not remove the upload.')); }}>Remove draft</button>}
            {current && !candidate && !stagedRemove && <button type="button" className="rounded-lg border border-red-300 px-3 py-2 text-sm font-bold text-red-700" onClick={() => { setStagedRemove(true); setShowPreview(false); }}>Remove on save</button>}
            {stagedRemove && <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold" onClick={() => setStagedRemove(false)}>Undo removal</button>}
          </div>
        </div>
      </div>
    </div>
  );
});

export default ProductVideoEditor;
