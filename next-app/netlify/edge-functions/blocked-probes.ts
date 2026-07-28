export default function blockedProbes() {
  return new Response('Gone\n', {
    status: 410,
    headers: {
      'Cache-Control': 'public, max-age=86400',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, noarchive',
    },
  });
}

export const config = {
  path: [
    '/wp-admin',
    '/wp-admin/*',
    '/wp-login.php',
    '/xmlrpc.php',
    '/.env',
    '/.env*',
    '/config.json',
    '/.git',
    '/.git/*',
  ],
};
