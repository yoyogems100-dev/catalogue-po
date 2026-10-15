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

test('checker cuts: round, pear, oval and marquise outlines with a checkerboard crown', () => {
  for (const base of ['round', 'pear', 'oval', 'marquise']) {
    const key = `${base}-checker`;
    assert.ok(THREE_VIEW_KEYS.includes(key), key);
    const checker = threeView(key), plain = threeView(base);
    assert.notEqual(checker.d, plain.d);
    assert.equal(checker.height, 24);
    assert.ok(Math.abs(checker.width - plain.width) < 1.5, `${key} keeps its base proportions`);
    assert.ok(!/NaN|Infinity/.test(checker.d), `${key} draws cleanly`);
  }
});
