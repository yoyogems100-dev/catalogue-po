import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { withWatermark } from '../lib/watermark-render';
import { isWatermarked } from '../lib/photo-files';
import { photoUrl } from '../lib/photos';

async function plain(width: number, height: number, background: string) {
  return sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
}
async function region(image: Buffer, left: number, top: number, width: number, height: number) {
  // Materialised first: stats() straight after extract() measures the whole image.
  const cut = await sharp(image).extract({ left, top, width, height }).png().toBuffer();
  const { channels } = await sharp(cut).stats();
  return channels.slice(0, 3).map((c) => [c.min, c.max]);
}

test('the watermark marks the bottom-right corner and leaves the stone in the middle untouched', async () => {
  for (const [w, h] of [[1200, 1200], [1600, 900], [700, 1000]]) {
    for (const bg of ['#ffffff', '#101010']) {
      const out = await (await withWatermark(await plain(w, h, bg))).png().toBuffer();
      const meta = await sharp(out).metadata();
      assert.equal(meta.width, w); assert.equal(meta.height, h);
      // Centre half of the photo: still exactly the original colour.
      const centre = await region(out, Math.round(w / 4), Math.round(h / 4), Math.round(w / 2), Math.round(h / 2));
      const v = bg === '#ffffff' ? 255 : 16;
      for (const [min, max] of centre) { assert.equal(min, v); assert.equal(max, v); }
      // Bottom-right corner: something was drawn, and it contrasts with the backdrop.
      const corner = await region(out, Math.round(w * 0.7), Math.round(h * 0.88), Math.round(w * 0.28), Math.round(h * 0.1));
      if (bg === '#ffffff') assert.ok(corner.some(([min]) => min < 180), 'visible on white');
      else assert.ok(corner.some(([, max]) => max > 150), 'visible on dark');
    }
  }
});

test('a watermarked photo can be resized afterwards without losing the mark', async () => {
  const out = await (await withWatermark(await plain(1600, 1600, '#ffffff'))).resize(400).png().toBuffer();
  const corner = await region(out, 280, 360, 110, 35);
  assert.ok(corner.some(([min]) => min < 200));
});

test('only photos whose shown files are watermarked copies count as done', () => {
  assert.equal(isWatermarked({ id: 1, category_id: 1, storage_path: '1/a.jpg', drive_id: null }), false);
  assert.equal(isWatermarked({ id: 1, category_id: 1, storage_path: '1/wm-x.webp', original_path: '1/a.jpg', drive_id: null }), true);
  assert.equal(isWatermarked({ id: 2, category_id: 1, storage_path: null, drive_id: 'abc' }), false);
  assert.equal(isWatermarked({ id: 2, category_id: 1, storage_path: '1/wm-y.webp', drive_id: 'abc' }), true);
});

test('a Drive photo shows its watermarked copy, never the Drive file, once it has one', () => {
  const url = photoUrl({ storage_path: '1/wm-y.webp', drive_id: 'abc' });
  assert.ok(url?.endsWith('/photos/1/wm-y.webp'));
});
