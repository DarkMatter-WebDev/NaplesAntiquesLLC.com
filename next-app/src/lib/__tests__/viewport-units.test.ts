import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guard for the viewport-height units.
//
// The rule itself is old — DECISIONS, "Viewport height is `svh`, and `resize`
// is never listened to bare" — and the 2026-08-11 sweep applied it everywhere
// it could SEE. The problem this file exists for is that it could not see
// everywhere.
//
// That sweep searched for CSS unit literals (`vh`, `dvh`). Tailwind's
// `min-h-screen` compiles to `min-height: 100vh` and contains no literal, so no
// grep in that session could have found it — including the one on `<body>` in
// `[locale]/layout.tsx`, which applies to every page on the site. On mobile
// `100vh` is the LARGE viewport, so a page shorter than the screen gained about
// one toolbar-height of phantom scroll: enough travel to trigger an in-app
// browser's hide-on-scroll, which grows the viewport, which removes the need to
// scroll, which brings the toolbar back.
//
// The tell that it was an oversight rather than a choice: that same batch
// converted `[locale]/not-found.tsx` from `60vh` to `60svh` while leaving
// `app/not-found.tsx` on `min-h-screen`. Two 404 pages, one fixed, one not,
// differing only in whether the unit happened to be spelled out.
//
// A convention that can only be enforced by grepping for a string the offender
// does not contain is not enforceable. These assertions are.
//
// ⚠️ ONE TRAP, for whoever audits this from the compiled output rather than the
// source: `.min-h-screen{min-height:100vh}` is STILL emitted into the built CSS,
// and that is not a failure of this guard. Tailwind's scanner is a plain string
// scan over the source tree — it does not parse — so the class name mentioned in
// the comments explaining this very rule is enough to generate the utility. The
// rule is dead weight (~30 bytes, applied by nothing); its presence in the
// stylesheet is not evidence that anything uses it. Check the served HTML's
// `<body class>` instead, which is what the second assertion below pins.

const SOURCE_ROOTS = [join(process.cwd(), 'src', 'app'), join(process.cwd(), 'src', 'components')];

/**
 * `dvh` is legitimate in exactly one shape: a NON-SCROLLING full-viewport shell.
 * `AdminShell`'s root and its fullscreen overlay are `overflow-hidden` with
 * internal scrolling, so the page never scrolls, the toolbar never auto-hides,
 * and `dvh` fills the visible area exactly where `svh` would leave dead space.
 *
 * `ViewportDebugOverlay` measures all three units on purpose and is TEMPORARY —
 * when that component goes, this entry goes with it.
 */
const DVH_ALLOWED = new Set(['components/admin/AdminShell.tsx', 'components/layout/ViewportDebugOverlay.tsx']);

/** Sizing uses of `dvh`, not the word appearing in prose or a comment. */
const DVH_SIZING = /(?:\d+(?:\.\d+)?dvh|\bh-dvh\b)/;

/** Tailwind's viewport aliases. All of them compile to `vh`, none contain it. */
const SCREEN_ALIAS = /\b(?:min-h|max-h|h)-screen\b/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(path) ? [path] : [];
  });
}

/**
 * The file with its comments blanked out, line numbering preserved.
 *
 * This matters more than it looks. These rules have to be EXPLAINED where they
 * bite — the `<body>` conversion carries a paragraph about why — and a guard
 * that flags its own rationale is a guard the next person deletes instead of
 * obeying. Block comments are replaced by their own newlines rather than
 * removed so a reported line number still points at the real line.
 *
 * `//` is ignored when preceded by `:` so a `https://` URL survives intact.
 */
function codeLines(file: string): string[] {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'));
}

function scan(pattern: RegExp) {
  return SOURCE_ROOTS.flatMap(sourceFiles).flatMap((file) =>
    codeLines(file)
      .map((line, index) => ({
        file: relative(process.cwd(), file).replace(/\\/g, '/'),
        line: line.trim(),
        lineNumber: index + 1,
      }))
      .filter(({ line }) => pattern.test(line)),
  );
}

describe('viewport height units', () => {
  it('uses no Tailwind *-screen alias anywhere', () => {
    // `min-h-svh` / `h-svh` / `max-h-svh` are the replacements. They say what
    // they mean and a future unit sweep can find them.
    expect(scan(SCREEN_ALIAS)).toEqual([]);
  });

  it('keeps the page shell on svh, since it applies to every page', () => {
    const layout = readFileSync(join(process.cwd(), 'src', 'app', '[locale]', 'layout.tsx'), 'utf8');
    expect(layout).toContain('<body className="min-h-svh flex flex-col">');
  });

  it('confines dvh to the non-scrolling shells that legitimately need it', () => {
    const offenders = scan(DVH_SIZING).filter(({ file }) => !DVH_ALLOWED.has(file.replace(/^src\//, '')));
    expect(offenders).toEqual([]);
  });

  it('holds AdminShell to exactly the two shells that were argued for', () => {
    // Pinned by count so a third `h-dvh` cannot arrive inside the allowlisted
    // file and inherit its exemption silently.
    const shell = readFileSync(join(process.cwd(), 'src', 'components', 'admin', 'AdminShell.tsx'), 'utf8');
    expect(shell.match(/\bh-dvh\b/g) ?? []).toHaveLength(2);
  });
});
