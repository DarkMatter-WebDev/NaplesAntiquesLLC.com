'use client';

import { useId, useState } from 'react';

const AI_DIRECTION_SUGGESTIONS = [
  {
    label: 'Warm & conversational',
    value:
      'Sound like a warm, knowledgeable jeweler speaking directly to a client. Add a genuine conversational observation or invitation instead of restating the product title.',
  },
  {
    label: 'Heritage & craftsmanship',
    value:
      'Lean into jewelry heritage and craftsmanship in a relaxed, appreciative voice. Do not invent provenance or facts beyond the product details.',
  },
  {
    label: 'History & character',
    value:
      'Give the piece a sense of history and character in a conversational way, without inventing dates, owners, provenance, or unsupported details.',
  },
  {
    label: 'Holiday gifting',
    value:
      'Frame this as a memorable holiday gift with a warm, inviting voice. Keep it tasteful and do not name a specific holiday unless the product context supports it.',
  },
  {
    label: 'Collector appeal',
    value:
      'Speak to what a collector might appreciate about this piece, keeping the tone knowledgeable and personal without adding unsupported rarity or investment claims.',
  },
  {
    label: 'Styling & wearability',
    value:
      'Make the opening feel easy and wearable by conversationally suggesting how this kind of piece can fit into someone’s style, without inventing product details.',
  },
] as const;

export function replaceSocialCaptionOpening(text: string, opening: string): string {
  const separator = text.search(/\n\s*\n/);
  if (separator === -1) return opening;
  const remainder = text.slice(separator).replace(/^\n\s*\n/, '');
  return opening ? `${opening}\n\n${remainder}` : remainder;
}

export default function SocialCaptionOpeningEditor({
  directionValue,
  onDirectionChange,
  value,
  onChange,
  onGenerate,
  generating,
  canRegenerate,
  disabled,
  needsPrepare,
}: {
  directionValue: string;
  onDirectionChange: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  generating: boolean;
  canRegenerate: boolean;
  disabled: boolean;
  needsPrepare: boolean;
}) {
  const directionId = useId();
  const openingId = useId();
  const directionMenuId = useId();
  const [showDirectionSuggestions, setShowDirectionSuggestions] = useState(false);

  return (
    <div
      className="flex flex-col gap-2 border p-3"
      style={{
        borderColor: 'var(--color-outline-variant)',
        background: 'var(--color-surface-container-low)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={directionId}
          className="text-[0.65rem] font-bold uppercase tracking-[0.2em]"
          style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
        >
          Optional AI direction
        </label>
        {!disabled && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                aria-expanded={showDirectionSuggestions}
                aria-controls={directionMenuId}
                onClick={() => setShowDirectionSuggestions((open) => !open)}
                className="outline-button text-xs"
              >
                Suggest AI direction ▾
              </button>

              {showDirectionSuggestions && (
                <div
                  id={directionMenuId}
                  role="menu"
                  aria-label="AI direction suggestions"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setShowDirectionSuggestions(false);
                  }}
                  className="absolute right-0 z-30 mt-2 grid w-[min(22rem,calc(100vw-3rem))] gap-1 border p-2 shadow-xl"
                  style={{
                    borderColor: 'var(--color-outline-variant)',
                    background: 'var(--color-surface)',
                  }}
                >
                  {AI_DIRECTION_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onDirectionChange(suggestion.value);
                        setShowDirectionSuggestions(false);
                      }}
                      className="px-3 py-2 text-left text-xs transition-colors hover:bg-black/5 focus-visible:bg-black/5 focus-visible:outline-none"
                      style={{ color: 'var(--color-on-surface)' }}
                    >
                      <span className="block font-bold">{suggestion.label}</span>
                      <span
                        className="mt-0.5 block text-[0.68rem] leading-relaxed"
                        style={{ color: 'var(--color-on-surface-variant)' }}
                      >
                        {suggestion.value}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onGenerate}
              disabled={generating}
              className="outline-button text-xs disabled:opacity-50"
            >
              {generating
                ? 'Generating…'
                : canRegenerate
                  ? 'Regenerate AI opener'
                  : 'Generate AI opener'}
            </button>
          </div>
        )}
      </div>

      <textarea
        id={directionId}
        value={directionValue}
        onChange={(event) => onDirectionChange(event.target.value)}
        rows={2}
        maxLength={400}
        disabled={disabled}
        placeholder="Example: Keep it warm and conversational, and emphasize the Italian craftsmanship."
        className="w-full resize-y border px-3 py-2 text-sm leading-relaxed disabled:opacity-70"
        style={{
          borderColor: 'var(--color-outline-variant)',
          background: 'var(--color-surface)',
          color: 'var(--color-on-surface)',
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem]">
        <span style={{ color: 'var(--color-on-surface-variant)' }}>
          Optional. Leave this blank and skip Generate to keep the opening exactly as shown below.
        </span>
        <span
          style={{
            color: directionValue.length > 360
              ? 'var(--color-error)'
              : 'var(--color-on-surface-variant)',
          }}
        >
          {directionValue.length} / 400
        </span>
      </div>

      <label
        htmlFor={openingId}
        className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.2em]"
        style={{ color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-label)' }}
      >
        Opening sentence
      </label>

      <textarea
        id={openingId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        maxLength={260}
        disabled={disabled}
        className="w-full resize-y border px-3 py-2 text-sm leading-relaxed disabled:opacity-70"
        style={{
          borderColor: 'var(--color-outline-variant)',
          background: 'var(--color-surface)',
          color: 'var(--color-on-surface)',
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.68rem]">
        <span style={{ color: 'var(--color-on-surface-variant)' }}>
          AI prefers natural “this…” wording, never “our.” You can still edit the sentence before Prepare.
        </span>
        <span style={{ color: value.length > 240 ? 'var(--color-error)' : 'var(--color-on-surface-variant)' }}>
          {value.length} / 260
        </span>
      </div>

      {needsPrepare && !disabled && (
        <p className="text-[0.68rem] font-semibold" style={{ color: '#8a6400' }}>
          Prepare to save this opening before publishing.
        </p>
      )}
    </div>
  );
}
