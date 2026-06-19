'use client';

import { useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from '@/lib/clipboard';
import AdminCarouselSettingsPanel from './AdminCarouselSettingsPanel';
import MarketingSettingsPanel from './MarketingSettingsPanel';

type AiSettingsResponse = {
  systemPrompt: string;
  defaultPrompt: string;
  isCustom: boolean;
  promptVersion: string;
};

export default function AdminSettingsPanel() {
  const [prompt, setPrompt] = useState('');
  const [defaultPrompt, setDefaultPrompt] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [promptVersion, setPromptVersion] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const applyResponse = (data: AiSettingsResponse) => {
    setPrompt(data.systemPrompt);
    setDefaultPrompt(data.defaultPrompt);
    setIsCustom(data.isCustom);
    setPromptVersion(data.promptVersion);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/ai-settings');
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || 'Failed to load the AI prompt.');
        if (!cancelled) applyResponse(data as AiSettingsResponse);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load the AI prompt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const startEditing = () => {
    setEditing(true);
    // Focus the field on the next tick, once it's no longer read-only.
    window.setTimeout(() => promptTextareaRef.current?.focus(), 0);
  };

  const persist = async (nextPrompt: string, successText: string) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ systemPrompt: nextPrompt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to save the AI prompt.');
      applyResponse(data as AiSettingsResponse);
      setEditing(false);
      showNotice(successText);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Failed to save the AI prompt.', false);
    } finally {
      setSaving(false);
    }
  };

  const savePrompt = () => {
    if (!prompt.trim()) {
      showNotice('Prompt cannot be blank. Use Reset Default to revert to the built-in prompt.', false);
      return;
    }
    void persist(prompt, 'AI assistant prompt saved. New listings will use it.');
  };

  const resetPrompt = () => {
    // Sending an empty prompt clears the override; the server reverts to default.
    void persist('', 'AI assistant prompt reset to the built-in default.');
  };

  const copyPrompt = async () => {
    const copied = await copyTextToClipboard(prompt);
    if (!copied) {
      promptTextareaRef.current?.focus();
      promptTextareaRef.current?.select();
    }
    showNotice(copied ? 'AI assistant prompt copied.' : 'Clipboard access was blocked. Prompt text is selected for manual copy.', copied);
  };

  const isDefaultText = prompt.trim() === defaultPrompt.trim();

  return (
    <main className="px-4 md:px-8 py-8">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-8">
          <p
            className="text-[0.65rem] font-bold uppercase tracking-[0.35em] mb-3"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-label)' }}
          >
            Admin Settings
          </p>
          <h1
            className="text-3xl md:text-4xl font-bold"
            style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
          >
            Settings
          </h1>
        </div>

        <section className="border bg-white" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <div className="border-b px-5 py-4 flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <div>
              <h2
                className="text-xl font-bold"
                style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
              >
                AI Listing Assistant Prompt
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                The system prompt that drives photo &amp; transcript autofill. Changes apply to all new listings immediately.
              </p>
            </div>
            <span
              className="shrink-0 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] rounded-full"
              style={{
                fontFamily: 'var(--font-label)',
                background: isCustom ? 'color-mix(in srgb, var(--color-primary) 14%, transparent)' : 'color-mix(in srgb, var(--color-on-surface) 8%, transparent)',
                color: isCustom ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
              }}
            >
              {isCustom ? 'Custom' : 'Default'}
            </span>
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

            {loadError && (
              <div
                className="px-3 py-2 text-xs font-medium"
                role="status"
                style={{
                  background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-error) 28%, transparent)',
                  color: 'var(--color-error)',
                  fontFamily: 'var(--font-label)',
                }}
              >
                {loadError}
              </div>
            )}

            <label className="form-label" htmlFor="ai-system-prompt">
              System Prompt
            </label>
            <textarea
              ref={promptTextareaRef}
              id="ai-system-prompt"
              className="form-field w-full min-h-[460px] font-mono text-xs leading-relaxed"
              value={loading ? 'Loading…' : prompt}
              onChange={(event) => setPrompt(event.target.value)}
              readOnly={!editing || loading}
              aria-readonly={!editing || loading}
              spellCheck={false}
              style={editing && !loading ? undefined : { background: 'var(--color-surface-container-low)', cursor: 'default' }}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.7rem]" style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}>
                {promptVersion ? `Default version: ${promptVersion}` : ''}
              </span>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={copyPrompt} disabled={loading} className="outline-button text-sm">
                  Copy Prompt
                </button>
                {editing && (
                  <button type="button" onClick={resetPrompt} disabled={saving || isDefaultText} className="outline-button text-sm">
                    Reset Default
                  </button>
                )}
                {editing ? (
                  <button type="button" onClick={savePrompt} disabled={saving} className="gold-button text-sm">
                    {saving ? 'Saving…' : 'Save Prompt'}
                  </button>
                ) : (
                  <button type="button" onClick={startEditing} disabled={loading || !!loadError} className="gold-button text-sm">
                    Edit Prompt
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
        <MarketingSettingsPanel />
      </div>

      {/* Carousel panel gets a wider container so its two tables can use the
          full width on widescreen, only stacking below the lg breakpoint. */}
      <div className="max-w-[1800px] mx-auto">
        <AdminCarouselSettingsPanel />
      </div>
    </main>
  );
}
