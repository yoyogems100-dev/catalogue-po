import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPlace, placeSuggestions, SUGGESTED_PLACES, TIER_1_CITIES } from '../lib/customer-places';

test('any place can be saved, tidied to one spelling', () => {
  assert.equal(canonicalPlace('jodhpur'), 'Jodhpur');
  assert.equal(canonicalPlace('  AGRA '), 'Agra');
  assert.equal(canonicalPlace('bangalore'), 'Bengaluru', 'old names map to the current one');
  assert.equal(canonicalPlace('new   delhi'), 'Delhi');
  // Not in the list: kept, title-cased; short all-caps words stay as typed.
  assert.equal(canonicalPlace('sri ganganagar'), 'Sri Ganganagar');
  assert.equal(canonicalPlace('dubai UAE'), 'Dubai UAE');
  assert.equal(canonicalPlace(''), null);
  assert.equal(canonicalPlace('   '), null);
  assert.equal(canonicalPlace(undefined), null);
  assert.equal(canonicalPlace('x'.repeat(100))!.length, 60);
});

test('suggestions: tier 1 and 2 cities plus places already used, no duplicates', () => {
  for (const c of [...TIER_1_CITIES, 'Jaipur', 'Surat', 'Rajkot', 'Agra', 'Jodhpur']) assert.ok(SUGGESTED_PLACES.includes(c), c);
  assert.equal(new Set(SUGGESTED_PLACES).size, SUGGESTED_PLACES.length);
  const merged = placeSuggestions(['Sri Ganganagar', 'Jaipur']);
  assert.ok(merged.includes('Sri Ganganagar'));
  assert.equal(merged.filter((p) => p === 'Jaipur').length, 1);
  assert.deepEqual(merged, [...merged].sort((a, b) => a.localeCompare(b)));
});
