import test from 'node:test';
import assert from 'node:assert/strict';
import { groupSizeLabel, sameSizeKey, shapeSizeLabel, sizeGeometry } from '../lib/size-label';
import { fittingSizes, sizeFitsShape } from '../lib/shape-size-fit';
import { sizeGroupsOf } from '../lib/faceted-picker';

test('round sizes read as one diameter with two decimals', () => {
  assert.equal(shapeSizeLabel('Round', '3'), '3.00 mm');
  assert.equal(shapeSizeLabel('Round Checker', '2.5'), '2.50 mm');
  assert.equal(shapeSizeLabel('Round', '3x3'), '3.00 mm');
});

test('square-sided sizes read as both sides', () => {
  assert.equal(shapeSizeLabel('SQ-Octo', '3.0'), '3 x 3');
  assert.equal(shapeSizeLabel('SQ-Octo', '3x3'), '3 x 3');
  assert.equal(shapeSizeLabel('Cushion', '10.5x10.5'), '10.5 x 10.5');
  assert.equal(shapeSizeLabel('Cushion', '6x8'), '6 x 8');
  assert.equal(shapeSizeLabel('Oval', '6x8'), '6 x 8');
  assert.equal(sizeGeometry('Cushion Elongated'), 'other');
  assert.equal(shapeSizeLabel('Coin', 'Custom'), 'Custom');
});

test('3, 3.0, 3.00 and 3x3 are one size', () => {
  assert.equal(sameSizeKey('3'), sameSizeKey('3.00'));
  assert.equal(sameSizeKey('3x3'), sameSizeKey('3.0'));
  assert.notEqual(sameSizeKey('3x5'), sameSizeKey('3'));
  const groups = sizeGroupsOf([{ id: 1, shapeId: 3, sizeMm: '3.0' }, { id: 2, shapeId: 3, sizeMm: '3x3' }, { id: 3, shapeId: 1, sizeMm: '3.00' }]);
  assert.equal(groups.length, 1);
});

test('a size across shapes uses their shared label, else a neutral one', () => {
  assert.equal(groupSizeLabel([{ shapeName: 'Round', sizeMm: '3' }, { shapeName: 'Round Checker', sizeMm: '3.0' }]), '3.00 mm');
  assert.equal(groupSizeLabel([{ shapeName: 'Round', sizeMm: '3' }, { shapeName: 'SQ-Octo', sizeMm: '3x3' }]), '3 mm');
});

test('square shapes drop rectangle sizes', () => {
  assert.equal(sizeFitsShape('SQ-Octo', '6x9'), false);
  assert.equal(sizeFitsShape('Asscher', '4x4'), true);
  assert.equal(sizeFitsShape('Cushion', '6x8'), true);
  const kept = fittingSizes([{ id: 1, shape_id: 3, size_mm: '6x9' }, { id: 2, shape_id: 3, size_mm: '6x6' }, { id: 3, shape_id: 66, size_mm: '6x9' }], [{ id: 3, name: 'SQ-Octo' }, { id: 66, name: 'Oval' }]);
  assert.deepEqual(kept.map((k) => k.id), [2, 3]);
});
