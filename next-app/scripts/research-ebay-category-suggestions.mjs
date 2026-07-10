// One-off developer research tool: for each real product_type in this
// catalog that currently maps to NO eBay category (or an unverified
// "approximate" one), asks eBay's live Commerce Taxonomy API
// (get_category_suggestions) which leaf category actually fits, using the
// real product titles as the query signal. Written because the category
// maps in src/lib/ebay/mapping.ts were pinned by the build agent WITHOUT
// eBay access (flagged TODO(ebay-verify)), and the 2026-07-10 required-
// aspects research already proved some of those pins (12595 Brooch, 4196
// Cufflinks, 281 Watch) are invalid or non-leaf — so pin real ones from
// eBay itself instead of guessing.
//
// Needs only EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (client-credentials
// application token) — no seller OAuth. Same credential rule as every other
// script here — never paste the Client Secret into chat/logs/files.
//
//   EBAY_CLIENT_ID=... EBAY_CLIENT_SECRET=... node scripts/research-ebay-category-suggestions.mjs
//
// Output is category ids/paths only — never secret — safe to paste back.

const EBAY_ENV = process.env.EBAY_ENV === 'sandbox' ? 'sandbox' : 'production';
const API_BASE = EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const MARKETPLACE_ID = 'EBAY_US';

// One representative query per distinct product family currently failing or
// approximate. The query text mimics a real listing title so eBay's
// suggestion engine has the strongest signal. Grouped by the bucket we
// expect them to land in — but we trust eBay's answer, not the grouping.
// 2026-07-10 round 2: pre-mapping the new "Mug" item plus antique-silver
// types the shop may plausibly acquire (drinking vessels, holloware,
// objets de vertu), so they map correctly on first sync instead of failing
// preflight. Drinking vessels (mug/cup/goblet/tankard/beaker) and small
// silver boxes (snuff/vinaigrette/vesta/card/cigarette case) are the most
// likely; the rest round out common estate-silver forms. Also probing a
// generic "antique sterling silver" catch-all for the fallback leaf.
const QUERIES = [
  // --- Drinking vessels ---
  { key: 'Mug', q: 'Antique Sterling Silver Handled Mug Cup' },
  { key: 'Cup', q: 'Antique Sterling Silver Christening Cup' },
  { key: 'Goblet', q: 'Sterling Silver Goblet Chalice' },
  { key: 'Tankard', q: 'Antique Sterling Silver Tankard' },
  { key: 'Beaker', q: 'Antique Sterling Silver Beaker' },
  // --- Holloware / table articles ---
  { key: 'Bowl', q: 'Antique Sterling Silver Bowl' },
  { key: 'Candlestick', q: 'Antique Sterling Silver Candlestick Pair' },
  { key: 'Candelabra', q: 'Antique Sterling Silver Candelabra' },
  { key: 'Pitcher', q: 'Antique Sterling Silver Water Pitcher Jug' },
  { key: 'Ewer', q: 'Antique Sterling Silver Ewer' },
  { key: 'Vase', q: 'Antique Sterling Silver Vase' },
  { key: 'Creamer', q: 'Antique Sterling Silver Creamer Cream Jug' },
  { key: 'Sugar Bowl', q: 'Antique Sterling Silver Sugar Bowl' },
  { key: 'Teapot', q: 'Antique Sterling Silver Teapot' },
  { key: 'Compote', q: 'Antique Sterling Silver Compote Footed Dish' },
  { key: 'Porringer', q: 'Antique Sterling Silver Porringer' },
  { key: 'Butter Dish', q: 'Antique Sterling Silver Butter Dish' },
  { key: 'Bell', q: 'Antique Sterling Silver Table Bell' },
  // --- Small silver / objets de vertu ---
  { key: 'Box', q: 'Antique Sterling Silver Snuff Box' },
  { key: 'Vinaigrette', q: 'Antique Sterling Silver Vinaigrette Box' },
  { key: 'Vesta Case', q: 'Antique Sterling Silver Vesta Case Match Safe' },
  { key: 'Card Case', q: 'Antique Sterling Silver Card Case' },
  { key: 'Cigarette Case', q: 'Antique Sterling Silver Cigarette Case' },
  { key: 'Inkwell', q: 'Antique Sterling Silver Inkwell Inkstand' },
  // --- Generic silver fallback probe ---
  { key: 'Generic Silver', q: 'Antique Sterling Silver Collectible' },
];

class UsageError extends Error {}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new UsageError(`Missing required env var ${name}. See the header comment in this script.`);
  return value;
}

async function getApplicationToken() {
  const clientId = requireEnv('EBAY_CLIENT_ID');
  const clientSecret = requireEnv('EBAY_CLIENT_SECRET');
  const looksSandbox = /-SBX-/i.test(clientId);
  if (looksSandbox && EBAY_ENV === 'production') {
    console.warn(
      'Warning: EBAY_CLIENT_ID looks like a SANDBOX App ID ("-SBX-") but this script targets production. ' +
        'Use the PRODUCTION keyset, or set EBAY_ENV=sandbox.\n',
    );
  }
  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  const res = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Token request failed (HTTP ${res.status}): ${data.error_description ?? JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function ebayGet(token, path, query) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(`GET ${path} failed (HTTP ${res.status}): ${JSON.stringify(data)}`);
  return data;
}

function formatAncestry(suggestion) {
  const ancestors = (suggestion.categoryTreeNodeAncestors ?? []).map((a) => a.categoryName).reverse();
  return [...ancestors, suggestion.category?.categoryName].filter(Boolean).join(' > ');
}

async function main() {
  console.log(`eBay env: ${EBAY_ENV} (${API_BASE})\n`);
  const token = await getApplicationToken();
  console.log('Got application token.\n');

  const treeIdRes = await ebayGet(token, '/commerce/taxonomy/v1/get_default_category_tree_id', { marketplace_id: MARKETPLACE_ID });
  const treeId = treeIdRes.categoryTreeId;
  console.log(`Category tree id for ${MARKETPLACE_ID}: ${treeId}\n${'='.repeat(100)}`);

  const picks = [];
  for (const { key, q } of QUERIES) {
    try {
      const res = await ebayGet(token, `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions`, { q });
      const candidates = (res.categorySuggestions ?? []).slice(0, 4).map((s) => ({
        categoryId: s.category?.categoryId,
        name: s.category?.categoryName,
        path: formatAncestry(s),
      }));
      console.log(`\n### ${key}  (query: "${q}")`);
      candidates.forEach((c, i) => console.log(`  ${i === 0 ? '>' : ' '} ${c.categoryId}  ${c.path}`));
      if (candidates[0]) picks.push({ key, ...candidates[0] });
    } catch (err) {
      console.error(`\n### ${key}: lookup failed — ${err.message}`);
    }
  }

  console.log(`\n\n${'='.repeat(100)}\n=== TOP PICK PER TYPE (review before pinning — get_category_suggestions can return a near-miss) ===\n`);
  for (const p of picks) {
    console.log(`  ${p.key.padEnd(18)} ${p.categoryId.padEnd(8)} ${p.path}`);
  }
}

main().catch((err) => {
  console.error(err instanceof UsageError ? err.message : (err.message ?? err));
  // process.exitCode not process.exit() — avoids the Windows libuv teardown
  // assertion crash (see pin-ebay-fashion-categories.mjs).
  process.exitCode = 1;
});
