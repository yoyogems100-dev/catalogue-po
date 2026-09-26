import test from 'node:test';
import assert from 'node:assert/strict';
import { canOptimize, optimized, responsive, thumb } from '../lib/site/optimize';

test('reference and catalogue pictures go through the optimiser at a real size', () => {
  assert.equal(optimized('/moissanite-shapes/round.png', 60), '/_next/image?url=%2Fmoissanite-shapes%2Fround.png&w=64&q=75');
  assert.deepEqual(thumb('/reference/colors/white.webp', 56), {
    src: '/_next/image?url=%2Freference%2Fcolors%2Fwhite.webp&w=64&q=75',
    srcSet: '/_next/image?url=%2Freference%2Fcolors%2Fwhite.webp&w=64&q=75 1x, /_next/image?url=%2Freference%2Fcolors%2Fwhite.webp&w=128&q=75 2x'
  });
  const r = responsive('https://kqjdtjygrvpwcnexqtbz.supabase.co/storage/v1/object/public/photos/34/a.jpg');
  assert.ok(r.src.startsWith('/_next/image?url=https%3A%2F%2Fkqjdtjygrvpwcnexqtbz.supabase.co'));
  assert.equal(r.srcSet!.split(', ').length, 5);
});

test('SVGs, already-sized and unknown hosts are left alone', () => {
  for (const src of ['/icon.svg', '/api/site/og', '/_next/static/x.png', 'https://evil.test/x.jpg', '//cdn.test/x.png', '']) assert.equal(canOptimize(src), false, src);
  assert.deepEqual(thumb('https://evil.test/x.jpg', 64), { src: 'https://evil.test/x.jpg' });
});
