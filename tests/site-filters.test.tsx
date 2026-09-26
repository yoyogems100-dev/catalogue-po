import test from 'node:test';
import assert from 'node:assert/strict';
import { fillTemplate, filterHref, isIndexable, matches, parseSelection, selectionWords, sizeBucketOf, type OptionsByDim } from '../lib/site/filters';

const options: OptionsByDim = {
  shape: [{ slug: 'round', name: 'Round' }, { slug: 'oval', name: 'Oval' }],
  size: [{ slug: 'under-2mm', name: 'Under 2mm' }, { slug: '2-4mm', name: '2–4mm' }],
  colour: [{ slug: 'emerald-green', name: 'Emerald Green' }, { slug: 'apple-green', name: 'Apple Green' }, { slug: 'royal-blue', name: 'Royal Blue' }],
  grade: [{ slug: '5a', name: '5A' }, { slug: '7a', name: '7A' }]
};

test('filters read from the URL keep only real values, in option order', () => {
  const sel = parseSelection({ shape: 'oval,round,triangle', colour: 'Royal Blue', grade: ['7a', '5a'] }, options);
  assert.deepEqual(sel, { shape: ['round', 'oval'], size: [], colour: ['royal-blue'], grade: ['5a', '7a'] });
  assert.deepEqual(parseSelection({}, options), { shape: [], size: [], colour: [], grade: [] });
});

test('a plain colour word stands for every shade in that family', () => {
  const sel = parseSelection({ colour: 'green' }, options);
  assert.deepEqual(sel.colour, ['green']);
  assert.equal(selectionWords(sel, options), 'Green');
  const base = { shapes: [], sizes: [], grade: null };
  assert.ok(matches({ ...base, colours: ['apple-green'] }, sel));
  assert.ok(!matches({ ...base, colours: ['royal-blue'] }, sel));
  // Unknown words and families with no member on the page are dropped.
  assert.deepEqual(parseSelection({ colour: 'orange,sparkly' }, options).colour, []);
});

test('filtered photos: OR within a filter, AND across filters', () => {
  const photo = { shapes: ['oval'], colours: ['royal-blue'], sizes: ['2-4mm'], grade: '5a' };
  const none = { shape: [], size: [], colour: [], grade: [] };
  assert.ok(matches(photo, none));
  assert.ok(matches(photo, { ...none, shape: ['round', 'oval'] }));
  assert.ok(matches(photo, { ...none, shape: ['oval'], grade: ['5a'] }));
  assert.ok(!matches(photo, { ...none, shape: ['oval'], grade: ['7a'] }));
  assert.ok(!matches({ ...photo, grade: null }, { ...none, grade: ['5a'] }));
});

test('filter links toggle one value and keep the rest', () => {
  const sel = { shape: ['oval'], size: [], colour: [], grade: ['5a'] };
  assert.equal(filterHref('/products/cz/white-cz', sel, 'colour', 'royal-blue'), '/products/cz/white-cz?shape=oval&colour=royal-blue&grade=5a');
  assert.equal(filterHref('/products/cz/white-cz', sel, 'shape', 'oval'), '/products/cz/white-cz?grade=5a');
  assert.equal(filterHref('/p', sel, 'grade', undefined, true), '/p?shape=oval');
});

test('filtered pages get a heading from the template, and only simple ones are indexed', () => {
  const sel = { shape: ['oval'], size: [], colour: ['royal-blue'], grade: ['5a'] };
  assert.equal(fillTemplate('{filters} {category}', { filters: selectionWords(sel, options), category: 'Nano' }), '5A Royal Blue Oval Nano');
  assert.equal(fillTemplate('{category} in {filters}.', { filters: '', category: 'Nano' }), 'Nano in.');
  assert.ok(isIndexable({ shape: ['oval'], size: [], colour: [], grade: [] }));
  assert.ok(isIndexable({ shape: ['oval'], size: [], colour: ['green'], grade: [] }));
  assert.ok(!isIndexable(sel));
  assert.ok(!isIndexable({ shape: ['oval', 'round'], size: [], colour: [], grade: [] }));
});

test('sizes fall into mm ranges by their largest dimension', () => {
  assert.equal(sizeBucketOf('1.5'), 'under-2mm');
  assert.equal(sizeBucketOf('3x5'), '4-6mm');
  assert.equal(sizeBucketOf('4X6 mm'), '6-10mm');
  assert.equal(sizeBucketOf('12'), '10mm-plus');
  assert.equal(sizeBucketOf('custom'), null);
});
