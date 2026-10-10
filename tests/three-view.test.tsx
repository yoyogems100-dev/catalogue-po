import test from 'node:test';
import assert from 'node:assert/strict';
import { threeView, THREE_VIEW_KEYS } from '../lib/three-view';

test('every cut has a top, side and bottom drawing, wider than it is tall', () => {
  for (const key of THREE_VIEW_KEYS) {
    const v = threeView(key);
    assert.equal(v.height, 24, key);
    assert.ok(v.width > 40 && v.width < 110, `${key} width ${v.width}`);
    assert.ok(v.d.startsWith('M') && v.d.length > 200, key);
    assert.ok(!/NaN|Infinity/.test(v.d), `${key} has a bad point`);
  }
});

test('an unknown or missing key still draws a stone', () => {
  assert.equal(threeView('no-such-cut').d, threeView('diamond').d);
  assert.equal(threeView(null).d, threeView('diamond').d);
});
