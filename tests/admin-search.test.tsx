import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanQuery, rankItems, scoreItem, staticSearchItems } from '../lib/admin-search';
import { notificationHref, notificationLabel } from '../lib/notifications';

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

test('catalogue pricing is hidden while prices are switched off', () => {
  assert.ok(!items.some((r) => r.href === '/admin/pricing' || r.href.endsWith('tab=pricing')));
});
