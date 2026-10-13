import test from 'node:test';
import assert from 'node:assert/strict';
import { colorButtonFamilies, colorSearchText, namedFamilies, parseColorNames, sanitizeColorNames } from '../lib/color-family';
import { sanitizePreferences } from '../lib/customer-preferences';

test('colour button names: only known colours with a real new name are kept', () => {
  assert.deepEqual(sanitizeColorNames({ 7: '  Yellow ', 10: 'Blue', 99: 'Nope', 4: '', 9: 42 }), { 7: 'Yellow' });
  assert.equal(sanitizeColorNames({ 1: 'x'.repeat(50) })[1].length, 30);
  assert.deepEqual(parseColorNames('not json'), {});
  assert.deepEqual(parseColorNames(null), {});
  assert.deepEqual(parseColorNames('{"7":"Yellow"}'), { 7: 'Yellow' });
});

test('renamed buttons show the new name everywhere, and still find their colours', () => {
  const names = { 7: 'Yellow' };
  assert.equal(namedFamilies(names).find((f) => f.id === 7)?.name, 'Yellow');
  assert.equal(namedFamilies().find((f) => f.id === 7)?.name, 'Yellow & Gold');
  assert.deepEqual(colorButtonFamilies([7, 1], names).map((f) => f.name), ['Yellow', 'White']);
  assert.match(colorSearchText('Canary', null, names), /yellow & gold yellow canary/);
});

test('a colour button can open on one shade of its stone', () => {
  assert.deepEqual(sanitizePreferences([{ familyId: 10, categoryId: 3, colorId: 374 }, { familyId: 9, categoryId: 3, colorId: 'x' }]), [
    { familyId: 10, categoryId: 3, colorId: 374 },
    { familyId: 9, categoryId: 3 }
  ]);
});

test('qualities: set per category in admin; Ruby keeps 5A / 7A until saved', async () => {
  const { normalizeQualities, parseCategoryQualities, qualitiesFor, knownQualities } = await import('../lib/qualities');
  const { categoryGrades } = await import('../lib/order-specs');
  assert.deepEqual(qualitiesFor(parseCategoryQualities(null), 2), ['5A', '7A']);
  const saved = parseCategoryQualities(JSON.stringify({ 3: ['4A', ' 5A ', '5a', '7A'], 2: [], 9: 'junk' }));
  assert.deepEqual(saved[3], ['4A', '5A', '7A']);
  assert.deepEqual(categoryGrades(2, saved), []); // emptied in admin: no Quality field
  assert.deepEqual(categoryGrades(3, saved), ['4A', '5A', '7A']);
  assert.equal(normalizeQualities(['x'.repeat(20)]), undefined);
  assert.equal(normalizeQualities('5A'), undefined);
  assert.ok(knownQualities({ 5: ['Super AAA'] }).includes('Super AAA'));
});
