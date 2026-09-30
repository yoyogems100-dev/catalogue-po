import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import AccessRequests from '../components/admin/AccessRequests';
import { ACCESS_REQUEST_TAG, withoutAccessRequest } from '../lib/access-requests';

test('sign-up requests list on the admin overview with a way to set a PIN', () => {
  const html = renderToStaticMarkup(<AccessRequests initial={[{ id: 7, name: 'Rajesh Kumar', company: 'Kumar Gems', phone: '919876543210', createdAt: '2026-09-30T10:00:00Z' }]} />);
  assert.match(html, /Access requests/);
  assert.match(html, /Rajesh Kumar/);
  assert.match(html, /href="\/admin\/customers\/7#pw-heading"[^>]*>Set PIN/);
  assert.equal(renderToStaticMarkup(<AccessRequests initial={[]} />), '');
});

test('setting a PIN or dismissing only removes the request tag', () => {
  assert.deepEqual(withoutAccessRequest(['wholesale', ACCESS_REQUEST_TAG]), ['wholesale']);
  assert.deepEqual(withoutAccessRequest(null), []);
});

test('Sign up can reach the access-request endpoint signed out; dismissing one needs admin', async () => {
  const { NextRequest } = await import('next/server');
  const { middleware } = await import('../middleware');
  const secret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
  try {
    const get = (path: string) => middleware(new NextRequest(`http://localhost${path}`));
    assert.equal((await get('/api/account/access-request')).status, 200);
    assert.equal((await get('/api/admin/customers/1/access-request')).status, 401);
  } finally {
    if (secret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = secret;
  }
});
