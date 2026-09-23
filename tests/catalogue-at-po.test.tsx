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
  // the site root must not become 404s -- they are forwarded, query intact.
  const cases: [string, string][] = [
    ['/category/crushed-ice-cut', '/po/category/crushed-ice-cut'],
    ['/cart', '/po/cart'],
    ['/browse?tag=4', '/po/browse'],
    ['/account/orders', '/po/account/orders'],
    ['/account/login', '/po/account/login']
  ];
  for (const [from, expected] of cases) {
    const res = await get(from);
    assert.equal(res.status, 308, from);
    const to = new URL(res.headers.get('location')!);
    assert.equal(to.pathname, expected, from);
  }
  assert.equal(new URL((await get('/browse?tag=4')).headers.get('location')!).search, '?tag=4');

  // The admin workspace and every API route deliberately did not move: the
  // mobile app calls /api/app/* directly and has no way to learn a new prefix
  // without a new build in the stores.
  assert.equal(new URL((await get('/admin')).headers.get('location')!).pathname, '/login');
});
