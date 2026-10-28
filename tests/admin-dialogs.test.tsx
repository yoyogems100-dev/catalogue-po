import test from 'node:test';
import assert from 'node:assert/strict';
import { labelFor } from '../components/admin/AdminDialogs';

test('the confirm button says what will happen, in red when it destroys something', () => {
  assert.deepEqual(labelFor('Delete this photo? This cannot be undone.'), { label: 'Delete', danger: true });
  assert.deepEqual(labelFor('Remove Ruby from Corundum?'), { label: 'Remove', danger: true });
  assert.deepEqual(labelFor('Archive "Glass Pearls"?'), { label: 'Archive', danger: true });
  assert.deepEqual(labelFor('Permanently delete order #8? This cannot be undone.'), { label: 'Delete for good', danger: true });
  assert.deepEqual(labelFor('Changing the web address breaks links. Continue?'), { label: 'Continue', danger: false });
});
