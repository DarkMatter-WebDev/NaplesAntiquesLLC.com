// Submit the site's URLs to IndexNow (https://www.indexnow.org), which fans
// one POST out to Bing, Yandex, Seznam and Naver. Added 2026-09-01 after the
// Bing Webmaster Tools import showed ~15 of 198 URLs indexed and the city
// pages "Discovered but not crawled" — Bing's own crawl budget for a small
// property is slow, and IndexNow is the sanctioned way to push it.
//
//   npm run indexnow              submit every <loc> in the live sitemap
//   npm run indexnow -- --dry-run list what would be sent, send nothing
//   npm run indexnow -- --urls=/shop/foo-12,/sell/naples   explicit list
//
// Run it after any deploy that adds, retitles or removes URLs (new product
// batch, new page, a sale that drops a product from the sitemap). The key is
// NOT a secret — the protocol requires it to be publicly readable at
// KEY_LOCATION; that is how the receiving engine proves the submitter owns the
// host. The script refuses to submit until it has read the key back from the
// live site, so running it before a deploy that ships the key file fails
// loudly instead of silently submitting URLs that can never be verified.
//
// Responses: 200 = accepted; 202 = accepted, key validation pending (normal
// on the first submission); 4xx = fix before retrying (the body says why).
// Bing lists what it received under Webmaster Tools → IndexNow within a day.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = 'naplesestatejewelry.com';
const KEY = '5f41b4c6500c156c3ddaec86d7e313b6';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINT = 'https://api.indexnow.org/IndexNow';
const CHUNK = 10_000; // protocol maximum per POST

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const urlsArg = args.find((a) => a.startsWith('--urls='));

// The key file in public/ must match the constant above, or the deployed site
// serves one key while this script claims another.
const here = dirname(fileURLToPath(import.meta.url));
const keyFile = join(here, '..', 'public', `${KEY}.txt`);
if (!existsSync(keyFile) || readFileSync(keyFile, 'utf8').trim() !== KEY) {
  console.error(`public/${KEY}.txt is missing or does not contain the key — fix that before submitting.`);
  process.exit(1);
}

function toAbsolute(u) {
  const s = u.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${HOST}${s.startsWith('/') ? s : `/${s}`}`;
}

async function main() {
  const live = await fetch(KEY_LOCATION, { headers: { 'Cache-Control': 'no-cache' } });
  const liveBody = (await live.text()).trim();
  if (!live.ok || liveBody !== KEY) {
    console.error(
      `Key file is not live at ${KEY_LOCATION} (status ${live.status}, body ${JSON.stringify(liveBody.slice(0, 60))}). Deploy first.`,
    );
    process.exitCode = 1;
    return;
  }

  let urls;
  if (urlsArg) {
    urls = urlsArg.slice('--urls='.length).split(',').map(toAbsolute).filter(Boolean);
  } else {
    const res = await fetch(SITEMAP, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) {
      console.error(`Sitemap fetch failed: ${res.status} ${SITEMAP}`);
      process.exit(1);
    }
    const xml = await res.text();
    urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  }

  urls = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === HOST;
    } catch {
      return false;
    }
  });
  if (urls.length === 0) {
    console.error('No URLs on the host to submit.');
    process.exitCode = 1;
    return;
  }

  console.log(`${urls.length} URL(s) on ${HOST}${dryRun ? ' — dry run, nothing sent' : ''}`);
  if (dryRun) {
    for (const u of urls.slice(0, 8)) console.log(`  ${u}`);
    if (urls.length > 8) console.log(`  … +${urls.length - 8} more`);
    return;
  }

  for (let i = 0; i < urls.length; i += CHUNK) {
    const chunk = urls.slice(i, i + CHUNK);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: chunk }),
    });
    const text = (await res.text()).trim();
    console.log(`IndexNow ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''} for ${chunk.length} URL(s)`);
    if (!res.ok) process.exit(1);
  }
  console.log('Done. Bing shows the submission under Webmaster Tools → IndexNow once processed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
