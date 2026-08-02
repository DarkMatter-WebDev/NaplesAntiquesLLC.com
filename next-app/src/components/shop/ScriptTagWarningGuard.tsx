'use client';

// React 19 logs a dev-only console warning for ANY literal <script> JSX host
// element ("Encountered a script tag while rendering React component...")
// even for one that is correct and necessary — like the blocking inline
// script a few lines below this component in shop/(list)/page.tsx, which
// mutates <main>'s className via document.currentScript before the browser
// paints (the same anti-flash idiom libraries like next-themes use). That
// script only ever needs to run once, via the browser's native HTML parser
// on a real page load; React's warning fires anyway during hydration even
// though nothing is actually broken. This is a known, currently-unresolved
// limitation with no first-party replacement API that preserves the same
// "before paint, at this exact DOM position" guarantee — see
// facebook/react#34008, vercel/next.js discussions on the topic, and
// shadcn-ui/ui#10104, whose own docs recommend this exact console filter for
// the identical next-themes flash-prevention pattern.
//
// This module-scope side effect runs once, the moment this client module is
// evaluated — which happens before hydration reaches the actual <script>
// element below it, since module evaluation always precedes hydrateRoot's
// render pass. The filter is scoped to the exact known warning text (never
// masks unrelated errors) and only active in development — production React
// builds don't emit this warning at all, so there is nothing to filter there.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const KNOWN_FALSE_POSITIVE = 'Encountered a script tag while rendering React component.';
  const win = window as typeof window & { __nejScriptTagWarningPatched?: boolean };
  if (!win.__nejScriptTagWarningPatched) {
    win.__nejScriptTagWarningPatched = true;
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      if (typeof args[0] === 'string' && args[0].startsWith(KNOWN_FALSE_POSITIVE)) return;
      originalConsoleError(...args);
    };
  }
}

export default function ScriptTagWarningGuard() {
  return null;
}
