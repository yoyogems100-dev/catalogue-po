import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { CatalogueMap } from '../lib/catalogue-map';
import { isReady, normalizeLine, parsePastedList, resolveAll } from '../lib/paste-order';
import { resolveSizes } from '../lib/quick-order';
import { planQuantities } from '../lib/qty-mode';

// The live catalogue on 2026-11-23 (every stone, shape and colour; sizes only
// for the shapes this message names), so the test sees the same choices the
// admin's paste dialog does.
const live: CatalogueMap = JSON.parse(readFileSync(path.join(__dirname, 'fixtures', 'catalogue-map-2026-11-23.json'), 'utf8'));

// Sourabh ji's WhatsApp message, entered by hand as production order #30.
const ORDER_30_MESSAGE = `Round 6mm
Round 8mm
Round 5mm
Round 4mm

Sq 6mm
Sq 8mm

Cushion 8mm

Octo step cut
6*8
 7*9
 8*10


7a white


Each 100 pec sample
Proper 7A
Quality`;

// order_items of order #30: [shape_id, shape_size_id]; all 7A Quality (32), White (1), 100 pcs.
const ORDER_30_LINES = [
  [1, 42], [1, 806], [1, 1421], [1, 34], // Round 6, 8, 5, 4 mm
  [71, 2105], [71, 2069], // SQ-Princess 6x6, 8x8
  [6, 141], // Cushion 8x8
  [8, 155], [8, 156], [8, 157], // Octagon Step Cut 6x8, 7x9, 8x10
];

test("order #30: the buyer's WhatsApp list becomes the same 10 lines the team entered", () => {
  const parsed = parsePastedList(ORDER_30_MESSAGE, live);
  const resolved = resolveAll(parsed.rows, {}, live);
  assert.equal(resolved.length, 10);
  assert.ok(resolved.every(isReady), JSON.stringify(resolved.map((r) => [r.missing, r.problem])));
  assert.deepEqual(
    resolved.map((r) => [r.categoryId, r.colorId, r.shapeId, r.sizeId, r.qty]),
    ORDER_30_LINES.map(([shapeId, sizeId]) => [32, 1, shapeId, sizeId, 100]),
  );
  // Nothing from the trailing lines leaks into a line note.
  assert.ok(parsed.rows.every((r) => r.hints.note === ''));
  // What was read as "for every line" is shown, and the words that aren't an order are kept for the note.
  assert.deepEqual(parsed.applied?.map((a) => a.raw), ['7a white', 'Each 100 pec sample', 'Proper 7A']);
  assert.deepEqual(parsed.remarks, ['Each 100 pec sample', 'Proper 7A', 'Quality']);
  assert.deepEqual(parsed.ignored, []);
});

// A small catalogue for the rules on their own.
const ROUND = 1, SQ_PRINCESS = 2, SQ_OCTO = 3, OCTAGON = 4, OCT_STEP = 5, CUSHION = 6;
const small: CatalogueMap = {
  materials: [],
  categories: [
    { id: 32, name: '7A Quality', slug: '7a', colorIds: [1, 2], shapeIds: [ROUND, SQ_PRINCESS, SQ_OCTO, OCT_STEP, CUSHION], sizeIds: [10, 11, 20, 21, 30, 50, 60, 61] },
    { id: 12, name: 'Coloured CZ Stones', slug: 'cz', colorIds: [1, 3], shapeIds: [ROUND, OCTAGON], sizeIds: [10, 40] },
  ],
  shapes: [
    { id: ROUND, name: 'Round', refPhotoUrl: null }, { id: SQ_PRINCESS, name: 'SQ-Princess', refPhotoUrl: null },
    { id: SQ_OCTO, name: 'SQ-Octo', refPhotoUrl: null }, { id: OCTAGON, name: 'Octagon', refPhotoUrl: null },
    { id: OCT_STEP, name: 'Octagon Step Cut', refPhotoUrl: null }, { id: CUSHION, name: 'Cushion', refPhotoUrl: null },
  ],
  sizes: [
    { id: 10, shapeId: ROUND, sizeMm: '6.00' }, { id: 11, shapeId: ROUND, sizeMm: '8.0' },
    { id: 20, shapeId: SQ_PRINCESS, sizeMm: '6x6' }, { id: 21, shapeId: SQ_PRINCESS, sizeMm: '8x8' },
    { id: 30, shapeId: SQ_OCTO, sizeMm: '6x6' }, { id: 40, shapeId: OCTAGON, sizeMm: '6x8' },
    { id: 50, shapeId: OCT_STEP, sizeMm: '6x8' }, { id: 60, shapeId: CUSHION, sizeMm: '8x8' }, { id: 61, shapeId: CUSHION, sizeMm: '8x10' },
  ],
  colors: [
    { id: 1, name: 'White', hex: null, refPhotoUrl: null, familyId: null },
    { id: 2, name: 'Pink', hex: null, refPhotoUrl: null, familyId: null },
    { id: 3, name: 'Yellow', hex: null, refPhotoUrl: null, familyId: null },
  ],
};
const read = (text: string) => {
  const parsed = parsePastedList(text, small);
  return { ...parsed, resolved: resolveAll(parsed.rows, {}, small) };
};

test('"pec" / "pecs" are pieces; 6*8 is 6x8', () => {
  assert.equal(normalizeLine('Each 100 pec sample'), 'each 100pcs sample');
  assert.equal(normalizeLine('200 pecs'), '200pcs');
  assert.equal(normalizeLine('6*8'), '6x8');
});

test('"Sq" is the SQ-Princess, "Octo step cut" the Octagon Step Cut, while "octo" alone stays Octagon', () => {
  const { resolved } = read('Sq 6mm 100 white 7a\nOcto step cut 6*8 100 white 7a\nYellow cz octo 6x8 100');
  assert.deepEqual(resolved.map((r) => [r.shapeId, r.sizeId]), [[SQ_PRINCESS, 20], [OCT_STEP, 50], [OCTAGON, 40]]);
  assert.ok(resolved.every(isReady));
});

test('a shape cut only square: 8mm is its 8x8, and a size it lacks is not stretched to fit', () => {
  const cushion = small.sizes.filter((s) => s.shapeId === CUSHION).map((s) => ({ id: s.id, shape_id: s.shapeId, size_mm: s.sizeMm }));
  assert.deepEqual(resolveSizes(cushion, '8'), { sizes: [cushion[0]] });
  assert.ok('error' in resolveSizes(cushion, '10'));
});

test('a shape line followed by bare sizes; the stone, colour and qty after the list fill every line', () => {
  const { resolved, applied } = read('Round\n6mm\n8mm\nSq 6mm\n\n7a white\neach 50 pcs');
  assert.deepEqual(resolved.map((r) => [r.categoryId, r.colorId, r.shapeId, r.sizeId, r.qty]), [
    [32, 1, ROUND, 10, 50], [32, 1, ROUND, 11, 50], [32, 1, SQ_PRINCESS, 20, 50],
  ]);
  assert.equal(applied?.length, 2);
});

test("trailing lines only fill what a line didn't say", () => {
  const { resolved } = read('Pink Round 6mm 300\nRound 8mm\n7a white\nEach 100 pcs');
  assert.deepEqual(resolved.map((r) => [r.categoryId, r.colorId, r.qty]), [[32, 2, 300], [32, 2, 100]]);
});

test('"Each 100 pcs" before the list sets the quantity for the lines below', () => {
  const { resolved } = read('Each 100 pcs\n7a white\nRound 6mm\nSq 8mm');
  assert.deepEqual(resolved.map((r) => [r.shapeId, r.sizeId, r.qty]), [[ROUND, 10, 100], [SQ_PRINCESS, 21, 100]]);
  assert.ok(resolved.every(isReady));
});

test('a bare quantity under a block is for that block only', () => {
  const { resolved } = read('7a white round\n6mm\n8mm\n500\nSq 6mm');
  assert.deepEqual(resolved.map((r) => r.qty), [500, 500, null]);
  assert.deepEqual(resolved[2].missing, ['quantity']);
});

test('nothing is guessed: an unknown shape or a stone without the shape stays flagged', () => {
  const { resolved } = read('Rodolite 6mm\nRound 6mm\n\nCZ white\nEach 100 pcs');
  assert.equal(isReady(resolved[0]), false);
  assert.match(resolved[0].problem || '', /rodolite/i);
  // Coloured CZ carries Round 6.00, so that line is fine.
  assert.deepEqual([resolved[1].categoryId, resolved[1].sizeId, resolved[1].qty], [12, 10, 100]);
  const cushionInCz = read('Cushion 8mm\nCZ white\neach 100').resolved[0];
  assert.deepEqual(cushionInCz.missing, ['stone']);
});

test('admin order builder qty mode: one qty for all lines, or each its own (empty skipped)', () => {
  const combos = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
  const same = planQuantities(combos, false, '100', { a: '5' });
  assert.deepEqual(same.lines.map((l) => [l.combo.key, l.qty]), [['a', 100], ['b', 100], ['c', 100]]);
  assert.equal(same.total, 300);
  // No shared quantity: nothing to add yet.
  assert.deepEqual(planQuantities(combos, false, '', {}).lines, []);
  // Each its own: a box starts at the shared qty; an emptied or 0 box is skipped.
  const each = planQuantities(combos, true, '100', { a: '250', b: '', c: '0' });
  assert.deepEqual(each.lines.map((l) => [l.combo.key, l.qty]), [['a', 250]]);
  assert.equal(each.total, 250);
  const bad = planQuantities(combos, true, '', { a: '12.5', b: '10' });
  assert.equal(bad.invalid, true);
  assert.deepEqual(bad.lines, []);
});
