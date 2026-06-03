#!/usr/bin/env node
/**
 * Point HTML/meta/CSS paths at .webp files where the optimized asset exists.
 * Shop images stay .png/.jpg. ring/silver/watch page JPEGs stay .jpg if not converted.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** [pattern string, replacement] — applied to file contents */
const REPLACEMENTS = [
  ["assets/images/pages/about-if-we-had-a-store.png", "assets/images/pages/about-if-we-had-a-store.webp"],
  ["assets/images/pages/homepage-hero-bangles.png", "assets/images/pages/homepage-hero-bangles.webp"],
  ["assets/images/pages/chris.png", "assets/images/pages/chris.webp"],
  ["assets/images/pages/pen.png", "assets/images/pages/pen.webp"],
  ["assets/images/pages/antiques.jpeg", "assets/images/pages/antiques.webp"],
  ["assets/images/pages/jeweler.jpg", "assets/images/pages/jeweler.webp"],
  ["assets/images/pages/bullion.jpg", "assets/images/pages/bullion.webp"],
  ["assets/images/pages/gold.jpg", "assets/images/pages/gold.webp"],
  ["assets/images/pages/money.jpg", "assets/images/pages/money.webp"],
  ["assets/images/pages/patek.jpg", "assets/images/pages/patek.webp"],
  ["assets/images/pages/signed.jpg", "assets/images/pages/signed.webp"],
  ["assets/images/pages/trust.jpg", "assets/images/pages/trust.webp"],
  ["assets/images/branding/logo2.png", "assets/images/branding/logo2.webp"],
  ["assets/images/branding/logo.png", "assets/images/branding/logo.webp"],
  ['type="image/png" href="assets/images/branding/logo2.png"', 'type="image/webp" href="assets/images/branding/logo2.webp"'],
  ['type="image/png" href="/assets/images/branding/logo2.png"', 'type="image/webp" href="/assets/images/branding/logo2.webp"'],
];

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "all-site-images" || name === "optimized-output") continue;
      walk(p, acc);
    } else if (/\.(html|css|js|toml|md)$/i.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

let filesChanged = 0;
let totalSubs = 0;

for (const file of walk(ROOT)) {
  if (file.includes(`${join("tools", "update-webp-paths.mjs")}`)) continue;
  let text = readFileSync(file, "utf8");
  let subs = 0;
  for (const [from, to] of REPLACEMENTS) {
    const parts = text.split(from);
    if (parts.length > 1) {
      subs += parts.length - 1;
      text = parts.join(to);
    }
  }
  if (subs > 0) {
    writeFileSync(file, text, "utf8");
    filesChanged++;
    totalSubs += subs;
    console.log(`${subs}\t${file.replace(ROOT + "\\", "").replace(ROOT + "/", "")}`);
  }
}

console.log(`\nUpdated ${filesChanged} files (${totalSubs} replacements).`);
