// One-off developer tool: resolves real eBay Fashion Jewelry category leaf
// ids via the live Taxonomy API, to fill in EBAY_FASHION_CATEGORY_MAP in
// src/lib/ebay/mapping.ts (intentionally left empty at build time — see the
// comment above that map and project-docs/DECISIONS.md 2026-07-09 session 14
// for why: no eBay credentials/network access were available to the build
// agent, and guessing a category id risked the same class of mistake that
// once corrupted a live Etsy listing).
//
// Needs only EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (the keyset) via a
// client-credentials application token — no seller OAuth connection
// required, so this can run before "Connect eBay" is ever clicked.
//
// Run locally, NEVER paste the Client Secret into chat/logs/files —
// same rule as OWNER-SETUP.md step 1 ("handle credentials like passwords"):
//
//   EBAY_CLIENT_ID=... EBAY_CLIENT_SECRET=... node scripts/pin-ebay-fashion-categories.mjs
//
// or (Windows PowerShell — ALWAYS quote the values, one line at a time):
//   $env:EBAY_CLIENT_ID="..."
//   $env:EBAY_CLIENT_SECRET="..."
//   node scripts/pin-ebay-fashion-categories.mjs
//
// Output is category ids/paths only — never secret — safe to paste back
// into chat or straight into mapping.ts.
//
// Use the PRODUCTION keyset's App ID / Cert ID (the ones WITHOUT "-SBX-" in
// the App ID) — this script defaults to the production API host, and
// sandbox credentials will always fail there with a 401. If you genuinely
// want to query the sandbox category tree instead, also set
// EBAY_ENV=sandbox (note eBay's sandbox has partial/incomplete category
// data — production is the more reliable source for this lookup).

const EBAY_ENV = process.env.EBAY_ENV === 'sandbox' ? 'sandbox' : 'production';
const API_BASE = EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const MARKETPLACE_ID = 'EBAY_US';

// One query per jewelry type that needs Fine-vs-Fashion routing (Q4) — these
// are exactly the types with an entry in EBAY_FINE_CATEGORY_MAP in
// src/lib/ebay/mapping.ts.
const FASHION_QUERIES = [
  { type: 'Necklace', query: 'Fashion Necklaces Pendants' },
  { type: 'Pendant', query: 'Fashion Necklaces Pendants' },
  { type: 'Charm', query: 'Fashion Necklaces Pendants' },
  { type: 'Ring', query: 'Fashion Rings' },
  { type: 'Earrings', query: 'Fashion Earrings' },
  { type: 'Bracelet', query: 'Fashion Bracelets' },
];

class UsageError extends Error {}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new UsageError(`Missing required env var ${name}. See the header comment in this script for how to run it.`);
  }
  return value;
}

async function getApplicationToken() {
  const clientId = requireEnv('EBAY_CLIENT_ID');
  const clientSecret = requireEnv('EBAY_CLIENT_SECRET');

  // Sandbox App IDs conventionally contain "-SBX-"; production ones don't.
  // A sandbox id against the production host (this script's default) always
  // 401s — catch the common mistake early with a clear message instead of a
  // bare "client authentication failed".
  const looksSandbox = /-SBX-/i.test(clientId);
  if (looksSandbox && EBAY_ENV === 'production') {
    console.warn(
      'Warning: EBAY_CLIENT_ID looks like a SANDBOX App ID ("-SBX-"), but this script is targeting the ' +
        'production API (api.ebay.com). Either use your PRODUCTION App ID/Cert ID instead, or set ' +
        'EBAY_ENV=sandbox to query the sandbox category tree.\n',
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');

  const res = await fetch(`${API_BASE}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    const hint =
      res.status === 401
        ? looksSandbox && EBAY_ENV === 'production'
          ? ' (this matches the sandbox/production mismatch warned about above)'
          : ' — double check you copied the App ID and Cert ID from the SAME row (production or sandbox) in the Developer Portal, with no extra spaces'
        : '';
    throw new Error(`Token request failed (HTTP ${res.status}): ${data.error_description ?? JSON.stringify(data)}${hint}`);
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

  const treeIdRes = await ebayGet(token, '/commerce/taxonomy/v1/get_default_category_tree_id', {
    marketplace_id: MARKETPLACE_ID,
  });
  const treeId = treeIdRes.categoryTreeId;
  console.log(`Category tree id for ${MARKETPLACE_ID}: ${treeId}\n`);

  const resultsByType = new Map();

  for (const { type, query } of FASHION_QUERIES) {
    if (resultsByType.has(query)) {
      resultsByType.set(type, resultsByType.get(query));
      continue;
    }
    try {
      const suggestions = await ebayGet(token, `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions`, {
        q: query,
      });
      const candidates = (suggestions.categorySuggestions ?? []).slice(0, 5).map((s) => ({
        categoryId: s.category?.categoryId,
        path: formatAncestry(s),
        relevance: s.categoryTreeNodeLevel,
      }));
      resultsByType.set(type, candidates);
      resultsByType.set(query, candidates);
    } catch (err) {
      console.error(`  Lookup failed for "${query}": ${err.message}`);
      resultsByType.set(type, []);
    }
  }

  console.log('=== Candidates found (review before pinning — pick the leaf that actually matches your catalog) ===\n');
  for (const { type } of FASHION_QUERIES) {
    const candidates = resultsByType.get(type) ?? [];
    console.log(`${type}:`);
    if (!candidates.length) {
      console.log('  (no suggestions returned — try browsing get_category_subtree manually)');
    }
    for (const c of candidates) {
      console.log(`  ${c.categoryId}  ${c.path}`);
    }
    console.log('');
  }

  console.log('=== Paste the ids you pick into EBAY_FASHION_CATEGORY_MAP in next-app/src/lib/ebay/mapping.ts, e.g.: ===\n');
  console.log('const EBAY_FASHION_CATEGORY_MAP: Partial<Record<string, EbayCategoryMapping>> = {');
  const seenTypes = new Set();
  for (const { type } of FASHION_QUERIES) {
    if (seenTypes.has(type)) continue;
    seenTypes.add(type);
    const top = (resultsByType.get(type) ?? [])[0];
    if (top) {
      console.log(`  ${type}: { categoryId: '${top.categoryId}', path: '${top.path}' },`);
    } else {
      console.log(`  // ${type}: no candidate found — resolve manually`);
    }
  }
  console.log('};\n');
  console.log('Double-check each id against https://www.ebay.com/sh/lst/active or a manual eBay category search before trusting it — get_category_suggestions can return a near-miss, not always the exact leaf you want.');
}

main().catch((err) => {
  console.error(err instanceof UsageError ? err.message : (err.message ?? err));
  // Set the exit code rather than calling process.exit() directly — forcing
  // an immediate exit while the fetch client's sockets are still being torn
  // down triggers a spurious "Assertion failed: !(handle->flags &
  // UV_HANDLE_CLOSING)" crash on some Node/Windows combinations. Setting
  // exitCode lets Node exit normally (still non-zero) once the event loop
  // drains, which avoids it.
  process.exitCode = 1;
});
