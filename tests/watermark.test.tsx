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

test('the watermark is spread evenly over the whole photo, faint on light and dark backgrounds', async () => {
  for (const [w, h] of [[1200, 1200], [1600, 900], [700, 1000]]) {
    for (const bg of ['#ffffff', '#101010']) {
      const out = await (await withWatermark(await plain(w, h, bg))).png().toBuffer();
      const meta = await sharp(out).metadata();
      assert.equal(meta.width, w); assert.equal(meta.height, h);
      // Every quarter of the photo, the centre included, carries the mark...
      const quarters = [[0, 0], [w / 2, 0], [0, h / 2], [w / 2, h / 2], [w / 4, h / 4]];
      for (const [left, top] of quarters) {
        const q = await region(out, Math.round(left), Math.round(top), Math.round(w / 2), Math.round(h / 2));
        // ...and only faintly: a light grey edge on white, a soft white on dark.
        if (bg === '#ffffff') assert.ok(q.every(([min]) => min < 250 && min > 215), `faint mark on white at ${left},${top}`);
        else assert.ok(q.every(([, max]) => max > 40 && max < 95), `faint mark on dark at ${left},${top}`);
      }
    }
  }
});

test('a watermarked photo can be resized afterwards without losing the mark', async () => {
  const out = await (await withWatermark(await plain(1600, 1600, '#ffffff'))).resize(400).png().toBuffer();
  const centre = await region(out, 100, 100, 200, 200);
  assert.ok(centre.some(([min]) => min < 252));
});

test('a photo too small for lettering is left as it is', async () => {
  const out = await (await withWatermark(await plain(120, 120, '#ffffff'))).png().toBuffer();
  for (const [min] of await region(out, 0, 0, 120, 120)) assert.equal(min, 255);
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
