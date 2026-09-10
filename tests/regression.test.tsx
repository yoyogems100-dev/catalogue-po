import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionSecret } from '../lib/session-secret';
import { signAdminToken } from '../lib/auth';
import { signCustomerToken } from '../lib/customer-auth';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

test('sessions require configured secrets and preserve separate admin/customer identities', async () => {
  const admin = process.env.ADMIN_SESSION_SECRET;
  const customer = process.env.CUSTOMER_SESSION_SECRET;
  try {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.CUSTOMER_SESSION_SECRET;
    assert.equal(sessionSecret('admin'), undefined);
    assert.equal(sessionSecret('customer'), undefined);
    assert.throws(() => signAdminToken());
    assert.throws(() => signCustomerToken(1));
    assert.equal((await middleware(new NextRequest('http://localhost/admin'))).status, 307);
    process.env.ADMIN_SESSION_SECRET = 'test-only-secret-not-used-by-any-deployment';
    assert.notEqual(sessionSecret('customer'), sessionSecret('admin'));
    const adminToken = signAdminToken();
    const customerToken = signCustomerToken(123);
    const request = (path: string, name: string, token: string) => new NextRequest(`http://localhost${path}`, { headers: { cookie: `${name}=${token}` } });
    assert.equal((await middleware(request('/admin/categories', 'yoyo_admin_session', adminToken))).status, 200);
    assert.equal((await middleware(request('/account/orders', 'yoyo_customer_session', customerToken))).status, 200);
    assert.equal((await middleware(request('/admin/categories', 'yoyo_admin_session', customerToken))).status, 307);
    assert.equal((await middleware(request('/account/orders', 'yoyo_customer_session', adminToken))).status, 307);
    assert.equal((await middleware(new NextRequest('http://localhost/account/login'))).status, 200);
  } finally {
    if (admin === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = admin;
    if (customer === undefined) delete process.env.CUSTOMER_SESSION_SECRET; else process.env.CUSTOMER_SESSION_SECRET = customer;
  }
});

test('React 19 renders both PDF templates in the server ESM runtime', async () => {
  const { buildSync } = await import('esbuild');
  const { execFileSync } = await import('node:child_process');
  const fs = await import('node:fs');
  const dir = fs.mkdtempSync('node_modules/.yoyo-pdf-test-');
  try {
    const output = `${dir}/check.mjs`;
    buildSync({ entryPoints: ['tests/pdf-fixture.tsx'], outfile: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', tsconfig: 'tests/tsconfig.json' });
    execFileSync(process.execPath, [output], { stdio: 'pipe' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('whole-piece quantities reject decimals, negatives, empty edits and database overflow', async () => {
  const { parseQuantity } = await import('../lib/quantity');
  assert.equal(parseQuantity('5000'), 5000);
  assert.equal(parseQuantity('0012'), 12);
  for (const invalid of ['', '0', '-1', '1.5', 'abc', '2147483648']) assert.equal(parseQuantity(invalid), null);
});

test('a cart from another category never inherits the active category price', async () => {
  const { cartLinePrice } = await import('../lib/pricing-calc');
  const pricing = { multiplier: 12, colorToGroup: { 1: 2 }, priceMap: { '3:4:2': 5 } };
  const item = { categoryId: 10, shapeId: 3, sizeId: 4, colorId: 1 };
  assert.equal(cartLinePrice(pricing, 10, item), 60);
  assert.equal(cartLinePrice(pricing, 11, item), null);
  assert.equal(cartLinePrice(pricing, 10, { ...item, sizeId: null }), null);
  assert.equal(cartLinePrice(pricing, 10, { ...item, colorId: 99 }), null);
});

test('catalogue coverage distinguishes a cover from a usable photo gallery', async () => {
  const { catalogueGaps, matchesCoverage } = await import('../lib/catalogue-health');
  const row = { coverUrl: 'cover.jpg', photoCount: 0, shapeCount: 2, sizeCount: 0, colorCount: 3 };
  assert.deepEqual(catalogueGaps(row), ['photos', 'sizes']);
  assert.equal(matchesCoverage(row, 'cover'), false);
  assert.equal(matchesCoverage(row, 'incomplete'), true);
  assert.equal(matchesCoverage({ ...row, photoCount: 1, sizeCount: 5 }, 'incomplete'), false);
});

test('development authentication codes cannot be enabled in a production build', async () => {
  const { allowDevAuthCodes } = await import('../lib/dev-auth');
  const nodeEnv = process.env.NODE_ENV;
  const optIn = process.env.ALLOW_DEV_AUTH_CODES;
  try {
    Object.assign(process.env, { NODE_ENV: 'production', ALLOW_DEV_AUTH_CODES: 'true' });
    assert.equal(allowDevAuthCodes(), false);
    Object.assign(process.env, { NODE_ENV: 'development', ALLOW_DEV_AUTH_CODES: 'false' });
    assert.equal(allowDevAuthCodes(), false);
    process.env.ALLOW_DEV_AUTH_CODES = 'true';
    assert.equal(allowDevAuthCodes(), true);
  } finally {
    if (nodeEnv === undefined) delete (process.env as any).NODE_ENV; else Object.assign(process.env, { NODE_ENV: nodeEnv });
    if (optIn === undefined) delete process.env.ALLOW_DEV_AUTH_CODES; else process.env.ALLOW_DEV_AUTH_CODES = optIn;
  }
});


test('gallery sizes group equivalent dimensions, preserve IDs and sort decimal dimensions numerically', async () => {
  const { groupSizes } = await import('../lib/size-options');
  assert.deepEqual(groupSizes([
    { id: 1, size_mm: '4 X 6 mm' }, { id: 2, size_mm: '04*6.0' },
    { id: 3, size_mm: '1.5' }, { id: 4, size_mm: '1.25' }, { id: 5, size_mm: '6x4' }
  ]), [
    { key: '1.25', label: '1.25', ids: [4] }, { key: '1.5', label: '1.5', ids: [3] },
    { key: '4x6', label: '4x6', ids: [1, 2] }, { key: '6x4', label: '6x4', ids: [5] }
  ]);
});
