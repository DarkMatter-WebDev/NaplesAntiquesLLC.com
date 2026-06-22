import { performance } from 'node:perf_hooks';

const baseUrl = process.env.PROBE_BASE_URL ?? 'http://127.0.0.1:3000';
const targets = (process.env.ROUTE_PROBE_PATHS ?? '/,/shop,/api/metal-prices')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function formatMs(ms) {
  return `${ms.toFixed(1)} ms`;
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`;
}

async function measure(pathname) {
  const url = new URL(pathname, baseUrl);
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: {
      'Accept-Encoding': 'br, gzip',
    },
  });
  const ttfbAt = performance.now();
  const body = await response.arrayBuffer();
  const endedAt = performance.now();

  return {
    pathname,
    status: response.status,
    ttfbMs: ttfbAt - startedAt,
    totalMs: endedAt - startedAt,
    downloadMs: endedAt - ttfbAt,
    bytes: body.byteLength,
    encoding: response.headers.get('content-encoding') ?? '(none)',
    cacheControl: response.headers.get('cache-control') ?? '(none)',
    nextCache: response.headers.get('x-nextjs-cache') ?? response.headers.get('x-vercel-cache') ?? '(none)',
  };
}

for (const target of targets) {
  const result = await measure(target);
  console.log(`${result.pathname} ${result.status}`);
  console.log(`  document/API TTFB: ${formatMs(result.ttfbMs)}`);
  console.log(`  payload size: ${formatBytes(result.bytes)} (${result.encoding})`);
  console.log(`  download/read cost: ${formatMs(result.downloadMs)}`);
  console.log(`  total route time: ${formatMs(result.totalMs)}`);
  console.log(`  cache-control: ${result.cacheControl}`);
  console.log(`  cache status: ${result.nextCache}`);
}
