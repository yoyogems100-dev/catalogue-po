import test from 'node:test';
import assert from 'node:assert/strict';
import { splitHeadline } from '../lib/site/headline';

test('splitHeadline puts the last sentence in the accent part', () => {
  assert.deepEqual(splitHeadline('Every stone. One trusted source.'), ['Every stone.', 'One trusted source.']);
  assert.deepEqual(splitHeadline('Premium Synthetic Gemstones. Infinite Choices. One Trusted Name.'), ['Premium Synthetic Gemstones. Infinite Choices.', 'One Trusted Name.']);
  assert.deepEqual(splitHeadline('Brilliance, supplied!  Since day one'), ['Brilliance, supplied!', 'Since day one']);
});

test('splitHeadline leaves a single sentence whole', () => {
  assert.deepEqual(splitHeadline('Gemstones without limits.'), ['Gemstones without limits.', '']);
  assert.deepEqual(splitHeadline('  '), ['', '']);
});
