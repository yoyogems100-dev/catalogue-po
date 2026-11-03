import test from 'node:test';
import assert from 'node:assert/strict';
import { optionSearchScore, searchOptions } from '../lib/option-search';

const coin = [
  { name: 'Blue', hex: '#1F3F9A' },
  { name: 'Red', hex: '#B0201A' },
  { name: 'Green', hex: '#1E8A3A' },
  { name: 'Black', hex: '#111111' },
  { name: 'Monalisa Pink', hex: '#E9BFD3' },
  { name: 'Monalisa Mint', hex: '#9FD6BC' }
];
const names = (q: string) => searchOptions(coin, q, true).map((o) => o.name);

test('colour search: shorthand, run-together and typos find the colour meant', () => {
  assert.deepEqual(names('M pINk'), ['Monalisa Pink']);
  assert.deepEqual(names('mpink'), ['Monalisa Pink']);
  assert.deepEqual(names('mp'), ['Monalisa Pink']);
  assert.deepEqual(names('monalsa mint'), ['Monalisa Mint']);
  assert.deepEqual(names('pnik'), ['Monalisa Pink']);
  assert.deepEqual(names('blk'), ['Black']);
  assert.deepEqual(names('m pnk'), ['Monalisa Pink']);
  assert.deepEqual(names('mona'), ['Monalisa Pink', 'Monalisa Mint']);
  assert.deepEqual(names('pink colour'), ['Monalisa Pink']);
});

test('colour search: a colour word finds the same family, after direct matches', () => {
  assert.deepEqual(names('rose'), ['Monalisa Pink']);
  assert.deepEqual(names('green'), ['Green', 'Monalisa Mint']);
  assert.deepEqual(names('emerald'), ['Green', 'Monalisa Mint']);
  assert.deepEqual(names('bl'), ['Blue', 'Black']);
  assert.deepEqual(names('purple'), []);
});

test('shape search stays literal-first and has no colour families', () => {
  assert.equal(optionSearchScore('rose', 'Monalisa Pink'), 0);
  assert.equal(optionSearchScore('oval', 'Oval'), 4);
  assert.equal(optionSearchScore('em cut', 'Emerald Cut'), 3);
  assert.equal(optionSearchScore('4*6', 'Oval 4x6'), 4);
  assert.equal(optionSearchScore('c rose', 'Creamrose Light 618'), 2);
  assert.equal(optionSearchScore('', 'Anything'), 1);
});
