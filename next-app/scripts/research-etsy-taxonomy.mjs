// One-off developer research tool: fetches Etsy's full seller-taxonomy tree
// (GET /v3/application/seller-taxonomy/nodes — public, needs only the API
// key, no seller OAuth) and searches it for candidate leaf nodes matching a
// set of keywords, so new silver-holloware product types can be pinned to
// REAL Etsy taxonomy ids instead of guessed ones — same "never guess an id"
// discipline as the existing ETSY_TAXONOMY_MAP / ETSY_KEYWORD_TAXONOMY in
// src/lib/etsy/mapping.ts (whose ids were themselves "fetched live from
// seller-taxonomy/nodes").
//
// Needs ETSY_API_KEY + ETSY_SHARED_SECRET. Etsy's v3 x-api-key header value
// is the COMBINED `keystring:shared_secret`, NOT the keystring alone —
// getting it wrong yields "Shared secret is required in x-api-key header"
// on every call (see the same note in src/lib/etsy/client.ts). Never paste
// either secret into chat/logs.
//
//   ETSY_API_KEY=... ETSY_SHARED_SECRET=... node scripts/research-etsy-taxonomy.mjs
//
// Output is taxonomy ids/paths only — never secret — safe to paste back.

const API_BASE = 'https://openapi.etsy.com';

// Keyword groups → each prints the leaf nodes whose full path contains ANY of
// the terms. Reviewer picks the best leaf per new product type.
// Word-boundary match (so "urn" doesn't match "fURNiture", "cup" doesn't
// match "occUPied", etc.). Includes internal (non-leaf) nodes too, flagged,
// since Etsy only permits listing under a LEAF node.
const SEARCHES = [
  { key: 'Mug / Cup', terms: ['mug', 'mugs', 'cup', 'cups', 'saucer', 'teacup'] },
  { key: 'Goblet / Wine / Tankard / Beaker', terms: ['goblet', 'wine glass', 'tankard', 'beaker', 'stein', 'steins'] },
  { key: 'Vase / Urn', terms: ['vase', 'vases', 'urn', 'urns'] },
  { key: 'Compote / Footed dish / Serving', terms: ['compote', 'footed', 'serving bowl', 'serving dish'] },
  { key: 'Box / Trinket / Decorative', terms: ['trinket', 'decorative box', 'keepsake', 'decorative boxes', 'jewelry box'] },
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}. See the header comment in this script.`);
  return v;
}

// Flatten the node tree to ALL nodes (leaf + internal) with full-path
// strings and a leaf flag — Etsy only permits listing under a leaf.
function collectLeaves(nodes, parentPath, out) {
  for (const node of nodes ?? []) {
    const path = [...parentPath, node.name];
    const children = node.children ?? [];
    out.push({ id: node.id, path: path.join(' > '), leaf: children.length === 0 });
    if (children.length > 0) collectLeaves(children, path, out);
  }
}

function matchesTerm(path, term) {
  // Whole-word match on the path, case-insensitive.
  return new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(path);
}

async function main() {
  const apiKeyHeader = `${requireEnv('ETSY_API_KEY')}:${requireEnv('ETSY_SHARED_SECRET')}`;
  const res = await fetch(`${API_BASE}/v3/application/seller-taxonomy/nodes`, {
    headers: { 'x-api-key': apiKeyHeader },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`seller-taxonomy/nodes failed (HTTP ${res.status}): ${JSON.stringify(data).slice(0, 400)}`);

  const leaves = [];
  collectLeaves(data.results, [], leaves);
  console.log(`Fetched ${data.count ?? '?'} taxonomy nodes; ${leaves.length} leaves.\n${'='.repeat(90)}`);

  for (const { key, terms } of SEARCHES) {
    console.log(`\n### ${key}`);
    const hits = leaves.filter((node) => terms.some((t) => matchesTerm(node.path, t)));
    if (hits.length === 0) {
      console.log('  (no node path matched — try broader terms or browse manually)');
    }
    // Home & Living matches first (most relevant for silver holloware), then the rest.
    hits.sort((a, b) => Number(b.path.startsWith('Home & Living')) - Number(a.path.startsWith('Home & Living')));
    for (const h of hits.slice(0, 14)) console.log(`  ${String(h.id).padEnd(6)} ${h.leaf ? 'leaf ' : 'PARENT'} ${h.path}`);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  // process.exitCode, not process.exit() — Windows libuv teardown crash guard.
  process.exitCode = 1;
});
