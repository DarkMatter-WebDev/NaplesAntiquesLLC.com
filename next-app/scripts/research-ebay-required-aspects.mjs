// One-off developer research tool: queries eBay's live Taxonomy API for the
// REAL required item specifics (and, for SELECTION_ONLY fields, the exact
// allowed values) for every category id this catalog maps products into —
// see EBAY_FINE_CATEGORY_MAP / EBAY_FASHION_CATEGORY_MAP in
// src/lib/ebay/mapping.ts. Written because required-aspect validation
// (e.g. "Main Stone", "Style") only fires at PUBLISH time, not at item/offer
// creation, so trial-and-error one-error-at-a-time discovery is slow and
// only ever surfaces the FIRST missing field per attempt — this pulls the
// full list up front from eBay itself instead of guessing.
//
// Needs only EBAY_CLIENT_ID / EBAY_CLIENT_SECRET (a client-credentials
// application token) — no seller OAuth connection required. Same
// credential-handling rule as every other script here — never paste the
// Client Secret into chat/logs/files:
//
//   EBAY_CLIENT_ID=... EBAY_CLIENT_SECRET=... node scripts/research-ebay-required-aspects.mjs
//
// or (Windows PowerShell — ALWAYS quote the values, one line at a time):
//   $env:EBAY_CLIENT_ID="..."
//   $env:EBAY_CLIENT_SECRET="..."
//   node scripts/research-ebay-required-aspects.mjs
//
// Output is category/aspect metadata only — never secret — safe to paste
// back into chat or straight into mapping.ts.

const EBAY_ENV = process.env.EBAY_ENV === 'sandbox' ? 'sandbox' : 'production';
const API_BASE = EBAY_ENV === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com';
const MARKETPLACE_ID = 'EBAY_US';

// Every category id currently referenced in EBAY_FINE_CATEGORY_MAP /
// EBAY_FASHION_CATEGORY_MAP (mapping.ts) — one entry per distinct id so we
// don't query the same category twice (Necklace/Pendant share 261993).
const CATEGORIES = [
  // Fine Jewelry leaves (already pinned + validated)
  { label: 'Fine Necklaces & Pendants (Necklace/Pendant/Charm)', categoryId: '261993' },
  { label: 'Fine Rings (Ring)', categoryId: '261994' },
  { label: 'Fine Earrings (Earrings)', categoryId: '261990' },
  { label: 'Fine Bracelets & Charms (Bracelet)', categoryId: '261988' },
  // Jewelry leaves corrected 2026-07-10 (old 12595/4196/281 were invalid/non-leaf)
  { label: 'Fine Brooches & Pins (Brooch) — NEW', categoryId: '261989' },
  { label: "Men's Jewelry > Cufflinks (Cufflinks) — NEW", categoryId: '137843' },
  { label: 'Watches > Wristwatches (Watch) — NEW', categoryId: '31387' },
  // Fashion Jewelry leaves for vermeil (map was empty) — NEW
  { label: 'Fashion Necklaces & Pendants (vermeil) — NEW', categoryId: '155101' },
  { label: 'Fashion Brooches & Pins (vermeil) — NEW', categoryId: '50677' },
  // Antique silver holloware/flatware leaves (map had none) — NEW
  { label: 'Sterling Silver Flatware & Silverware — NEW', categoryId: '20104' },
  { label: 'Sterling Silver Platters & Trays — NEW', categoryId: '39441' },
  { label: 'Sterling Silver Tea/Coffee Pots & Sets — NEW', categoryId: '37998' },
  { label: 'Sterling Silver Salt Cellars — NEW', categoryId: '163273' },
  { label: 'Sterling Silver Napkin Rings & Clips — NEW', categoryId: '39440' },
  { label: 'Sterling Silver Bottles, Decanters & Flasks — NEW', categoryId: '163056' },
  { label: 'Sterling Silver Dishes & Coasters — NEW', categoryId: '63620' },
  // 2026-07-10 round 2: pre-mapping candidates (drinking vessels, holloware,
  // objets de vertu, + two non-silver-tree leaves for bell/inkwell + generic).
  { label: 'Sterling Silver Cups & Goblets (Mug/Cup/Goblet/Tankard/Beaker) — NEW', categoryId: '37993' },
  { label: 'Sterling Silver Bowls (Bowl/Compote/Porringer) — NEW', categoryId: '37991' },
  { label: 'Sterling Silver Candlesticks & Candelabra — NEW', categoryId: '20103' },
  { label: 'Sterling Silver Pitchers & Jugs (Pitcher/Ewer) — NEW', categoryId: '37995' },
  { label: 'Sterling Silver Vases & Urns — NEW', categoryId: '39443' },
  { label: 'Sterling Silver Creamers & Sugar Bowls — NEW', categoryId: '163055' },
  { label: 'Sterling Silver Boxes (Snuff Box) — NEW', categoryId: '37992' },
  { label: 'Sterling Silver Vinaigrettes — NEW', categoryId: '107441' },
  { label: 'Sterling Silver Cigarette & Vesta Cases (Vesta/Card/Cigarette) — NEW', categoryId: '105900' },
  { label: 'Sterling Silver Other Antique (generic fallback) — NEW', categoryId: '1215' },
  { label: 'Decorative Collectibles > Bells (Bell, non-silver tree) — NEW', categoryId: '261598' },
  { label: 'Pens & Writing > Inkwells (Inkwell, non-silver tree) — NEW', categoryId: '970' },
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

function describeAspect(aspect) {
  const constraint = aspect.aspectConstraint ?? {};
  const required = constraint.aspectRequired ?? constraint.aspectUsage === 'REQUIRED' ?? false;
  const mode = constraint.aspectMode ?? 'UNKNOWN';
  const cardinality = constraint.itemToAspectCardinality ?? 'UNKNOWN';
  const values = (aspect.aspectValues ?? []).map((v) => v.localizedValue).filter(Boolean);
  return { name: aspect.localizedAspectName, required, mode, cardinality, values };
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
  console.log('='.repeat(100));

  const summary = [];

  for (const { label, categoryId } of CATEGORIES) {
    console.log(`\n### ${label} — category ${categoryId}\n`);
    try {
      const res = await ebayGet(token, `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category`, {
        category_id: categoryId,
      });
      const aspects = (res.aspects ?? []).map(describeAspect);
      const required = aspects.filter((a) => a.required);
      const optional = aspects.filter((a) => !a.required);

      console.log(`REQUIRED (${required.length}):`);
      for (const a of required) {
        const valuesNote = a.mode === 'SELECTION_ONLY' ? ` — allowed values: ${a.values.slice(0, 30).join(' | ')}${a.values.length > 30 ? ' | ...' : ''}` : '';
        console.log(`  - ${a.name} [${a.mode}, ${a.cardinality}]${valuesNote}`);
      }

      console.log(`\noptional/recommended (${optional.length}): ${optional.map((a) => a.name).join(', ') || '(none)'}`);

      summary.push({ label, categoryId, required: required.map((a) => a.name) });
    } catch (err) {
      console.error(`  Lookup failed: ${err.message}`);
      summary.push({ label, categoryId, required: null, error: err.message });
    }
    console.log('\n' + '-'.repeat(100));
  }

  console.log('\n\n=== SUMMARY — required aspects per category ===\n');
  for (const s of summary) {
    if (s.error) {
      console.log(`${s.label} (${s.categoryId}): ERROR — ${s.error}`);
    } else {
      console.log(`${s.label} (${s.categoryId}): ${s.required.join(', ') || '(none required)'}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof UsageError ? err.message : (err.message ?? err));
  // Set the exit code rather than calling process.exit() directly — see
  // pin-ebay-fashion-categories.mjs's identical comment for why (Windows
  // libuv assertion crash if fetch's sockets are still tearing down).
  process.exitCode = 1;
});
