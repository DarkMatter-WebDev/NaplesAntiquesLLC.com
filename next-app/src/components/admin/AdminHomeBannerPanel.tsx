'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BANNER_MAX_CHARS,
  BANNER_SAFE_CHARS,
  DEFAULT_HOME_BANNER,
  HOME_BANNER_LINK_OPTIONS,
  bannerLength,
  resolveHomeBanner,
  type HomeBannerSettings,
} from '@/lib/home-banner';

/**
 * The homepage announcement strip (mockup approved 2026-08-25).
 *
 * Explicit Save, like the store-hours panel: copy edits span several fields
 * and the homepage should never render half of one.
 *
 * The character budget is the load-bearing control here — the strip is
 * `nowrap`, so over-long copy overflows on a phone instead of wrapping. Over
 * `BANNER_SAFE_CHARS` warns; over `BANNER_MAX_CHARS` blocks the save (the API
 * enforces the same ceiling, so a hand-edited row cannot bypass it either).
 */
export default function AdminHomeBannerPanel() {
  const [banner, setBanner] = useState<HomeBannerSettings>(DEFAULT_HOME_BANNER);
  const [savedBanner, setSavedBanner] = useState<HomeBannerSettings>(DEFAULT_HOME_BANNER);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [previewEs, setPreviewEs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/home-banner');
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Failed to load the banner.');
        if (!cancelled && data?.banner) {
          setBanner(data.banner);
          setSavedBanner(data.banner);
          setIsDefault(Boolean(data.isDefault));
        }
      } catch (err) {
        if (!cancelled) setNotice({ text: err instanceof Error ? err.message : 'Failed to load the banner.', ok: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const patch = (next: Partial<HomeBannerSettings>) => setBanner((prev) => ({ ...prev, ...next }));

  const enLength = bannerLength(banner.eyebrowEn, banner.messageEn);
  const esLength = bannerLength(banner.eyebrowEs, banner.messageEs);
  const enOver = enLength > BANNER_MAX_CHARS;
  const esOver = esLength > BANNER_MAX_CHARS;
  const noEnglishCopy = banner.enabled && banner.eyebrowEn.trim() === '' && banner.messageEn.trim() === '';
  const blocked = enOver || esOver || noEnglishCopy;

  const dirty = useMemo(
    () => JSON.stringify(banner) !== JSON.stringify(savedBanner) || isDefault,
    [banner, savedBanner, isDefault],
  );
  // resolveHomeBanner is pure and client-safe — this is EXACTLY what the
  // homepage will render, including the ES-falls-back-to-EN behavior.
  const preview = useMemo(() => resolveHomeBanner(banner, previewEs), [banner, previewEs]);

  const save = async () => {
    if (blocked || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/home-banner', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ banner }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to save the banner.');
      setSavedBanner(data.banner ?? banner);
      setBanner(data.banner ?? banner);
      setIsDefault(false);
      setNotice({ text: 'Banner saved. The homepage updates within a few minutes as it regenerates.', ok: true });
      window.setTimeout(() => setNotice(null), 6000);
    } catch (err) {
      setNotice({ text: err instanceof Error ? err.message : 'Failed to save the banner.', ok: false });
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  const textInputStyle = (over: boolean, near: boolean) => ({
    width: '100%',
    border: `1px solid ${over ? 'var(--color-error)' : near ? '#ba7517' : 'var(--color-outline-variant)'}`,
    padding: '0.375rem 0.5rem',
    fontSize: '0.85rem',
    boxSizing: 'border-box' as const,
    background: disabled ? 'var(--color-surface-variant, #f6f5f1)' : '#fff',
    color: 'var(--color-on-surface)',
  });

  const counter = (length: number, label: string) => {
    const over = length > BANNER_MAX_CHARS;
    const near = length > BANNER_SAFE_CHARS;
    return (
      <div
        className="mt-1 text-[0.7rem]"
        style={{ color: over ? 'var(--color-error)' : near ? '#854f0b' : 'var(--color-on-surface-variant)' }}
      >
        {length} / {BANNER_SAFE_CHARS} characters
        {over && ` — too long, this will overflow on a 320px phone (hard limit ${BANNER_MAX_CHARS})`}
        {!over && near && ' — over the measured safe width; check a narrow phone'}
        {length === 0 && label === 'Spanish' && ' — using the English text'}
      </div>
    );
  };

  const localeFields = (localeLabel: 'English' | 'Spanish') => {
    const isEsFields = localeLabel === 'Spanish';
    const eyebrow = isEsFields ? banner.eyebrowEs : banner.eyebrowEn;
    const message = isEsFields ? banner.messageEs : banner.messageEn;
    const length = isEsFields ? esLength : enLength;
    const over = length > BANNER_MAX_CHARS;
    const near = !over && length > BANNER_SAFE_CHARS;
    return (
      <div>
        <div
          className="mb-1.5 text-[0.65rem] uppercase"
          style={{ letterSpacing: '0.06em', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
        >
          {localeLabel}
          {isEsFields && (
            <span style={{ textTransform: 'none', letterSpacing: 0 }}> — leave blank to use the English text</span>
          )}
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-0.5 block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Eyebrow
            </label>
            <input
              type="text"
              value={eyebrow}
              disabled={disabled}
              maxLength={80}
              onChange={(event) => patch(isEsFields ? { eyebrowEs: event.target.value } : { eyebrowEn: event.target.value })}
              style={textInputStyle(over, near)}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Message
            </label>
            <input
              type="text"
              value={message}
              disabled={disabled}
              maxLength={80}
              onChange={(event) => patch(isEsFields ? { messageEs: event.target.value } : { messageEn: event.target.value })}
              style={textInputStyle(over, near)}
            />
          </div>
        </div>
        {counter(length, localeLabel)}
      </div>
    );
  };

  return (
    <section className="mt-6 border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
        >
          Homepage Banner
        </h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          The promo strip under the header on the homepage. Turn it off, change the wording, or stop
          it linking anywhere.
        </p>
      </div>
      <div className="p-5 flex flex-col gap-4">
        {notice && (
          <div
            className="px-3 py-2 text-xs font-medium"
            role="status"
            style={{
              background: notice.ok ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'color-mix(in srgb, var(--color-error) 10%, transparent)',
              border: `1px solid ${notice.ok ? 'color-mix(in srgb, var(--color-primary) 28%, transparent)' : 'color-mix(in srgb, var(--color-error) 28%, transparent)'}`,
              color: notice.ok ? 'var(--color-primary)' : 'var(--color-error)',
              fontFamily: 'var(--font-label)',
            }}
          >
            {notice.text}
          </div>
        )}

        {isDefault && !loading && (
          <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
            Showing the built-in banner — nothing has been saved yet.
          </p>
        )}

        <label className="flex items-start gap-3 text-sm" style={{ color: 'var(--color-on-surface)', cursor: disabled ? 'default' : 'pointer' }}>
          <input
            type="checkbox"
            checked={banner.enabled}
            disabled={disabled}
            onChange={(event) => patch({ enabled: event.target.checked })}
            className="mt-0.5"
            style={{ accentColor: '#a98208', width: '1.05rem', height: '1.05rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
          />
          <span>
            <span className="font-bold">Show the banner</span>
            <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Off: the homepage hero starts at the carousel, with no strip.
            </span>
          </span>
        </label>

        {localeFields('English')}
        {localeFields('Spanish')}

        {noEnglishCopy && (
          <p className="text-xs" style={{ color: 'var(--color-error)' }}>
            Enter English banner text, or switch the banner off.
          </p>
        )}

        <label className="flex items-start gap-3 text-sm" style={{ color: 'var(--color-on-surface)', cursor: disabled ? 'default' : 'pointer' }}>
          <input
            type="checkbox"
            checked={banner.linkEnabled}
            disabled={disabled}
            onChange={(event) => patch({ linkEnabled: event.target.checked })}
            className="mt-0.5"
            style={{ accentColor: '#a98208', width: '1.05rem', height: '1.05rem', cursor: disabled ? 'not-allowed' : 'pointer' }}
          />
          <span>
            <span className="font-bold">Make the banner a link</span>
            <span className="block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Off: the strip still shows, but it isn’t clickable and the → arrow is hidden.
            </span>
          </span>
        </label>

        {banner.linkEnabled && (
          <div style={{ maxWidth: '18rem' }}>
            <label className="mb-0.5 block text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Links to
            </label>
            <select
              value={banner.linkPath}
              disabled={disabled}
              onChange={(event) => patch({ linkPath: event.target.value })}
              style={{
                width: '100%',
                border: '1px solid var(--color-outline-variant)',
                padding: '0.375rem 0.5rem',
                fontSize: '0.85rem',
                background: '#fff',
                color: 'var(--color-on-surface)',
                boxSizing: 'border-box',
              }}
            >
              {HOME_BANNER_LINK_OPTIONS.map((option) => (
                <option key={option.path} value={option.path}>
                  {option.labelEn} ({option.path})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <span
              className="text-[0.65rem] uppercase"
              style={{ letterSpacing: '0.06em', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
            >
              Preview
            </span>
            <button
              type="button"
              onClick={() => setPreviewEs((prev) => !prev)}
              className="text-[0.7rem] underline"
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              {previewEs ? 'Show English' : 'Show Spanish'}
            </button>
          </div>
          {preview ? (
            <div
              className="flex items-center justify-center"
              style={{ background: '#1a1c1c', gap: '0 0.75rem', padding: '0.625rem 1rem' }}
            >
              {preview.fragments.map((fragment, index) => (
                <span key={fragment} className="flex items-center" style={{ gap: '0 0.75rem' }}>
                  {index > 0 && <span style={{ color: 'rgba(233, 195, 73, 0.45)', fontSize: '0.7rem' }}>·</span>}
                  <span
                    style={{
                      color: '#e9c349',
                      fontFamily: 'var(--font-label)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.22em',
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {fragment}
                  </span>
                </span>
              ))}
              {preview.href && <span style={{ color: '#e9c349', fontSize: '0.7rem' }}>→</span>}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              The banner is switched off — nothing renders on the homepage.
            </p>
          )}
          <p className="mt-1.5 text-[0.7rem]" style={{ color: 'var(--color-on-surface-variant)' }}>
            {previewEs ? 'Spanish' : 'English'} shown
            {preview?.href ? ` · links to ${preview.href}` : ''}. Actual size varies with screen width.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={disabled || blocked || !dirty}
            className="px-5 py-2 text-xs font-bold uppercase"
            style={{
              background: disabled || blocked || !dirty ? 'var(--color-outline-variant)' : '#a98208',
              color: '#fff',
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-label)',
              cursor: disabled || blocked || !dirty ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save Banner'}
          </button>
          {!loading && !saving && (enOver || esOver) && (
            <span className="text-xs" style={{ color: 'var(--color-error)' }}>
              Shorten the {enOver ? 'English' : 'Spanish'} text to save
            </span>
          )}
          {!loading && !saving && !blocked && dirty && (
            <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
              Unsaved changes
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
