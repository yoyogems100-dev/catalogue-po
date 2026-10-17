import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogueMap } from '../lib/catalogue-map';
import { isReady, normalizeLine, noteLines, parsePastedList, resolveAll, type ResolveContext } from '../lib/paste-order';
import { tableGroups, tableHasError, tableLines } from '../lib/size-table';

// A small catalogue shaped like the live one: Nano, Coloured CZ (and a second
// CZ stone that also has Yellow), Ruby Corundum with 5A / 7A, Rainbow.
const OVAL_PEAR = ['4x6', '5x7', '6x8', '7x9', '8x10', '9x11', '10x14'];
let nextSize = 100;
const sizes: CatalogueMap['sizes'] = [];
const sizeIds = (shapeId: number, list: string[]) => list.map((sizeMm) => {
  const found = sizes.find((s) => s.shapeId === shapeId && s.sizeMm === sizeMm);
  if (found) return found.id;
  sizes.push({ id: nextSize, shapeId, sizeMm });
  return nextSize++;
});
const PEAR = 1, OVAL = 2, OCTAGON = 3, ROUND_CHECKER = 4, ROUND = 5;
const pearSizes = sizeIds(PEAR, OVAL_PEAR), ovalSizes = sizeIds(OVAL, OVAL_PEAR);
const octSizes = sizeIds(OCTAGON, ['4x6', '5x7', '6x8', '7x9', '8x10', '10x12']);
const checkerSizes = sizeIds(ROUND_CHECKER, ['3', '4', '5']);
const roundSizes = sizeIds(ROUND, ['1.1', '1.2', '2.1', '3']);

const map: CatalogueMap = {
  materials: [],
  categories: [
    { id: 3, name: 'Nano', slug: 'nano', colorIds: [114, 20], shapeIds: [PEAR, OVAL, ROUND], sizeIds: [...pearSizes, ...ovalSizes, ...roundSizes] },
    { id: 12, name: 'Coloured CZ Stones', slug: 'cz', colorIds: [30, 31, 32], shapeIds: [PEAR, OVAL, OCTAGON, ROUND_CHECKER], sizeIds: [...pearSizes, ...ovalSizes, ...octSizes, ...checkerSizes] },
    { id: 38, name: 'Heighted CZ Stones', slug: 'hcz', colorIds: [30], shapeIds: [PEAR], sizeIds: pearSizes },
    { id: 2, name: 'Ruby Corundum', slug: 'ruby', colorIds: [5, 6], shapeIds: [PEAR, OVAL], sizeIds: [...pearSizes, ...ovalSizes] },
    { id: 29, name: 'Rainbow Corundum', slug: 'rainbow', colorIds: [40], shapeIds: [PEAR], sizeIds: pearSizes },
  ],
  shapes: [
    { id: PEAR, name: 'Pear', refPhotoUrl: null }, { id: OVAL, name: 'Oval', refPhotoUrl: null },
    { id: OCTAGON, name: 'Octagon', refPhotoUrl: null }, { id: ROUND_CHECKER, name: 'Round Checker', refPhotoUrl: null },
    { id: ROUND, name: 'Round', refPhotoUrl: null },
  ],
  sizes,
  colors: [
    { id: 114, name: 'Blue Nano #114', hex: null, refPhotoUrl: null, familyId: 10 },
    { id: 20, name: 'Green Nano', hex: null, refPhotoUrl: null, familyId: 9 },
    { id: 30, name: 'Yellow', hex: null, refPhotoUrl: null, familyId: 7 },
    { id: 31, name: 'Pink', hex: null, refPhotoUrl: null, familyId: 5 },
    { id: 32, name: 'White', hex: null, refPhotoUrl: null, familyId: 1 },
    { id: 5, name: 'Ruby #5', hex: null, refPhotoUrl: null, familyId: 4 },
    { id: 6, name: 'Ruby Red', hex: null, refPhotoUrl: null, familyId: 4 },
    { id: 40, name: 'Default', hex: null, refPhotoUrl: null, familyId: null },
  ],
};
const ctx: ResolveContext = {
  qualities: (categoryId) => (categoryId === 2 ? ['5A', '7A'] : []),
  ownPage: (categoryId) => categoryId === 29,
};
const sizeOf = (id: number | null) => sizes.find((s) => s.id === id)?.sizeMm;
const read = (text: string, picks = {}) => {
  const { rows, ignored } = parsePastedList(text, map);
  return { rows, ignored, resolved: resolveAll(rows, picks, map, ctx) };
};

test('numbers are tidied the way buyers write them', () => {
  assert.equal(normalizeLine('4 X 6 - 1,000 pcs'), '4x6 - 1000pcs');
  assert.equal(normalizeLine('2.5 X 1.5 X 1.25 = 10,000'), '2.5x1.5x1.25 = 10000');
  assert.equal(normalizeLine('5 mm 2k'), '5mm 2000pcs');
  assert.equal(normalizeLine('8 x 10mm 1,00,000'), '8x10mm 100000');
});

test('a WhatsApp list: the heading line carries down, a new shape keeps the colour', () => {
  const { rows, resolved } = read('Blue Nano #114 Pear\n4 X 6 1000\n5x7 - 2,000 pcs\n\nOval\n4x6 1000\n10 x 14 250');
  assert.equal(rows.length, 4);
  assert.ok(resolved.every(isReady), JSON.stringify(resolved.map((r) => r.missing)));
  assert.deepEqual(resolved.map((r) => [r.categoryId, r.colorId, r.shapeId, sizeOf(r.sizeId), r.qty]), [
    [3, 114, PEAR, '4x6', 1000], [3, 114, PEAR, '5x7', 2000], [3, 114, OVAL, '4x6', 1000], [3, 114, OVAL, '10x14', 250],
  ]);
});

test("rows copied from the team's order sheet: columns, blank cells carried down, remarks kept", () => {
  const sheet = [
    'SR.NO\tORDER DATE\tNAME\tITEM\tSHAPE\tSIZE\tQUANTITY\tREMARK',
    '1\t\tDiscovery Jewels\tBlue Nano #114\tPear\t4 X 6 \t1000\t',
    '\t\t\t\t\t5 X 7 \t2000\t',
    '\t\t\t\t\t\t\t',
    '\t\t\tYellow CZ\tOval\t4 X 6\t600\t',
    '\t\t\t\tOcto\t5 X 7\t175\tRadiant-Cut Required',
    '\t\t\t\t\t6 X 8\t150\t',
    'RUBY#5\t3 X 4\t3000\tRuby#5\tPear\t5 X 7\t650\tFor Hand Setting',
  ].join('\n');
  const { rows, resolved, ignored } = read(sheet);
  assert.equal(rows.length, 6);
  assert.deepEqual(resolved.map((r) => [r.categoryId, r.colorId, r.shapeId, sizeOf(r.sizeId), r.qty]), [
    [3, 114, PEAR, '4x6', 1000], [3, 114, PEAR, '5x7', 2000],
    [12, 30, OVAL, '4x6', 600], [12, 30, OCTAGON, '5x7', 175], [12, 30, OCTAGON, '6x8', 150],
    [2, 5, PEAR, '5x7', 650],
  ]);
  // The customer's name in the NAME column is not a note; the remark is, for its block.
  assert.equal(rows[0].hints.note, '');
  assert.equal(rows[3].hints.note, 'Radiant-Cut Required');
  assert.equal(rows[4].hints.note, 'Radiant-Cut Required');
  assert.equal(rows[5].hints.note, 'For Hand Setting');
  // The block typed beside the table (no shape) is reported, not dropped.
  assert.equal(ignored.length, 1);
  assert.match(ignored[0], /3 X 4/);
  // Ruby needs a quality; nothing on the line says which.
  assert.deepEqual(resolved[5].missing, ['quality']);
  assert.deepEqual(resolved[5].gradeChoices, ['5A', '7A']);
});

test('"Yellow CZ" alone could be two stones: it asks, and a choice carries to the rows below', () => {
  const text = 'Yellow CZ Pear\n4x6 500\n5x7 500';
  const first = read(text);
  assert.deepEqual(first.resolved[0].missing, ['stone']);
  assert.deepEqual(first.resolved[0].categoryChoices.sort(), [12, 38]);
  const second = read(text, { [first.rows[0].key]: { categoryId: 12 } });
  assert.ok(second.resolved.every(isReady));
  assert.ok(second.resolved.every((r) => r.categoryId === 12));
});

test('a size the shape is not cut in says so, with the nearest sizes', () => {
  const { resolved } = read('Yellow Coloured CZ Octagon 9x11 100');
  assert.deepEqual(resolved[0].missing, ['size']);
  assert.match(resolved[0].problem || '', /No 9x11 mm — nearest/);
});

test('quality on the line, word order, shape spellings and 2k', () => {
  const { resolved } = read('Ruby #5 Pear 5A\n6x8 500\nWhite checker round 4mm 2k\npink cz octo 7 X 9 100');
  assert.deepEqual([resolved[0].grade, resolved[0].qty, sizeOf(resolved[0].sizeId)], ['5A', 500, '6x8']);
  assert.deepEqual([resolved[1].categoryId, resolved[1].shapeId, sizeOf(resolved[1].sizeId), resolved[1].qty], [12, ROUND_CHECKER, '4', 2000]);
  assert.deepEqual([resolved[2].colorId, resolved[2].shapeId, sizeOf(resolved[2].sizeId)], [31, OCTAGON, '7x9']);
  assert.ok(resolved.every(isReady));
});

test('a plain-words line under a block becomes its note; a missing quantity is asked for', () => {
  const { rows, resolved } = read('Pink CZ Octo\n5x7 175\n6x8 150\nfor hand setting\nWhite CZ Pear 4x6');
  assert.equal(rows[0].hints.note, 'for hand setting');
  assert.equal(rows[1].hints.note, 'for hand setting');
  assert.equal(rows[2].hints.note, '');
  assert.deepEqual(resolved[2].missing, ['quantity']);
});

test('melee sizes written as decimals; a stone ordered on its own page is flagged', () => {
  const { resolved } = read('green nano round 1.10 15000\n1.20mm 15000\nrainbow corundum pear 4x6 100');
  assert.deepEqual(resolved.slice(0, 2).map((r) => [sizeOf(r.sizeId), r.qty]), [['1.1', 15000], ['1.2', 15000]]);
  assert.equal(resolved[2].ownPage, true);
  assert.equal(isReady(resolved[2]), false);
});

test('size table: every size of the picked shapes, filled rows become lines', () => {
  const rows = [
    { id: 1, shape_id: 9, size_mm: '5x7' }, { id: 2, shape_id: 9, size_mm: '4x6' },
    { id: 3, shape_id: 8, size_mm: '3' }, { id: 4, shape_id: 9, size_mm: '10x14' },
  ];
  const groups = tableGroups([9, 8], rows, (s) => s.id !== 3);
  assert.deepEqual(groups.map((g) => [g.shapeId, g.sizes.map((s) => s.size_mm)]), [[9, ['4x6', '5x7', '10x14']]]);
  const lines = tableLines(groups, { 1: '2000', 2: '', 4: '0', 3: '50' });
  assert.deepEqual(lines.map((l) => [l.size.size_mm, l.qty]), [['5x7', 2000]]);
  assert.equal(tableHasError(groups, { 2: '1.5' }), true);
  assert.equal(tableHasError(groups, { 3: 'x' }), false); // a hidden size doesn't block
});

test('remarks become one message line each, naming the lines they belong to', () => {
  const base = { categoryId: 12, categoryName: 'Coloured CZ Stones', shapeId: 3, shapeName: 'Octagon', colorId: 30, colorName: 'Yellow', colorHex: null, colorRefPhotoUrl: null, qty: 1, grade: null };
  assert.deepEqual(noteLines([
    { ...base, sizeId: 1, sizeMm: '5x7', note: 'Radiant-Cut Required' },
    { ...base, sizeId: 2, sizeMm: '6x8', note: 'Radiant-Cut Required' },
    { ...base, sizeId: 3, sizeMm: '4x6', note: '' },
  ]), ['Yellow Octagon 5x7, 6x8 — Radiant-Cut Required']);
});
