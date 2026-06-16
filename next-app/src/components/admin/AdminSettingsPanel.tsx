'use client';

import { useRef, useState } from 'react';
import {
  DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT,
  QUICK_FILL_PROMPT_STORAGE_KEY,
  ensureQuickFillPromptHasCurrentBrandRules,
} from '@/lib/admin-settings';
import { copyTextToClipboard } from '@/lib/clipboard';

export default function AdminSettingsPanel() {
  const [prompt, setPrompt] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT;
    const storedPrompt = window.localStorage.getItem(QUICK_FILL_PROMPT_STORAGE_KEY)?.trim();
    return ensureQuickFillPromptHasCurrentBrandRules(storedPrompt || DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT);
  });
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const showNotice = (text: string, ok = true) => {
    setNotice({ text, ok });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const savePrompt = () => {
    const nextPrompt = ensureQuickFillPromptHasCurrentBrandRules(prompt);
    if (!nextPrompt) {
      showNotice('Prompt cannot be blank.', false);
      return;
    }
    window.localStorage.setItem(QUICK_FILL_PROMPT_STORAGE_KEY, nextPrompt);
    setPrompt(nextPrompt);
    showNotice('AI formatting prompt saved.');
  };

  const resetPrompt = () => {
    window.localStorage.removeItem(QUICK_FILL_PROMPT_STORAGE_KEY);
    setPrompt(DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT);
    showNotice('AI formatting prompt reset to default.');
  };

  const copyPrompt = async () => {
    const copied = await copyTextToClipboard(prompt);
    if (!copied) {
      promptTextareaRef.current?.focus();
      promptTextareaRef.current?.select();
    }
    showNotice(copied ? 'AI formatting prompt copied.' : 'Clipboard access was blocked. Prompt text is selected for manual copy.', copied);
  };

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
          <div className="border-b px-5 py-4" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <h2
              className="text-xl font-bold"
              style={{ fontFamily: 'var(--font-headline)', color: 'var(--color-on-surface)' }}
            >
              Quick Fill AI Formatting Prompt
            </h2>
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

            <label className="form-label" htmlFor="quick-fill-ai-prompt">
              AI Prompt
            </label>
            <textarea
              ref={promptTextareaRef}
              id="quick-fill-ai-prompt"
              className="form-field w-full min-h-[460px] font-mono text-xs leading-relaxed"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              spellCheck={false}
            />

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={copyPrompt} className="outline-button text-sm">
                Copy Prompt
              </button>
              <button type="button" onClick={resetPrompt} className="outline-button text-sm">
                Reset Default
              </button>
              <button type="button" onClick={savePrompt} className="gold-button text-sm">
                Save Prompt
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
