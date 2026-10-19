import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuery, mergeResults, rankItems, scoreItem, staticSearchItems } from '../lib/admin-search';
import { notificationHref, notificationLabel } from '../lib/notifications';
import { ADMIN_PRICING_ENABLED } from '../lib/pricing-calc';

const items = staticSearchItems(
  [{ id: 34, name: 'Moissanite' }, { id: 1, name: 'Cubic Zirconia' }, { id: 20, name: 'Hole Punched Stones' }],
  [{ id: 5, name: 'Gemstones' }, { id: 6, name: 'Moissanite', parent: 'Gemstones' }]
);

test('a category name finds the category first, then its pages', () => {
  const top = rankItems(items, 'moiss');
  assert.equal(top[0].href, '/admin/categories/34');
  assert.ok(top.some((r) => r.href === '/admin/site/categories/6'), 'website category too');
  assert.ok(top.some((r) => r.href === '/admin/categories/34?tab=suppliers'));
});

test('two words go straight to a category tab', () => {
  assert.equal(rankItems(items, 'moissanite suppliers')[0].href, '/admin/categories/34?tab=suppliers');
});

test('pages and quick actions are findable by name and by what they do', () => {
  assert.equal(rankItems(items, 'suppliers')[0].href, '/admin/suppliers');
  assert.equal(rankItems(items, 'new customer')[0].href, '/admin/customers?new=1');
  assert.ok(rankItems(items, 'shapes').some((r) => r.href === '/admin/shapes'));
  assert.ok(rankItems(items, 'notif').some((r) => r.href === '/admin/notifications'));
});

test('every typed word must match', () => {
  assert.equal(scoreItem({ kind: 'page', label: 'Customers', href: '/admin/customers' }, 'customers zzz'), 0);
  assert.deepEqual(rankItems(items, 'qqqq'), []);
});

test('queries are made safe for the database filter', () => {
  assert.equal(cleanQuery('a,b(c)*%d'), 'a b c d');
  assert.equal(cleanQuery('  6x8  '), '6x8');
});

test('each notification opens the right page', () => {
  assert.equal(notificationHref({ type: 'new_order', order_id: 12, link: null }), '/admin/orders/12');
  assert.equal(notificationHref({ type: 'access_request', order_id: null, link: '/admin#access-requests' }), '/admin#access-requests');
  assert.equal(notificationHref({ type: 'catalogue_request', order_id: null, link: null }), '/admin/site/leads');
  // Only admin pages: a stored link elsewhere is ignored.
  assert.equal(notificationHref({ type: 'new_order', order_id: 3, link: 'https://example.com' }), '/admin/orders/3');
  assert.equal(notificationLabel('access_request'), 'Sign-up request');
});

test('admin pricing pages are searchable only while admin pricing is on', () => {
  const found = items.some((r) => r.href === '/admin/pricing' || r.href.endsWith('tab=pricing'));
  assert.equal(found, ADMIN_PRICING_ENABLED);
});

test('an order or phone number puts the exact server hit first; words put pages first', () => {
  const order = { kind: 'order' as const, label: 'Order #34', href: '/admin/orders/34' };
  const page = { kind: 'category' as const, label: 'Moissanite', href: '/admin/categories/34' };
  assert.equal(mergeResults('34', [page], [order])[0].href, '/admin/orders/34');
  assert.equal(mergeResults('#34', [page], [order])[0].href, '/admin/orders/34');
  assert.equal(mergeResults('98290 12345', [page], [order])[0].href, '/admin/orders/34');
  assert.equal(mergeResults('moiss', [page], [order])[0].href, '/admin/categories/34');
});

test('the same place found twice shows once', () => {
  const a = { kind: 'action' as const, label: 'Pending lines', href: '/admin/pending' };
  const b = { kind: 'page' as const, label: 'Pending lines', href: '/admin/pending' };
  assert.deepEqual(mergeResults('pending', [a, b], []).map((r) => r.kind), ['action']);
  assert.equal(rankItems(items, 'pending')[0].href, '/admin/pending');
});
