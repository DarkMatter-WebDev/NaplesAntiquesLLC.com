import type { Viewport } from 'next';

// Admin-only viewport. The owner runs the listing editor from a phone, and an
// accidental pinch (or iOS's tap-to-zoom on a sub-16px input) left the modal
// zoomed in and panning sideways, with the Save row within thumb's reach of a
// mis-tap while zooming back out. Locking scale here keeps the editor pinned to
// the screen. Deliberately scoped to `/admin/*`: public pages keep the default
// zoomable viewport for accessibility.
//
// iOS Safari ignores `user-scalable=no`, so this is one of three layers — see
// `.product-editor-modal` in `globals.css` (16px inputs + `touch-action`) and
// the two-finger `touchmove` guard in `AdminShell.tsx`.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
