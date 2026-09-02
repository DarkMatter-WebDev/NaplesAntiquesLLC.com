import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Source guards for the phone-side listing editor (owner request, 2026-09-02).
//
// Three layers keep the Add/Edit modal pinned to the screen — the admin-only
// viewport lock, 16px inputs inside the editor, and a `touch-action` that
// forbids pinch — and each one fails SILENTLY if removed: the page simply
// starts zooming again on the owner's phone, which no build or type check can
// see. These assertions pin the pieces that must stay together, and the last
// one pins what must NOT spread: the public site keeps its zoomable viewport.

const APP = join(process.cwd(), 'src', 'app');
const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('admin mobile editor: zoom lock', () => {
  it('locks the viewport scale for /admin/* only', () => {
    const adminLayout = read('src', 'app', '[locale]', 'admin', 'layout.tsx');
    expect(adminLayout).toMatch(/export const viewport/);
    expect(adminLayout).toMatch(/maximumScale:\s*1/);
    expect(adminLayout).toMatch(/userScalable:\s*false/);

    // The public site must stay zoomable: no viewport lock in the locale or
    // root layouts.
    for (const file of [join(APP, '[locale]', 'layout.tsx'), join(APP, 'layout.tsx')]) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/userScalable/);
      expect(source).not.toMatch(/maximumScale/);
    }
  });

  it('keeps editor inputs at 16px on touch screens and forbids pinch', () => {
    const css = read('src', 'app', 'globals.css');
    expect(css).toMatch(
      /@media \(hover: none\) \{\s*\.product-editor-modal :is\(input, select, textarea\) \{\s*font-size: 1rem;/,
    );
    // `manipulation`, never `pan-x pan-y`: the latter locked vertical scrolling
    // of the editor on the owner's phone until a layout change (2026-09-02).
    expect(css).toMatch(/\.product-editor-modal \{\s*touch-action: manipulation;/);
    expect(css).not.toMatch(/\.product-editor-modal \{\s*touch-action: pan-x pan-y;/);
  });

  it('cancels two-finger touches from a non-passive listener while the editor is open', () => {
    const shell = read('src', 'components', 'admin', 'AdminShell.tsx');
    expect(shell).toMatch(/addEventListener\('touchmove', blockPinch, \{ passive: false \}\)/);
    expect(shell).toMatch(/addEventListener\('gesturestart', blockGesture\)/);
  });
});

describe('admin mobile editor: hide-on-scroll Save row', () => {
  it('wires the footer, the body scroll handler, and the measured height together', () => {
    const shell = read('src', 'components', 'admin', 'AdminShell.tsx');
    expect(shell).toMatch(/className="product-editor-footer /);
    expect(shell).toMatch(/data-hidden=\{editorFooterHidden \? 'true' : 'false'\}/);
    expect(shell).toMatch(/onScroll=\{handleEditorBodyScroll\}/);
    // The row's height reaches CSS as a DOM write inside a LAYOUT effect, not
    // React state: it must be there on the first painted frame, or an editor
    // with every accordion collapsed cannot scroll (2026-09-02 night).
    const layoutEffect = shell.slice(shell.indexOf('useLayoutEffect(() => {'), shell.indexOf('}, [editorOpen]);'));
    expect(layoutEffect).toMatch(/modal\.style\.setProperty\('--editor-footer-h', `\$\{footer\.offsetHeight\}px`\)/);
    expect(layoutEffect).toMatch(/measure\(\);\s*const observer/);
    expect(shell).not.toMatch(/'--editor-footer-h': `\$\{editorFooterHeight\}px`/);
  });

  it('keeps the row IN FLOW on phones and hides it by collapsing, never by overlaying', () => {
    const css = read('src', 'app', 'globals.css');
    const start = css.indexOf('.product-editor-footer {');
    expect(css.lastIndexOf('@media (max-width: 767px)', start)).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf('@media (prefers-reduced-motion: reduce)', start));
    // ⛔ Three overlay versions (absolute row + body padding, then a `::after`
    // spacer) all left the editor unscrollable on Safari mobile with every
    // accordion collapsed (2026-09-02). In flow there is nothing under the row
    // and no reserved space for a browser to discard.
    expect(block).not.toMatch(/position: absolute/);
    expect(block).toMatch(/max-height: calc\(var\(--editor-footer-h, 20rem\) \+ 2px\);/);
    expect(block).toMatch(/\.product-editor-footer\[data-hidden='true'\] \{[^}]*max-height: 0;[^}]*padding-bottom: 0 !important;/);
    expect(css).not.toMatch(/\.product-editor-body::after/);
    expect(css).not.toMatch(/\.product-editor-body \{\s*padding-bottom:/);
  });

  it('ignores the scroll event a toggle causes and has no show-at-end rule', () => {
    const shell = read('src', 'components', 'admin', 'AdminShell.tsx');
    const handler = shell.slice(shell.indexOf('const handleEditorBodyScroll'), shell.indexOf('useLayoutEffect(() => {'));
    expect(handler).toMatch(/editorFooterToggledAt\.current < 300/);
    expect(handler).not.toMatch(/atEnd/);
  });
});
