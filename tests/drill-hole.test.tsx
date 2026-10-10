import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { cleanHoles, drilledCutout, inLightBox } from '../lib/drill-hole';

test('1 to 3 holes, as fractions of the photo, sized within limits', () => {
  assert.deepEqual(cleanHoles([{ x: 0.5, y: 0.123456, r: 0.06 }]), [{ x: 0.5, y: 0.1235, r: 0.06 }]);
  assert.equal(cleanHoles([]), null);
  assert.equal(cleanHoles(Array.from({ length: 4 }, () => ({ x: 0.5, y: 0.5, r: 0.05 }))), null);
  assert.equal(cleanHoles([{ x: 1.2, y: 0.5, r: 0.06 }]), null);
  assert.equal(cleanHoles([{ x: 0.5, y: 0.5, r: 0.5 }]), null);
  assert.equal(cleanHoles([{ x: 0.5, y: 0.5 }]), null);
  assert.equal(cleanHoles('nope'), null);
});

// A pale square "stone" in the middle of a transparent photo.
async function stone() {
  const svg = '<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="100" y="100" width="200" height="200" fill="#e8e8ea"/></svg>';
  return sharp(Buffer.from(svg)).png().toBuffer();
}
async function pixel(img: Buffer, x: number, y: number) {
  const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [...data.subarray(i, i + 4)];
}

test('a drilled hole is a dark spot on the stone, and the background stays clear', async () => {
  const out = await drilledCutout(await stone(), [{ x: 0.5, y: 0.35, r: 0.05 }]);
  const [r, g, b, a] = await pixel(out, 200, 140);
  assert.ok(r < 60 && g < 60 && b < 60 && a > 240, `hole core should be dark, got ${[r, g, b, a]}`);
  assert.equal((await pixel(out, 20, 20))[3], 0, 'outside the stone stays transparent');
  assert.ok((await pixel(out, 200, 260))[0] > 200, 'the rest of the stone is untouched');
});

test('a hole off the stone draws nothing outside it', async () => {
  const out = await drilledCutout(await stone(), [{ x: 0.1, y: 0.1, r: 0.05 }]);
  assert.equal((await pixel(out, 40, 40))[3], 0);
});

test('the light box is black velvet or white', async () => {
  const cut = await drilledCutout(await stone(), [{ x: 0.5, y: 0.35, r: 0.05 }]);
  const black = await pixel(await inLightBox(cut, 'black'), 30, 30);
  const white = await pixel(await inLightBox(cut, 'white'), 30, 30);
  assert.ok(black[0] < 60, `velvet corner should be dark, got ${black}`);
  assert.ok(white[0] > 180, `white corner should be light, got ${white}`);
});
