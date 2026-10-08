import test from 'node:test';
import assert from 'node:assert/strict';
import { holePhotos, photoForHoles, readDrill } from '../lib/drill-data';
import { drilledHoles, specText } from '../lib/order-specs';

test('a save from before hole counts is read as the photo for its number of holes', () => {
  const old = { base: '/b.png', holes: [{ x: 0.5, y: 0.2, r: 0.05 }], backdrop: 'black', photoId: 7 };
  assert.deepEqual(readDrill(old, '/one.webp'), { base: '/b.png', variants: { 1: { holes: old.holes, backdrop: 'black', photoId: 7, url: '/one.webp' } } });
  assert.deepEqual(holePhotos(old, '/one.webp'), { 1: '/one.webp' });
});

test('each hole count keeps its own photo', () => {
  const drill = { base: '/b.png', variants: { 1: { holes: [], backdrop: 'white', photoId: 1, url: '/1.webp' }, 3: { holes: [], backdrop: 'black', photoId: 3, url: '/3.webp' } } };
  assert.deepEqual(holePhotos(drill), { 1: '/1.webp', 3: '/3.webp' });
  assert.equal(readDrill(null), null);
});

test('the shape shows the photo for the holes chosen, else its usual photo', () => {
  const shape = { refPhotoUrl: '/usual.webp', holePhotos: { 1: '/1.webp', 2: '/2.webp' } };
  assert.equal(photoForHoles(shape, 2), '/2.webp');
  assert.equal(photoForHoles(shape, 3), '/usual.webp');
  assert.equal(photoForHoles(shape, null), '/usual.webp');
  assert.equal(photoForHoles(undefined, 1), null);
});

test('a Hole Punched line reads as its number of holes; older lines keep half/full', () => {
  assert.equal(specText({ kind: 'drilled', holes: 1 }), '1 hole');
  assert.equal(specText({ kind: 'drilled', holes: 3 }), '3 holes');
  assert.equal(specText({ kind: 'drilled', drill: 'full' }), 'Full drill');
  assert.equal(drilledHoles({ kind: 'drilled', holes: 2 }), 2);
  assert.equal(drilledHoles({ kind: 'drilled', drill: 'half' }), null);
});
