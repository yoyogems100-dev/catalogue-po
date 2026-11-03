import test from 'node:test';
import assert from 'node:assert/strict';
import { isRoundShape, sizeFitsShape } from '../lib/shape-size-fit';

test('a round shape takes one size or an equal pair', () => {
  assert.equal(sizeFitsShape('Round', '5'), true);
  assert.equal(sizeFitsShape('Round', '0.80'), true);
  assert.equal(sizeFitsShape('Round', '5x5'), true);
  assert.equal(sizeFitsShape('Round Checker', '3x4'), false);
  assert.equal(sizeFitsShape('Round', '5 x 7'), false);
  assert.equal(sizeFitsShape('Round (16 Hearts 16 Arrows)', '6×8'), false);
});

test('other shapes keep every size', () => {
  assert.equal(sizeFitsShape('Oval', '5x7'), true);
  assert.equal(sizeFitsShape('Octagon', '10x14'), true);
  assert.equal(sizeFitsShape(undefined, '3x4'), true);
  assert.equal(isRoundShape('Rose Round'), false);
});
