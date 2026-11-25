import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanDraftPayload, MAX_DRAFT_LINES } from '../lib/order-draft-payload';
import { cleanColorInput, DEFAULT_COLOR_HEX } from '../lib/color-input';
import { currentHref, WORKSPACES } from '../components/admin/nav-config';

const line = { id: 'a', categoryId: 3, categoryName: 'CZ', shapeId: 1, shapeName: 'Round', sizeId: 9, sizeMm: '2.5', colorId: 4, colorName: 'Ruby', colorCode: 'R1', qty: 500, note: 'urgent' };

test('a draft keeps the customer, every line and the order fields', () => {
  const r = cleanDraftPayload({ customerMode: 'existing', selectedCustomerId: 12, requestType: 'Place Order', comment: 'Phone call', fromJaipur: true, cart: [line, { ...line, id: 'b', orderSpecs: { kind: 'grade', grade: '5A' } }] });
  assert.ok('payload' in r);
  assert.equal(r.customerId, 12);
  assert.equal(r.payload.cart.length, 2);
  assert.deepEqual(r.payload.cart[0], line);
  assert.deepEqual(r.payload.cart[1].orderSpecs, { kind: 'grade', grade: '5A' });
  assert.equal(r.payload.fromJaipur, true);
  assert.equal(r.payload.comment, 'Phone call');
});

test('a new-customer draft keeps the typed name and phone, and no customer id', () => {
  const r = cleanDraftPayload({ customerMode: 'new', selectedCustomerId: 12, newName: 'Ravi', newPhone: '98765 43210', cart: [] });
  assert.ok('payload' in r);
  assert.equal(r.customerId, null);
  assert.equal(r.payload.newName, 'Ravi');
  assert.equal(r.payload.newPhone, '98765 43210');
});

test('an empty draft, bad lines or a huge cart are refused', () => {
  assert.ok('error' in cleanDraftPayload({ customerMode: 'existing', cart: [] }));
  assert.ok('error' in cleanDraftPayload(null));
  assert.ok('error' in cleanDraftPayload({ selectedCustomerId: 1, cart: 'nope' }));
  assert.ok('error' in cleanDraftPayload({ selectedCustomerId: 1, cart: Array.from({ length: MAX_DRAFT_LINES + 1 }, () => line) }));
});

test('unknown fields are dropped and odd values made safe', () => {
  const r = cleanDraftPayload({ selectedCustomerId: 5, requestType: 'DROP TABLE', status: 'delivered', cart: [{ ...line, qty: -4, extra: 'x' }] });
  assert.ok('payload' in r);
  assert.equal(r.payload.requestType, 'Place Order');
  assert.equal((r.payload as any).status, undefined);
  assert.equal(r.payload.cart[0].qty, 0);
  assert.equal((r.payload.cart[0] as any).extra, undefined);
});

test('a new colour needs a name; the swatch is optional but must be a real colour', () => {
  assert.deepEqual(cleanColorInput('  Peach   Pink ', '#ffaa88'), { name: 'Peach Pink', hex: '#FFAA88' });
  assert.deepEqual(cleanColorInput('Peach', ''), { name: 'Peach', hex: DEFAULT_COLOR_HEX });
  assert.ok('error' in cleanColorInput('  ', '#ffffff'));
  assert.ok('error' in cleanColorInput('Peach', 'red; drop'));
});

test('Draft orders sits in the PO portal Orders group and highlights on its own', () => {
  const orders = WORKSPACES.find((w) => w.key === 'po')!.groups.find((g) => g.title === 'Orders')!;
  assert.ok(orders.links.some((l) => l.href === '/admin/orders/drafts'));
  assert.equal(currentHref('/admin/orders/drafts'), '/admin/orders/drafts');
  assert.equal(currentHref('/admin/orders/12'), '/admin/orders');
});

test('drafts never reach order queries: only the drafts code touches order_drafts', () => {
  // The create route only deletes a placed draft; no order list, count,
  // notification or customer page reads the table.
  const create = readFileSync(new URL('../app/api/admin/orders/create/route.ts', import.meta.url), 'utf8');
  assert.match(create, /deleteOrderDraft\(draftId\)/);
  const orders = readFileSync(new URL('../app/admin/orders/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(orders, /from\('order_drafts'\)/);
});
