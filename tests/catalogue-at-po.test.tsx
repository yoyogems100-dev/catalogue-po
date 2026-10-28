import test from 'node:test';
import assert from 'node:assert/strict';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

const get = (path: string) => middleware(new NextRequest(`http://localhost${path}`));

test('the site root is a public landing page, and the catalogue lives under /po', async () => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
  try {
    // The landing page is the one thing a stranger may see. It carries no
    // categories, photos or prices -- only the way in.
    assert.equal((await get('/')).status, 200);

    // Everything the catalogue is made of stays behind sign-in at its new address.
    for (const path of ['/po', '/po/browse', '/po/cart', '/po/category/crushed-ice-cut']) {
      const res = await get(path);
      assert.equal(res.status, 307, path);
      const to = new URL(res.headers.get('location')!);
      assert.equal(to.pathname, '/po/account/login', path);
      // The root of the catalogue is the default landing spot after sign-in, so
      // it needs no ?next=; a deeper page does.
      assert.equal(to.searchParams.get('next'), path === '/po' ? null : path);
    }
  } finally {
    if (secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = secret;
  }
});

test('links shared before the move still reach the page they named', async () => {
  // Bookmarks, WhatsApp messages and order PDFs sent while the catalogue was at
  // the site root must not become 404s -- next.config's redirects forward them,
  // query intact (Next keeps the query on a redirect by default).
  const { default: nextConfig } = await import('../next.config.js');
  const rules = (await nextConfig.redirects()) as { source: string; destination: string; permanent: boolean }[];
  const forward = (path: string) => {
    for (const r of rules) {
      const prefix = r.source.replace('/:path*', '');
      if (r.source.endsWith('/:path*') ? path.startsWith(`${prefix}/`) : path === r.source) {
        assert.equal(r.permanent, true, path);
        return r.destination.replace('/:path*', path.slice(prefix.length));
      }
    }
    return null;
  };
  const cases: [string, string][] = [
    ['/category/crushed-ice-cut', '/po/category/crushed-ice-cut'],
    ['/cart', '/po/cart'],
    ['/browse', '/po/browse'],
    ['/account/orders', '/po/account/orders'],
    ['/account/login', '/po/account/login']
  ];
  for (const [from, expected] of cases) assert.equal(forward(from), expected, from);
  // Look-alikes and the website's own pages are not forwarded.
  for (const path of ['/categories', '/cartier', '/products/cz', '/about']) assert.equal(forward(path), null, path);

  // The admin workspace and every API route deliberately did not move: the
  // mobile app calls /api/app/* directly and has no way to learn a new prefix
  // without a new build in the stores.
  assert.equal(new URL((await get('/admin')).headers.get('location')!).pathname, '/login');
});

test('the sign-in check runs only on the private app, not the public website', async () => {
  const { unstable_doesMiddlewareMatch } = await import('next/experimental/testing/server');
  const { config } = await import('../middleware');
  const runs = (path: string) => unstable_doesMiddlewareMatch({ config, url: path });
  for (const path of ['/po', '/po/category/ruby', '/admin', '/admin/orders/5', '/api/category-options', '/api/admin/orders', '/api/app/categories'])
    assert.equal(runs(path), true, path);
  for (const path of ['/', '/about', '/products/cz/4a', '/charts/shapes', '/login', '/robots.txt', '/sitemap.xml', '/api/site/og', '/logo.png', '/_next/static/x.js'])
    assert.equal(runs(path), false, path);
});

test('crawlers stay off filtered category URLs, and a few bots stay off entirely', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'synthetic-test-key';
  const { default: robots } = await import('../app/robots');
  const rules = robots().rules as { userAgent: string | string[]; disallow?: string | string[] }[];
  const all = rules.find((r) => r.userAgent === '*')!;
  assert.ok((all.disallow as string[]).includes('/products/*?*'));
  for (const bot of ['Amazonbot', 'PetalBot', 'DotBot']) {
    const rule = rules.find((r) => Array.isArray(r.userAgent) && r.userAgent.includes(bot));
    assert.equal(rule?.disallow, '/', bot);
  }

  // Filtered views also answer noindex (a static header, no function call).
  const { default: nextConfig } = await import('../next.config.js');
  const headers = (await nextConfig.headers()) as { source: string; has: { type: string; key: string }[]; headers: { key: string; value: string }[] }[];
  assert.deepEqual(headers.map((h) => h.has[0].key).sort(), ['colour', 'grade', 'shape', 'size']);
  for (const h of headers) {
    assert.equal(h.source, '/products/:path*');
    assert.deepEqual(h.headers, [{ key: 'X-Robots-Tag', value: 'noindex, follow' }]);
  }
});
