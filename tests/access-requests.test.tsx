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
