import test from 'node:test';
import assert from 'node:assert/strict';
import { nameMatchScore } from '../lib/name-match';

const NAMES = ['Crushed Ice Cut', 'Rainbow Corundum', 'Moissanite', 'Coloured CZ Stones', 'Ruby Synthetic', 'Nano', 'Lab Grown Stones',
  'Hole Punched Stones', 'Glass Pearls', 'YOTCF', 'Star Light', 'Synthetic Opals', 'MOP Mother of Pearl', 'Natural Emeralds', 'Ceramic', 'Ruby Opaque (Chatam)'];
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const find = (q: string) => NAMES
  .map((n, i) => ({ n, i, s: nameMatchScore(words(q), words(n)) }))
  .filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.n);

test('part of a name finds the stone', () => {
  assert.deepEqual(find('tcf'), ['YOTCF']);
  assert.deepEqual(find('yotcf'), ['YOTCF']);
  assert.ok(find('rundum').includes('Rainbow Corundum'));
});

test('a slip in spelling still finds it', () => {
  assert.equal(find('moisanite')[0], 'Moissanite');
  assert.equal(find('moissonite')[0], 'Moissanite');
  assert.equal(find('emrald')[0], 'Natural Emeralds');
  assert.equal(find('cristal ice')[0], undefined);
});

test('a word start still ranks first, and short words stay strict', () => {
  assert.equal(find('pearl')[0], 'Glass Pearls');
  assert.deepEqual(find('cz'), ['Coloured CZ Stones']);
  assert.ok(!find('ice').includes('Ceramic'));
  assert.deepEqual(find('no'), []);
  assert.deepEqual(find('opal'), ['Synthetic Opals']);
  assert.equal(find('moisan')[0], 'Moissanite');
});
