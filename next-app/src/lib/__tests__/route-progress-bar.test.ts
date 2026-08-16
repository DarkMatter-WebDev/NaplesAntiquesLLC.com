import { describe, expect, it } from 'vitest';
import {
  isNavigationComplete,
  shouldArmProgressBar,
  type NavigationIntent,
} from '@/components/layout/RouteProgressBar';

const ORIGIN = 'https://naplesestatejewelry.com';

function intent(overrides: Partial<NavigationIntent> & Pick<NavigationIntent, 'href'>): NavigationIntent {
  return {
    currentOrigin: ORIGIN,
    currentPath: '/shop',
    ...overrides,
  };
}

describe('route progress bar — when it arms', () => {
  it('arms for a genuine cross-path navigation', () => {
    expect(shouldArmProgressBar(intent({ href: `${ORIGIN}/checkout` }))).toBe(true);
  });

  it('arms when only the locale prefix changes', () => {
    expect(
      shouldArmProgressBar(intent({ href: `${ORIGIN}/es/shop`, currentPath: '/shop' })),
    ).toBe(true);
  });

  // Everything below is owner rule 1: the bar appears only when the visitor is
  // actually made to wait on a route.

  it('does not arm for a query-only change on the same path', () => {
    // What a shop filter or a pagination click looks like. These update in
    // place, so a bar would be noise.
    expect(shouldArmProgressBar(intent({ href: `${ORIGIN}/shop?metal=gold&page=2` }))).toBe(false);
  });

  it('does not arm for a hash link on the same path', () => {
    expect(shouldArmProgressBar(intent({ href: `${ORIGIN}/shop#top` }))).toBe(false);
  });

  it('does not arm for another site', () => {
    expect(shouldArmProgressBar(intent({ href: 'https://example.com/anything' }))).toBe(false);
  });

  it('does not arm for mailto: or tel:', () => {
    expect(shouldArmProgressBar(intent({ href: 'mailto:info@naplesestatejewelry.com' }))).toBe(false);
    expect(shouldArmProgressBar(intent({ href: 'tel:+12394048505' }))).toBe(false);
  });

  it('does not arm when the link opens a new tab', () => {
    expect(shouldArmProgressBar(intent({ href: `${ORIGIN}/checkout`, target: '_blank' }))).toBe(false);
    // _self is an explicit "this tab" and must still arm.
    expect(shouldArmProgressBar(intent({ href: `${ORIGIN}/checkout`, target: '_self' }))).toBe(true);
  });

  it('does not arm for a download link', () => {
    expect(shouldArmProgressBar(intent({ href: `${ORIGIN}/invoice.pdf`, hasDownload: true }))).toBe(false);
  });

  it('does not arm for a modified click, which opens a new tab', () => {
    expect(shouldArmProgressBar(intent({ href: `${ORIGIN}/checkout`, modifiedClick: true }))).toBe(false);
  });

  it('does not throw on an unparseable href', () => {
    expect(shouldArmProgressBar(intent({ href: 'http://[' }))).toBe(false);
  });
});

describe('route progress bar — when it clears', () => {
  it('completes once a different path commits', () => {
    expect(isNavigationComplete('/shop', '/shop/some-bracelet-21')).toBe(true);
  });

  it('does not complete while the committed path is unchanged', () => {
    expect(isNavigationComplete('/shop', '/shop')).toBe(false);
  });

  // Regression: this exact mistake shipped once and was caught by measuring a
  // real back-navigation, which left the bar on screen for the full 8s safety
  // timeout. `popstate` fires AFTER the URL has moved, so recording
  // `location.pathname` as the origin records the DESTINATION. The comparison
  // then never becomes true.
  it('never completes if the destination was recorded as the origin (the popstate trap)', () => {
    const destination = '/shop';
    expect(isNavigationComplete(destination, destination)).toBe(false);
  });
});
