// Drilled-stone pictures for Hole Punched Stones: the shape's gemstone photo
// (a transparent cutout) with drill holes added where the admin placed them.
// A real hole, close up, is a dark core with a thin frosted, chipped rim and a
// crescent of the drilled wall showing on one side; that's what's drawn here.
// Two pictures come out: the cutout itself and the same stone in a light box -- on black
// velvet like the category's explore photos, or on a white light-box sweep.
import sharp from 'sharp';

import { MAX_HOLES, type Backdrop, type DrillHole } from './drill-data';
export type { Backdrop, DrillHole } from './drill-data';

export const BACKDROPS: Backdrop[] = ['black', 'white'];

export const MIN_HOLE_R = 0.02;
export const MAX_HOLE_R = 0.2;
const OUT = 800;

/** 1 to 3 holes: x/y the centre as a fraction of the photo's width/height,
 *  r the radius as a fraction of its shorter side. */
export function cleanHoles(value: unknown): DrillHole[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_HOLES) return null;
  const holes: DrillHole[] = [];
  for (const h of value) {
    const x = Number(h?.x), y = Number(h?.y), r = Number(h?.r);
    if (![x, y, r].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || r < MIN_HOLE_R || r > MAX_HOLE_R) return null;
    holes.push({ x: round(x), y: round(y), r: round(r) });
  }
  return holes;
}
const round = (n: number) => Math.round(n * 10000) / 10000;

// Same holes, same chips: a re-save doesn't reshuffle the rim.
function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function holeSvg(width: number, height: number, holes: DrillHole[]) {
  const side = Math.min(width, height);
  const parts = holes.map((h, i) => {
    const cx = h.x * width, cy = h.y * height, r = h.r * side;
    const rand = rng(Math.round(cx * 7919 + cy * 104729 + r * 31));
    // Frosted rim: a ring a little wider than the hole, its outer edge chipped.
    const chips = Array.from({ length: 48 }, (_, k) => {
      const a = (k / 48) * Math.PI * 2;
      const rr = r * (1.1 + rand() * rand() * 0.22);
      return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
    }).join(' ');
    const specks = Array.from({ length: 12 }, () => {
      const a = rand() * Math.PI * 2, d = r * (1.08 + rand() * 0.12);
      return `<circle cx="${(cx + Math.cos(a) * d).toFixed(1)}" cy="${(cy + Math.sin(a) * d).toFixed(1)}" r="${(r * (0.03 + rand() * 0.04)).toFixed(1)}" fill="#3a3a3a" opacity="0.55"/>`;
    }).join('');
    // The far wall of the bore, seen at a slight angle: a crescent on the lit side.
    const off = r * 0.2;
    return `
      <radialGradient id="rim${i}" cx="${cx}" cy="${cy}" r="${r * 1.24}" gradientUnits="userSpaceOnUse">
        <stop offset="0.76" stop-color="#ffffff" stop-opacity="0.95"/>
        <stop offset="0.86" stop-color="#e9e9ea" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#bdbdc0" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wall${i}" cx="${cx - off}" cy="${cy - off}" r="${r}" gradientUnits="userSpaceOnUse">
        <stop offset="0.55" stop-color="#2a2620"/>
        <stop offset="0.9" stop-color="#6b5a3e"/>
        <stop offset="1" stop-color="#8e7a55"/>
      </radialGradient>
      <polygon points="${chips}" fill="url(#rim${i})" filter="url(#soft)"/>
      ${specks}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#wall${i})"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 1.02}" fill="none" stroke="#1d1d1f" stroke-width="${(r * 0.07).toFixed(1)}" opacity="0.7"/>`;
  }).join('');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(side * 0.0025).toFixed(2)}"/></filter></defs>${parts}</svg>`);
}

/** The dark core of each hole -- the bore going into the stone. */
function coreSvg(width: number, height: number, holes: DrillHole[]) {
  const side = Math.min(width, height);
  const cores = holes.map((h, i) => {
    const r = h.r * side, off = r * 0.16;
    // Shifted away from the wall crescent, so the crescent stays visible.
    const cx = h.x * width + off * 0.55, cy = h.y * height + off * 0.55;
    return `<radialGradient id="c${i}" cx="${cx}" cy="${cy}" r="${r * 0.84}" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#08080a"/><stop offset="0.75" stop-color="#121216"/><stop offset="1" stop-color="#26262c"/>
      </radialGradient><circle cx="${cx}" cy="${cy}" r="${r * 0.84}" fill="url(#c${i})"/>`;
  }).join('');
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><defs><filter id="f"><feGaussianBlur stdDeviation="${(side * 0.0015).toFixed(2)}"/></filter></defs><g filter="url(#f)">${cores}</g></svg>`);
}

/** The cutout with its holes drilled, still transparent around the stone. */
export async function drilledCutout(base: Buffer, holes: DrillHole[]): Promise<Buffer> {
  const stone = await sharp(base).rotate().ensureAlpha()
    .resize({ width: OUT, height: OUT, fit: 'inside', withoutEnlargement: true })
    .png().toBuffer({ resolveWithObject: true });
  const { width, height } = stone.info;
  if (!holes.length) return sharp(stone.data).webp({ quality: 92, alphaQuality: 100 }).toBuffer();
  // Drawn only where there's stone, so a hole near the edge doesn't spill past it.
  const drawn = await sharp(stone.data).composite([{ input: holeSvg(width, height, holes), blend: 'atop' }]).png().toBuffer();
  return sharp(drawn)
    .composite([{ input: coreSvg(width, height, holes), blend: 'atop' }])
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
}

/** Black velvet, as in the category's explore photos: fine pile, a soft
 *  fall-off of the light, and a few specks of lint. */
async function velvet(size: number, seed: number): Promise<Buffer> {
  const rand = rng(seed);
  const noise = Buffer.alloc(size * size);
  for (let i = 0; i < noise.length; i++) noise[i] = 14 + Math.floor(rand() * 22);
  const pile = await sharp(noise, { raw: { width: size, height: size, channels: 1 } }).blur(0.8).toColourspace('srgb').png().toBuffer();
  const lint = Array.from({ length: 26 }, () =>
    `<circle cx="${(rand() * size).toFixed(0)}" cy="${(rand() * size).toFixed(0)}" r="${(0.6 + rand() * 1.6).toFixed(1)}" fill="#d8d8d8" opacity="${(0.25 + rand() * 0.45).toFixed(2)}"/>`).join('');
  const light = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="l" cx="0.42" cy="0.38" r="0.8"><stop offset="0" stop-color="#3a3a40" stop-opacity="0.55"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/></radialGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#l)"/>${lint}</svg>`);
  return sharp(pile).composite([{ input: light }]).png().toBuffer();
}

/** White light box: an even, bright sweep, a touch darker toward the corners. */
async function lightBox(size: number, seed: number): Promise<Buffer> {
  const rand = rng(seed);
  const noise = Buffer.alloc(size * size);
  for (let i = 0; i < noise.length; i++) noise[i] = 238 + Math.floor(rand() * 8);
  const base = await sharp(noise, { raw: { width: size, height: size, channels: 1 } }).blur(1.2).toColourspace('srgb').png().toBuffer();
  const light = Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="l" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#c9c9cc" stop-opacity="0.55"/></radialGradient></defs>
    <rect width="${size}" height="${size}" fill="url(#l)"/></svg>`);
  return sharp(base).composite([{ input: light }]).png().toBuffer();
}

/** The drilled stone in a light box -- black velvet or white -- with its shadow, as a square photo. */
export async function inLightBox(cutout: Buffer, backdrop: Backdrop, seed = 1): Promise<Buffer> {
  const size = 1200;
  const stone = await sharp(cutout).resize({ width: Math.round(size * 0.56), height: Math.round(size * 0.56), fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
  const { width, height } = stone.info;
  const left = Math.round((size - width) / 2), top = Math.round((size - height) / 2);
  const alpha = await sharp(stone.data).extractChannel(3).raw().toBuffer();
  const strength = backdrop === 'black' ? 0.7 : 0.28;
  const shadowRaw = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) shadowRaw[i * 4 + 3] = Math.round(alpha[i] * strength);
  const pad = 40;
  const shadow = await sharp(shadowRaw, { raw: { width, height, channels: 4 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(backdrop === 'black' ? 14 : 18).png().toBuffer();
  const background = backdrop === 'black' ? await velvet(size, seed) : await lightBox(size, seed);
  return sharp(background)
    .composite([
      { input: shadow, left: left - pad + 10, top: top - pad + 16 },
      { input: stone.data, left, top }
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}
