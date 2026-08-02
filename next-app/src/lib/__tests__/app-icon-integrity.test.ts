import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { APP_ICONS, AppIcon } from '@/components/AppIcon';

const APP_ROOT = path.resolve(process.cwd());
const SOURCE_ROOT = path.join(APP_ROOT, 'src');
const LEGACY_CLASS = ['material', 'symbols', 'outlined'].join('-');
const LEGACY_FAMILY = ['Material', 'Symbols', 'Outlined'].join(' ');
const LEGACY_ASSET = ['material', 'symbols', 'subset'].join('-');

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:css|ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('inline SVG icon integrity', () => {
  it('does not restore the removed ligature-font infrastructure', () => {
    const violations = sourceFiles(SOURCE_ROOT).flatMap((file) => {
      const contents = fs.readFileSync(file, 'utf8');
      return [LEGACY_CLASS, LEGACY_FAMILY, LEGACY_ASSET]
        .filter((legacyValue) => contents.includes(legacyValue))
        .map((legacyValue) => `${path.relative(APP_ROOT, file)} contains ${legacyValue}`);
    });

    expect(violations).toEqual([]);
    expect(fs.existsSync(path.join(APP_ROOT, 'public', 'assets', 'fonts'))).toBe(false);
  });

  it('maps every statically named AppIcon to an SVG component', () => {
    const missing = sourceFiles(SOURCE_ROOT).flatMap((file) => {
      const contents = fs.readFileSync(file, 'utf8');
      return Array.from(contents.matchAll(/<AppIcon\b[^>]*\bname="([^"]+)"/g))
        .map((match) => match[1])
        .filter((name) => !(name in APP_ICONS))
        .map((name) => `${path.relative(APP_ROOT, file)} uses unknown icon ${name}`);
    });

    expect(missing).toEqual([]);
  });

  it('renders SVG markup and never falls back to visible icon-name text', () => {
    const rendered = renderToStaticMarkup(createElement(AppIcon, {
      name: 'sync',
      className: 'test-icon',
    }));

    expect(rendered).toContain('<svg');
    expect(rendered).toContain('app-icon test-icon');
    expect(rendered).not.toContain('>sync<');
    expect(renderToStaticMarkup(createElement(AppIcon, { name: 'not_registered' }))).toBe('');
  });
});
