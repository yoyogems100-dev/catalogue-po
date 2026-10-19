import test from 'node:test';
import assert from 'node:assert/strict';
import type { CatalogueMap } from '../lib/catalogue-map';
import { bestAlternative, missingParts, nearestSizes, normalize, parseOrderText, refitLine, resolveLine } from '../lib/voice-order';

// A small slice of the real catalogue: Crushed Ice Cut sells Cushion only
// from 3x3, Nano carries coded colours, Moissanite has one colour.
const map: CatalogueMap = {
  materials: [],
  categories: [
    { id: 1, name: 'Crushed Ice Cut', slug: 'crushed-ice-cut', colorIds: [40, 66, 2], shapeIds: [6, 1, 4, 66], sizeIds: [603, 604, 605, 103, 401, 661] },
    { id: 3, name: 'Nano', slug: 'nano', colorIds: [113, 114, 9], shapeIds: [1, 66], sizeIds: [102, 103, 662] },
    { id: 34, name: 'Moissanite', slug: 'moissanite', colorIds: [500], shapeIds: [1], sizeIds: [115, 102] },
    { id: 37, name: '5A Quality CZ', slug: '5a-quality-cz', colorIds: [40], shapeIds: [1], sizeIds: [102] },
    { id: 20, name: 'Hole Punched Stones', slug: 'hole-punched-stones', colorIds: [40], shapeIds: [1], sizeIds: [103] }
  ],
  shapes: [
    { id: 6, name: 'Cushion', refPhotoUrl: null }, { id: 1, name: 'Round', refPhotoUrl: null },
    { id: 4, name: 'Marquise', refPhotoUrl: null }, { id: 66, name: 'Oval', refPhotoUrl: null }
  ],
  sizes: [
    { id: 603, shapeId: 6, sizeMm: '3x3' }, { id: 604, shapeId: 6, sizeMm: '4x4' }, { id: 605, shapeId: 6, sizeMm: '5x5' },
    { id: 102, shapeId: 1, sizeMm: '2.0' }, { id: 103, shapeId: 1, sizeMm: '3.0' }, { id: 115, shapeId: 1, sizeMm: '1.5' },
    { id: 401, shapeId: 4, sizeMm: '4x8' }, { id: 661, shapeId: 66, sizeMm: '6x8' }, { id: 662, shapeId: 66, sizeMm: '6x8' }
  ],
  colors: [
    { id: 40, name: 'G-40 White D', hex: null, refPhotoUrl: null, familyId: 1 },
    { id: 66, name: 'G-66 White G', hex: null, refPhotoUrl: null, familyId: 1 },
    { id: 2, name: 'G-02 China Red', hex: null, refPhotoUrl: null, familyId: 4 },
    { id: 113, name: 'Blue Nano #113', hex: null, refPhotoUrl: null, familyId: 10 },
    { id: 114, name: 'Blue Nano #114', hex: null, refPhotoUrl: null, familyId: 10 },
    { id: 9, name: 'Green Nano', hex: null, refPhotoUrl: null, familyId: 9 },
    { id: 500, name: 'White (DEF)', hex: null, refPhotoUrl: null, familyId: 1 }
  ]
};

const lines = (text: string) => parseOrderText(text, map).lines.map((l) => resolveLine(map, l));
const brief = (text: string) => lines(text).map((l) => [l.categoryId, l.shapeId, l.sizeId, l.colorId, l.qty]);

test('the owner example: sizes before a quantity share it; unknown sizes stay empty with what was heard', () => {
  const out = lines('ice crush k cushion shape ka 4 mmm 1000 qty 5mm 500 qty 2mm 3mm 1mm ka 600 piece');
  assert.deepEqual(out.map((l) => [l.categoryId, l.shapeId, l.sizeId, l.qty]), [
    [1, 6, 604, 1000], [1, 6, 605, 500], [1, 6, null, 600], [1, 6, 603, 600], [1, 6, null, 600]
  ]);
  assert.equal(out[2].heard.size, '2 mm');
  assert.deepEqual(missingParts(map, out[2]), ['size', 'colour']);
  assert.deepEqual(nearestSizes(map, map.categories[0], 6, '2 mm', 1), ['3x3']);
});

test('number words in English and Hindi, sizes said as "6 by 8", "1k"', () => {
  assert.deepEqual(normalize('dhai hazaar'), ['2500']);
  assert.deepEqual(normalize('do hazaar paanch sau'), ['2500']);
  assert.deepEqual(normalize('two thousand five hundred'), ['2500']);
  assert.deepEqual(normalize('saade teen mm'), ['3.5', 'mm']);
  assert.deepEqual(normalize('1,00,000 pcs'), ['100000', 'pcs']);
  assert.deepEqual(normalize('6 by 8'), ['6x8']);
  assert.deepEqual(normalize('2k'), ['2000']);
  assert.deepEqual(normalize('point 8 mm'), ['0.8', 'mm']);
  assert.deepEqual(normalize('2 point 5 mm'), ['2.5', 'mm']);
  assert.deepEqual(brief('crushed ice oval 6 by 8 do hazaar piece'), [[1, 66, 661, null, 2000]]);
});

test('Hindi script and near spellings: कुशन, markis, kushan', () => {
  assert.deepEqual(brief('कुशन शेप आइस क्रश 4 एमएम 1000 पीस'), [[1, 6, 604, null, 1000]]);
  assert.deepEqual(brief('ice crush markis 4x8 500 kushan 5mm 300'), [[1, 4, 401, null, 500], [1, 6, 605, null, 300]]);
});

test('colours: coded names, one-colour stones, ambiguous families stay empty', () => {
  // "blue nano 113" is a colour, and only Nano carries it.
  const nano = lines('blue nano 113 round 3mm 500')[0];
  assert.deepEqual([nano.categoryId, nano.colorId, nano.guessed.category], [3, 113, true]);
  assert.deepEqual(brief('moissanite round 1.5 mm 200 pieces aur 2 mm 300'), [[34, 1, 115, 500, 200], [34, 1, 102, 500, 300]]);
  const white = lines('ice crush round 3mm white 100')[0];
  assert.equal(white.colorId, null); // G-40 or G-66: the buyer chooses
  assert.equal(white.heard.colorFamily, 1);
  assert.equal(lines('ice crush round 3mm laal 100')[0].colorId, 2); // the stone's only red
  assert.equal(lines('ice crush round 3 mm g 66 100')[0].colorId, 66);
});

test('order of speech: quantity first, stone named last, shape changes mid-way', () => {
  assert.deepEqual(brief('qty 1000 round 3mm nano'), [[3, 1, 103, null, 1000]]);
  assert.deepEqual(brief('4 mm 1000, 5 mm 500 cushion ice crush ka'), [[1, 6, 604, null, 1000], [1, 6, 605, null, 500]]);
  assert.deepEqual(brief('nano mein 3 mm round 100 piece, 6 x 8 oval 200'), [[3, 1, 103, null, 100], [3, 66, 662, null, 200]]);
  assert.deepEqual(brief('ice crush round 2 3 mm 500 each'), [[1, 1, null, null, 500], [1, 1, 103, null, 500]]);
});

test('the next sentence carries on from the last one', () => {
  const first = parseOrderText('ice crush cushion 4mm 1000', map);
  const second = parseOrderText('5mm 500', map, first.context);
  assert.deepEqual(second.lines.map((l) => resolveLine(map, l)).map((l) => [l.categoryId, l.shapeId, l.sizeId, l.qty]), [[1, 6, 605, 500]]);
});

test('a colour said after a quantity stays with that stone', () => {
  assert.deepEqual(brief('nano round 3mm 500 pcs green, moissanite round 2 mm 10 pcs'), [[3, 1, 103, 9, 500], [34, 1, 102, 500, 10]]);
});

test('"5A" alone is the 5A Quality CZ stone', () => {
  assert.deepEqual(brief('5a round 2mm 1000'), [[37, 1, 102, 40, 1000]]);
});

test('choosing the stone in the grid re-matches what was heard', () => {
  const [line] = lines('cushion 4mm 1000');
  assert.equal(line.categoryId, 1); // only Crushed Ice Cut has cushion 4x4
  const unknown = lines('round 3mm 500')[0];
  assert.deepEqual([unknown.categoryId, unknown.sizeId], [null, null]);
  const picked = refitLine(map, { ...unknown, categoryId: 3 });
  assert.deepEqual([picked.shapeId, picked.sizeId], [1, 103]);
});

test('of the recogniser\'s guesses, the one naming catalogue words wins', () => {
  assert.equal(bestAlternative(['eyes crash cousin 4 him him', 'ice crush cushion 4 mm 1000'], map, {}), 'ice crush cushion 4 mm 1000');
});

test('colour codes said without their zero, "octo" heard as "auto", "3 3" as 3x3', () => {
  const codes: CatalogueMap = {
    materials: [],
    categories: [{ id: 1, name: 'Crushed Ice Cut', slug: 'crushed-ice-cut', colorIds: [5, 40], shapeIds: [63, 1], sizeIds: [834, 857, 101, 133] }],
    shapes: [{ id: 63, name: 'Octagon', refPhotoUrl: null }, { id: 1, name: 'Round', refPhotoUrl: null }],
    sizes: [{ id: 834, shapeId: 63, sizeMm: '3x4' }, { id: 857, shapeId: 63, sizeMm: '4x6' }, { id: 101, shapeId: 1, sizeMm: '3.3' }, { id: 133, shapeId: 1, sizeMm: '3' }],
    colors: [{ id: 5, name: 'G-05 Morganite Orange', hex: null, refPhotoUrl: null, familyId: 6 }, { id: 40, name: 'G-40 White D', hex: null, refPhotoUrl: null, familyId: 1 }]
  };
  const one = (text: string) => resolveLine(codes, parseOrderText(text, codes).lines[0]);
  const heard = one('G5 auto 3 3');
  assert.deepEqual([heard.categoryId, heard.shapeId, heard.colorId, heard.sizeId], [1, 63, 5, null]);
  assert.equal(heard.heard.size, '3x3 mm'); // not sold -- the buyer is shown the nearest
  assert.deepEqual(nearestSizes(codes, codes.categories[0], 63, heard.heard.size!), ['3x4', '4x6']);
  assert.deepEqual(nearestSizes(codes, codes.categories[0], 63, '33', 1), ['3x4']);
  const said = one('G5 OCTO SHAPE 46 200 pieces');
  assert.deepEqual([said.shapeId, said.sizeId, said.colorId, said.qty], [63, 857, 5, 200]);
  assert.equal(one('g 05 octagon 3x4 500').colorId, 5);
  assert.equal(one('round 33 100').sizeId, 101); // a round "33" is 3.3 mm
});
