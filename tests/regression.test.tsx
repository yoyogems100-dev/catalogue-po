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
  const pricing = { colorToGroup: { 1: 2 }, priceMap: { '3:4:2': 55 } };
  const item = { categoryId: 10, shapeId: 3, sizeId: 4, colorId: 1 };
  // Priced from its own category's list...
  assert.equal(cartLinePrice({ 10: pricing }, item), 55);
  // ...and never from a different category's list, however similar the codes.
  assert.equal(cartLinePrice({ 11: pricing }, item), null);
  assert.equal(cartLinePrice({}, item), null);
  assert.equal(cartLinePrice(undefined, item), null);
  assert.equal(cartLinePrice({ 10: pricing }, { ...item, sizeId: null }), null);
  assert.equal(cartLinePrice({ 10: pricing }, { ...item, colorId: 99 }), null);
});

test('a cart spanning categories prices every line, not just the active one', async () => {
  const { cartLinePrice } = await import('../lib/pricing-calc');
  // Same shape/size/colour codes in both categories, deliberately: the only
  // thing that may decide the price is which category the line belongs to.
  const crushedIce = { colorToGroup: { 1: 2 }, priceMap: { '3:4:2': 55 } };
  const nano = { colorToGroup: { 1: 2 }, priceMap: { '3:4:2': 18 } };
  const byCategory = { 10: crushedIce, 20: nano };

  const cart = [
    { categoryId: 10, shapeId: 3, sizeId: 4, colorId: 1, qty: 100 },
    { categoryId: 20, shapeId: 3, sizeId: 4, colorId: 1, qty: 200 },
    { categoryId: 30, shapeId: 3, sizeId: 4, colorId: 1, qty: 400 } // no price list yet
  ];

  assert.equal(cartLinePrice(byCategory, cart[0]), 55);
  assert.equal(cartLinePrice(byCategory, cart[1]), 18);
  assert.equal(cartLinePrice(byCategory, cart[2]), null);

  // The estimated total covers every priced line regardless of which category
  // page the buyer happens to be looking at.
  const total = cart.reduce((sum, line) => {
    const unit = cartLinePrice(byCategory, line);
    return unit === null ? sum : sum + unit * line.qty;
  }, 0);
  assert.equal(total, 55 * 100 + 18 * 200);
});

test('an unmapped color or unpriced shape/size never silently prices at a wrong value', async () => {
  const { lineInrPrice } = await import('../lib/pricing-calc');
  const base = { colorToGroup: { 1: 2 }, priceMap: { '3:4:2': 55 } };
  // A color with no pricing-group mapping must fail to null, not fall back to 0.
  assert.equal(lineInrPrice(base, 3, 4, 99), null);
  // A shape/size with no saved price must fail to null too.
  assert.equal(lineInrPrice(base, 3, 999, 1), null);
  // A real configured price still resolves directly (no conversion applied).
  assert.equal(lineInrPrice(base, 3, 4, 1), 55);
});

test('the Edge-runtime session cookie check compares MACs, not just lengths', async () => {
  const { timingSafeEqualHex } = await import('../middleware');
  const mac = 'a'.repeat(64);
  assert.equal(timingSafeEqualHex(mac, mac), true);
  assert.equal(timingSafeEqualHex(mac, 'b'.repeat(64)), false);
  // Differs only in the last character -- must still be rejected, not short-circuit-accepted.
  assert.equal(timingSafeEqualHex(mac, 'a'.repeat(63) + 'b'), false);
  assert.equal(timingSafeEqualHex(mac, 'a'.repeat(63)), false);
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

test('a quotation never shows a price, even where the catalogue has one', async () => {
  const { cartLinePrice } = await import('../lib/pricing-calc');
  // POSelector.unitPriceInr short-circuits quotation lines before consulting the
  // price list; this pins the rule that makes that safe -- the underlying
  // lookup DOES have a price here, so the null must come from the request type.
  const pricing = { colorToGroup: { 1: 2 }, priceMap: { '3:4:2': 55 } };
  const line = { categoryId: 10, shapeId: 3, sizeId: 4, colorId: 1 };
  assert.equal(cartLinePrice({ 10: pricing }, line), 55);

  const unitPriceInr = (item: typeof line & { requestType: string }) =>
    item.requestType === 'Request Quotation' ? null : cartLinePrice({ 10: pricing }, item);

  assert.equal(unitPriceInr({ ...line, requestType: 'Place Order' }), 55);
  assert.equal(unitPriceInr({ ...line, requestType: 'Request Quotation' }), null);
});

test('quotation lines may carry no quantity, purchase lines may not', async () => {
  const { parseQuantity } = await import('../lib/quantity');
  // Mirrors the guard in app/api/orders/create/route.ts. 0 is the stored
  // sentinel for "not specified" (order_items.quantity is NOT NULL).
  const rejects = (item: { qty: unknown; requestType: string }) => {
    if (typeof item.qty !== 'number' || !Number.isInteger(item.qty) || item.qty < 0) return true;
    if (item.requestType === 'Request Quotation') return item.qty !== 0 && parseQuantity(String(item.qty)) === null;
    return parseQuantity(String(item.qty)) === null;
  };

  assert.equal(rejects({ qty: 0, requestType: 'Request Quotation' }), false, 'blank quotation qty is allowed');
  assert.equal(rejects({ qty: 500, requestType: 'Request Quotation' }), false, 'quotation with a qty is allowed');
  assert.equal(rejects({ qty: 0, requestType: 'Place Order' }), true, 'purchase still needs a quantity');
  assert.equal(rejects({ qty: -5, requestType: 'Request Quotation' }), true, 'negatives rejected either way');
  assert.equal(rejects({ qty: 1.5, requestType: 'Request Quotation' }), true, 'decimals rejected either way');
  assert.equal(rejects({ qty: 2147483648, requestType: 'Request Quotation' }), true, 'database overflow rejected');
});

test('shapes that share no size with the current pick are offered as disabled, never hidden', async () => {
  const { incompatibleShapeIds } = await import('../lib/shape-size-compat');
  const shapes = [{ id: 10 }, { id: 20 }, { id: 30 }];
  const sizes = [
    { shapeId: 10, sizeMm: '4x4' }, { shapeId: 10, sizeMm: '5x5' },
    { shapeId: 20, sizeMm: ' 5X5 ' },            // shares 5x5 with shape 10, spelled differently
    { shapeId: 30, sizeMm: '9x9' }               // shares nothing
  ];
  const incompatible = (picked: number[]) => incompatibleShapeIds(shapes, sizes, picked);

  assert.deepEqual(incompatible([]), [], 'nothing picked yet -- everything is offerable');
  assert.deepEqual(incompatible([10]), [30], 'only the shape sharing no size is disabled');
  // Sizes are matched on the millimetre label, so casing and stray spaces in
  // one category's rows never split a size a buyer reads as the same.
  assert.deepEqual(incompatible([10, 20]), [30], 'still disabled once the pick narrows to 5x5');
  // A selected shape is never disabled, so the buyer can always deselect out.
  assert.equal(incompatible([10, 20]).includes(10), false);
  assert.equal(incompatible([10, 20]).includes(20), false);
  // And a pick that already shares nothing greys out nobody -- otherwise the
  // whole list locks and there is no way back.
  assert.deepEqual(incompatible([10, 30]), []);
});

test('the same number in any written form resolves to one customer', async () => {
  const { normalizePhone, isUsablePhone } = await import('../lib/phone');
  // Identity used a bare digit strip, so each of these became a SEPARATE
  // customer -- signing in with a different form of your own number produced a
  // new, empty account with none of your orders or profile on it.
  const forms = ['9079914601', '+91 90799 14601', '+919079914601', '0091 9079914601', '09079914601', '91-90799-14601'];
  const canonical = forms.map(normalizePhone);
  assert.deepEqual(new Set(canonical), new Set(['9079914601']), 'every written form collapses to one key');

  // A genuine 10-digit number that happens to start "91" must not be truncated.
  assert.equal(normalizePhone('9188888888'), '9188888888');
  assert.equal(normalizePhone('+91 9188888888'), '9188888888');

  // Non-Indian numbers keep their full digit string, matched consistently.
  assert.equal(normalizePhone('+1 (415) 555-0134'), '14155550134');
  assert.equal(normalizePhone('+1 415 555 0134'), '14155550134');

  assert.equal(normalizePhone(''), '');
  assert.equal(normalizePhone(null), '');
  assert.equal(isUsablePhone('98765'), false);
  assert.equal(isUsablePhone('+91 90799 14601'), true);
});
