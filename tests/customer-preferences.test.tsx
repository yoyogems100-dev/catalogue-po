import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePreferences, preferenceForFamily } from '../lib/customer-preferences';
import { specText, specKey, categoryGrades } from '../lib/order-specs';

test('usual picks: one per colour, real categories only, grade only where the stone has grades', () => {
  const cleaned = sanitizePreferences([
    { familyId: 4, categoryId: 2, grade: '5A' }, // Red -> Ruby Corundum 5A
    { familyId: 4, categoryId: 12 }, // second Red: dropped
    { familyId: 1, categoryId: 37, grade: '5A' }, // White -> 5A CZ: CZ has no in-category grade
    { familyId: 10, categoryId: 999 }, // unknown category
    { familyId: 99, categoryId: 2 }, // unknown colour family
    { familyId: 5, categoryId: 2, grade: '9A' }, // grade Ruby doesn't offer
    'junk'
  ], new Set([2, 12, 37]));
  assert.deepEqual(cleaned, [
    { familyId: 4, categoryId: 2, grade: '5A' },
    { familyId: 1, categoryId: 37 },
    { familyId: 5, categoryId: 2 }
  ]);
  assert.deepEqual(sanitizePreferences('nope'), []);
  assert.equal(preferenceForFamily(cleaned, 4)?.categoryId, 2);
  assert.equal(preferenceForFamily(cleaned, 10), null);
});

test('Ruby quality grade: labelled on the line and kept as separate lines', () => {
  assert.deepEqual(categoryGrades(2), ['5A', '7A']);
  assert.deepEqual(categoryGrades(1), []);
  assert.equal(specText({ kind: 'grade', grade: '7A' }), 'Quality 7A');
  assert.notEqual(specKey({ kind: 'grade', grade: '5A' }), specKey({ kind: 'grade', grade: '7A' }));
});

test('server accepts a grade only on a category that offers it', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'synthetic-test-key';
  const { validateOrderSpecs } = await import('../lib/validate-order-specs');
  const rows: any = {
    shape_sizes: [{ id: 10, shape_id: 2 }],
    category_shape_sizes: [{ category_id: 2, shape_size_id: 10 }, { category_id: 1, shape_size_id: 10 }],
    category_shapes: [{ category_id: 2, shape_id: 2 }, { category_id: 1, shape_id: 2 }],
    category_colors: [{ category_id: 2, color_id: 4 }, { category_id: 1, color_id: 4 }]
  };
  const database = { from(name: string) { let data = rows[name] || []; const q: any = { select() { return q; }, eq(k: string, v: any) { data = data.filter((r: any) => r[k] === v); return q; }, maybeSingle() { return Promise.resolve({ data: data[0] || null, error: null }); } }; return q; } };
  const ruby: any = { categoryId: 2, shapeId: 2, sizeId: 10, colorId: 4, qty: 100, orderSpecs: { kind: 'grade', grade: '7A', extra: 'dropped' } };
  assert.deepEqual((await validateOrderSpecs([ruby], database))[0].orderSpecs, { kind: 'grade', grade: '7A' });
  // Still optional, so screens that don't ask for it keep working.
  assert.equal((await validateOrderSpecs([{ ...ruby, orderSpecs: undefined }], database))[0].orderSpecs, undefined);
  await assert.rejects(validateOrderSpecs([{ ...ruby, orderSpecs: { kind: 'grade', grade: '9A' } }], database));
  await assert.rejects(validateOrderSpecs([{ ...ruby, categoryId: 1 }], database));
});

test('shop defaults: Red = Ruby 5A and White = 5A CZ until the owner edits them; a buyer overrides per colour', async () => {
  const { parseDefaultPreferences, mergePreferences, DEFAULT_COLOR_PREFERENCES } = await import('../lib/customer-preferences');
  assert.deepEqual(parseDefaultPreferences(undefined), [{ familyId: 4, categoryId: 2, grade: '5A' }, { familyId: 1, categoryId: 37 }]);
  assert.deepEqual(parseDefaultPreferences('not json'), DEFAULT_COLOR_PREFERENCES);
  assert.deepEqual(parseDefaultPreferences('[]'), []); // owner cleared them on purpose
  const merged = mergePreferences([{ familyId: 4, categoryId: 2, grade: '7A' }], DEFAULT_COLOR_PREFERENCES);
  assert.deepEqual(merged, [{ familyId: 4, categoryId: 2, grade: '7A' }, { familyId: 1, categoryId: 37 }]);
});

test('colour buttons: all twelve in the default order until the owner saves; then only the chosen ones, in their order', async () => {
  const { parseColorButtons, colorButtonFamilies, COLOR_FAMILIES } = await import('../lib/color-family');
  assert.deepEqual(parseColorButtons(undefined), COLOR_FAMILIES.map((f) => f.id));
  assert.deepEqual(parseColorButtons('4, 1, 4, 99, x, 10'), [4, 1, 10]);
  assert.deepEqual(parseColorButtons(''), []); // owner hid every button
  assert.deepEqual(colorButtonFamilies([4, 1]).map((f) => f.name), ['Red', 'White']);
});
