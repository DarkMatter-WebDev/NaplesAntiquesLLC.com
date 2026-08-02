const baseUrl = process.env.PROBE_BASE_URL ?? 'http://127.0.0.1:3000';
const minCompressedBytes = Number(process.env.COMPRESSION_MIN_BYTES ?? 1024);

const targets = [
  '/',
  '/shop',
  '/api/metal-prices',
  '/sitemap.xml',
];

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`;
}

async function checkTarget(pathname) {
  const url = new URL(pathname, baseUrl);
  const response = await fetch(url, {
    headers: {
      'Accept-Encoding': 'br, gzip',
    },
  });
  const bytes = (await response.arrayBuffer()).byteLength;
  const encoding = response.headers.get('content-encoding') ?? '';
  const contentType = response.headers.get('content-type') ?? '';
  const cacheControl = response.headers.get('cache-control') ?? '';
  const shouldBeCompressed = bytes >= minCompressedBytes && /json|text|html|javascript|css/i.test(contentType);
  const pass = !shouldBeCompressed || Boolean(encoding);

  return {
    pathname,
    status: response.status,
    bytes,
    encoding: encoding || '(none)',
    contentType,
    cacheControl,
    pass,
    shouldBeCompressed,
  };
}

const results = [];
for (const target of targets) {
  results.push(await checkTarget(target));
}

for (const result of results) {
  const label = result.pass ? 'PASS' : 'FAIL';
  const requirement = result.shouldBeCompressed ? 'compressed' : 'tiny/uncompressed OK';
  console.log(
    `${label} ${result.pathname} ${result.status} ${formatBytes(result.bytes)} ` +
    `encoding=${result.encoding} type=${result.contentType || '(none)'} ${requirement}`,
  );
  if (result.cacheControl) console.log(`  cache-control: ${result.cacheControl}`);
}

const failures = results.filter((result) => !result.pass);
if (failures.length > 0) {
  process.exitCode = 1;
}
