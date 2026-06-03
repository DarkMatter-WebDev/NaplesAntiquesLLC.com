#!/usr/bin/env node
/**
 * List image paths by optimization group (branding / pages / shop).
 * Usage: node tools/list-image-groups.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(ROOT, "all-site-images", "manifest.json");

if (!existsSync(manifestPath)) {
  console.error("Run: powershell -File tools/copy-all-site-images.ps1");
  process.exit(1);
}

const items = JSON.parse(readFileSync(manifestPath, "utf8"));
const groups = { branding: [], pages: [], shop: [] };

for (const item of items) {
  const p = item.sourcePath;
  if (p.includes("/branding/")) groups.branding.push(p);
  else if (p.includes("/pages/")) groups.pages.push(p);
  else if (p.includes("/shop/")) groups.shop.push(p);
}

function sumBytes(arr) {
  return arr.reduce((s, x) => s + (x.bytes || 0), 0);
}

for (const [name, list] of Object.entries(groups)) {
  const mb = (sumBytes(list) / 1024 / 1024).toFixed(2);
  console.log(`\n${name}: ${list.length} files (${mb} MB)`);
  if (name === "pages") {
    const jpg = list.filter((x) => /\.jpe?g$/i.test(x.sourcePath));
    const png = list.filter((x) => /\.png$/i.test(x.sourcePath));
    console.log(`  JPEG: ${jpg.length}, PNG: ${png.length}`);
  }
}

console.log("\nShop listing rule: lossless PNG/JPEG only, no resize (Group 3).");
