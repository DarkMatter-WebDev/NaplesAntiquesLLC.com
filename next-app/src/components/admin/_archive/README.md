# Archived: Quick Fill (admin product editor)

The **Quick Fill** section was removed from the product editor UI on 2026-06-16.
It is hidden, not deleted — all logic still lives in `AdminShell.tsx`, gated behind a flag.

## How to restore
In `src/components/admin/AdminShell.tsx`, set:

```ts
const SHOW_QUICK_FILL: boolean = true;
```

That re-renders the Quick Fill panel and its "AI Formatting Prompt" modal. Nothing else is needed.

## What Quick Fill was
A **non-AI**, deterministic helper that let an admin paste structured `Key:Value` text
(e.g. `Title English:..., Brand:Omega, Metal Color:Bicolor Gold, Purity:14k, Weight:25.3g`)
and apply it to the product form. It also offered a "copy the AI formatting prompt" flow so an
admin could format text in any external LLM and paste the result back.

It is separate from the **Smart Listing Assistant** (the photo/voice AI autofill).

## Where the code lives (still in AdminShell.tsx unless noted)
- `SHOW_QUICK_FILL` flag — gates the panel + modal render.
- Parser: `applyQuickEntry()` (the large tokenizer/field-matcher).
- Helpers: `getQuickFillLinkType`, `splitQuickFillColumns`, `normalizeQuickFillFieldName`,
  `getQuickFillTokens`, `getQuickFillFormOrderTokens`, `QUICK_FILL_FORM_ORDER`, `QuickFillField` type.
- State: `quickEntry`, `quickFillPrompt`, `quickFillNotice`, `showQuickFillPrompt`, refs.
- Notices: `showQuickFillNotice`, `copyQuickFillPrompt`.
- Prompt source module (unchanged, still active): `src/lib/admin-settings.ts`
  (`DEFAULT_QUICK_FILL_AI_FORMAT_PROMPT`, `QUICK_FILL_PROMPT_STORAGE_KEY`,
  `ensureQuickFillPromptHasCurrentBrandRules`).

## Full snapshot
`AdminShell.with-quickfill.tsx.bak` in this folder is a complete copy of `AdminShell.tsx`
captured immediately before the Quick Fill section was hidden — use it as the reference if a
future change makes the in-file flag approach impractical and the feature needs full extraction.
