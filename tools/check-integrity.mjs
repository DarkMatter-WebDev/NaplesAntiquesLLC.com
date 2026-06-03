#!/usr/bin/env node
/*
 * check-integrity.mjs — dependency-free build-integrity guardrail.
 *
 * Runs with plain Node (no npm install, no packages). Verifies the invariants
 * documented in project-docs/INTEGRITY.md so the static site stays consistent
 * as listings and pages change over time.
 *
 * Usage (from repo root):   node tools/check-integrity.mjs
 * Exit code 0 = all checks pass, 1 = one or more failures.
 *
 * See: project-docs/STRUCTURE.md, project-docs/INTEGRITY.md,
 *      project-docs/features/shop-listings.md
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}
function exists(rel) {
  return existsSync(join(ROOT, rel));
}

/* ---------------------------------------------------------------------------
 * 1. Load the product catalog (single source of truth)
 * ------------------------------------------------------------------------- */
function loadProducts() {
  const code = read("scripts/shop/shop-products.js");
  const win = {};
  // shop-products.js is a browser script that assigns window.SHOP_PRODUCTS.
  // Execute it in a tiny sandbox to read the data without a DOM.
  new Function("window", code)(win);
  if (!Array.isArray(win.SHOP_PRODUCTS)) {
    fail("scripts/shop/shop-products.js did not define a window.SHOP_PRODUCTS array.");
    return [];
  }
  return win.SHOP_PRODUCTS;
}

/* ---------------------------------------------------------------------------
 * 2. Validate each product against the canonical schema
 * ------------------------------------------------------------------------- */
const REQUIRED_STRINGS = [
  "id",
  "category",
  "title",
  "title_es",
  "priceMode",
  "status",
  "description",
  "description_es",
];
const REQUIRED_ARRAYS = ["images", "details", "details_es", "tags", "tags_es"];
const VALID_PRICE_MODES = ["spot-multiplier", "manual"];
/** Shop grid cards use a 2-line title clamp; keep catalog titles within these limits. */
const SHOP_CARD_TITLE_MAX = 62;
const SHOP_CARD_TITLE_ES_MAX = 85;

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function validateProducts(products) {
  const seenIds = new Set();
  products.forEach((p, i) => {
    const where = `product[${i}] (${p && p.id ? p.id : "no id"})`;

    REQUIRED_STRINGS.forEach((k) => {
      if (typeof p[k] !== "string" || p[k].trim() === "") {
        fail(`${where}: missing/empty required string field "${k}".`);
      }
    });
    REQUIRED_ARRAYS.forEach((k) => {
      if (!Array.isArray(p[k]) || p[k].length === 0) {
        fail(`${where}: field "${k}" must be a non-empty array.`);
      }
    });

    if (p.id) {
      if (seenIds.has(p.id)) fail(`${where}: duplicate id "${p.id}".`);
      seenIds.add(p.id);
    }

    if (p.priceMode && !VALID_PRICE_MODES.includes(p.priceMode)) {
      fail(`${where}: priceMode "${p.priceMode}" not one of ${VALID_PRICE_MODES.join(", ")}.`);
    }

    // Spot-multiplier products need the numbers that drive live pricing.
    if (p.priceMode === "spot-multiplier") {
      if (!(typeof p.purity === "number" && p.purity > 0)) {
        fail(`${where}: spot-multiplier product needs a positive numeric "purity".`);
      }
      if (!(typeof p.weightGrams === "number" && p.weightGrams > 0)) {
        fail(`${where}: spot-multiplier product needs a positive numeric "weightGrams".`);
      }
      if (!(typeof p.pricingMultiplier === "number" && p.pricingMultiplier > 0)) {
        fail(`${where}: spot-multiplier product needs a positive numeric "pricingMultiplier".`);
      }
    }
    // Manual products need a label to show instead of a computed price.
    if (p.priceMode === "manual") {
      if (typeof p.manualPriceLabel !== "string" || p.manualPriceLabel.trim() === "") {
        fail(`${where}: manual product needs a non-empty "manualPriceLabel".`);
      }
    }

    if (typeof p.title === "string" && p.title.length > SHOP_CARD_TITLE_MAX) {
      fail(
        `${where}: title is ${p.title.length} characters; shop grid titles must be ≤ ${SHOP_CARD_TITLE_MAX} (2-line clamp). Shorten the title or move detail to description.`
      );
    }
    if (typeof p.title_es === "string" && p.title_es.length > SHOP_CARD_TITLE_ES_MAX) {
      fail(
        `${where}: title_es is ${p.title_es.length} characters; shop grid titles must be ≤ ${SHOP_CARD_TITLE_ES_MAX}. Shorten title_es or move detail to description_es.`
      );
    }

    // Images must be root-absolute (so they load from /es/ depth too) and exist.
    if (Array.isArray(p.images)) {
      p.images.forEach((src) => {
        if (typeof src !== "string" || !src.startsWith("/assets/")) {
          fail(`${where}: image path "${src}" must be root-absolute (start with /assets/).`);
        } else {
          // Strip any ?v= cache-busting query before checking the file on disk.
          const onDisk = src.replace(/^\//, "").split("?")[0];
          if (!exists(onDisk)) fail(`${where}: image file not found on disk: "${src}".`);
        }
      });
    }
  });
  return seenIds;
}

/* ---------------------------------------------------------------------------
 * 3. EN / ES page parity (every page has a twin)
 * ------------------------------------------------------------------------- */
function htmlPagesIn(rel) {
  const dir = join(ROOT, rel);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".html"))
    .filter((f) => f !== "submit-item-form.partial.html");
}

function checkPageParity() {
  const en = htmlPagesIn(".");
  const es = htmlPagesIn("es");
  en.forEach((f) => {
    if (!es.includes(f)) warn(`English page "${f}" has no Spanish twin at es/${f}.`);
  });
  es.forEach((f) => {
    if (!en.includes(f)) warn(`Spanish page "es/${f}" has no English twin at ./${f}.`);
  });
  return { en, es };
}

/* ---------------------------------------------------------------------------
 * 4. Shop card / data parity (shop.html cards <-> es/shop.html <-> catalog)
 * ------------------------------------------------------------------------- */
function cardIds(rel) {
  if (!exists(rel)) return [];
  const html = read(rel);
  const ids = [];
  const re = /data-shop-item="([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.push(m[1]);
  return ids;
}

function checkShopParity(catalogIds) {
  const en = cardIds("shop.html");
  const es = cardIds("es/shop.html");

  if (en.length !== es.length) {
    fail(`shop.html has ${en.length} listing cards but es/shop.html has ${es.length}; they must match.`);
  }
  en.forEach((id) => {
    if (!es.includes(id)) fail(`Listing "${id}" is on shop.html but missing from es/shop.html.`);
    if (!catalogIds.has(id)) fail(`shop.html card "${id}" has no matching product in shop-products.js.`);
  });
  es.forEach((id) => {
    if (!en.includes(id)) fail(`Listing "${id}" is on es/shop.html but missing from shop.html.`);
  });
}

function cardTitleById(rel) {
  const html = read(rel);
  const map = new Map();
  const re = /<article[^>]*data-shop-item="([^"]+)"[\s\S]*?<h3[^>]*>([^<]*)<\/h3>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    map.set(m[1], decodeHtmlEntities(m[2].trim()));
  }
  return map;
}

function checkShopCardTitles(products) {
  const catalogById = new Map(products.map((p) => [p.id, p]));
  const enTitles = cardTitleById("shop.html");
  const esTitles = cardTitleById("es/shop.html");

  enTitles.forEach((cardTitle, id) => {
    const product = catalogById.get(id);
    if (!product) return;
    if (cardTitle !== product.title) {
      fail(
        `shop.html card "${id}": grid <h3> "${cardTitle}" does not match catalog title "${product.title}".`
      );
    }
  });

  esTitles.forEach((cardTitle, id) => {
    const product = catalogById.get(id);
    if (!product) return;
    if (cardTitle !== product.title_es) {
      fail(
        `es/shop.html card "${id}": grid <h3> "${cardTitle}" does not match catalog title_es "${product.title_es}".`
      );
    }
  });

  products.forEach((p) => {
    if (!enTitles.has(p.id)) {
      fail(`Product "${p.id}" is in the catalog but has no shop.html grid card <h3>.`);
    }
    if (!esTitles.has(p.id)) {
      fail(`Product "${p.id}" is in the catalog but has no es/shop.html grid card <h3>.`);
    }
  });
}

/* ---------------------------------------------------------------------------
 * 5. Spanish pages must use root-absolute asset/script paths
 * ------------------------------------------------------------------------- */
function checkEsPaths(esPages) {
  const badRef = /(?:src|href)="(?:assets\/|scripts\/|editorial-)/g;
  esPages.forEach((f) => {
    const html = read(`es/${f}`);
    if (badRef.test(html)) {
      fail(`es/${f} uses a relative asset/script path; /es/ pages must use root-absolute (/assets, /scripts, /editorial-*.css).`);
    }
  });
}

/* ------------------------------------------------------------------------- */
const products = loadProducts();
const catalogIds = validateProducts(products);
const { es } = checkPageParity();
checkShopParity(catalogIds);
checkShopCardTitles(products);
checkEsPaths(es);

console.log(`\nNaples Antiques — build integrity check`);
console.log(`  products checked : ${products.length}`);
console.log(`  warnings         : ${warnings.length}`);
console.log(`  errors           : ${errors.length}\n`);

warnings.forEach((w) => console.log(`  [warn]  ${w}`));
if (warnings.length) console.log("");
errors.forEach((e) => console.log(`  [FAIL]  ${e}`));

if (errors.length) {
  console.log(`\n✗ Integrity check FAILED with ${errors.length} error(s).\n`);
  process.exit(1);
}
console.log(`✓ Integrity check passed.\n`);
