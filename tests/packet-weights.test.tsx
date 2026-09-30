import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePacketWeights, packetGroups, weighedPackets, type PacketLine } from '../lib/packet-weights';

const line = (shapeId: number, shapeName: string, sizeId: number, sizeMm: string, quantity: number): PacketLine =>
  ({ categoryId: 45, categoryName: 'Semi Precious Beads', shapeId, shapeName, sizeId, sizeMm, quantity, qtyUnit: 'lines' });
const lines = [line(1, 'Oval', 10, '6x8', 8), line(1, 'Oval', 10, '6x8', 8), line(1, 'Oval', 11, '8x10', 5), line(2, 'Heart', 20, '10', 5)];

test('lines fall into packets by shape, or by shape and size', () => {
  assert.deepEqual(packetGroups(lines, 'shape').map((g) => [g.label, g.count, g.quantity]), [['Oval', '3 materials', '21 lines'], ['Heart', '1 material', '5 lines']]);
  assert.deepEqual(packetGroups(lines, 'shape_size').map((g) => [g.label, g.lines, g.quantity]),
    [['Oval 6x8 mm', 2, '16 lines'], ['Oval 8x10 mm', 1, '5 lines'], ['Heart 10 mm', 1, '5 lines']]);
});

test('only weighed packets reach the document, in their own unit', () => {
  const saved = normalizePacketWeights({ mode: 'shape_size', packets: [{ categoryId: 45, shapeId: 1, sizeId: 10, weight: '14.25', unit: 'ct' }] });
  assert.deepEqual(weighedPackets(lines, saved).map((p) => [p.label, p.weight]), [['Oval 6x8 mm', '14.25 ct']]);
  assert.equal(normalizePacketWeights({ mode: 'shape', packets: [{ categoryId: 45, shapeId: 1, weight: 0, unit: 'ct' }] }), undefined);
  assert.equal(normalizePacketWeights({ mode: 'shape', packets: [{ categoryId: 45, shapeId: 1, weight: 2, unit: 'kg' }] }), undefined);
  assert.equal(normalizePacketWeights({ mode: 'other', packets: [] }), undefined);
});
