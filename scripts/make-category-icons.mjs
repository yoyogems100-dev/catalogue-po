import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Generates the little gemstone cut-outs shown beside each category name in
// every category dropdown (quick order, the admin order builder, the customer
// "add a line" picker, the admin category filters).
//
// Source photos live in "all each cat/" -- the owner's own reference shots.
// That folder is NOT in git (one of its filenames contains colons, which
// Windows checkouts reject), so the generated PNGs under public/ are the
// committed artefact; keep the source folder locally to re-run this.
//
// The sources are the owner's own reference shots,
// one per category, each a stone on some backdrop. This script removes that
// backdrop, crops to the stone, squares it up and writes a small transparent
// PNG to public/reference/categories/<slug>.png, which is what the UI loads.
// Re-run it after adding or replacing a source photo:
//
//   node scripts/make-category-icons.mjs
//
// The backdrop removal is a border flood fill: a pixel is background when it
// can be reached from the image edge through a chain of pixels that each stay
// close to their neighbour (so soft gradients and vignettes are followed) and
// all stay within a looser distance of the border's own mean colour (so the
// fill can't leak through a highlight into the gem). Per-photo tolerances are
// in CATEGORY_ICONS below -- they were tuned by eye, photo by photo, because a
// single global setting either left a grey rim on the dark-backdrop shots or
// ate the pale stones on the white ones.
//
// Options per entry:
//   near/global  flood-fill tolerances (neighbour chain / distance from border mean)
//   key          also drop every pixel near the backdrop colour, not just the
//                connected ones -- for photos where a soft drop shadow touches
//                the stone. Only safe when the gem's colour is far from the
//                backdrop's.
//   circle       [cx, cy, r] as fractions -- masks everything outside the gem
//                first, for photos that aren't a stone on a backdrop at all
//                (star-light is a hand holding the stone).
//   skipFill     circle crop only, no flood fill.
//   chroma       drop every pixel whose colour is within this much of grey --
//                for a saturated stone on a white/grey/black backdrop, where
//                "is it coloured?" separates them far more cleanly than "is it
//                near the border's mean?" does on a graded studio sweep.
//   luma         drop every pixel darker than this -- for a bright stone on a
//                black backdrop, where the fill has no edge to stop at.
//   holes        after the backdrop is gone, make any transparent island that
//                does NOT reach the image border opaque again. chroma and luma
//                judge each pixel alone, so a grey facet inside the stone comes
//                out as a hole in it; only the outside is really backdrop.
//   open         erode the cut-out by this many pixels, keep the largest piece,
//                then dilate it back -- severs a thin bridge joining the stone
//                to a scrap of backdrop that solo alone can't separate.
//   solo         keep the single largest blob instead of everything within 2%
//                of the total. For photos that are one object, anything else
//                is a tray edge, a ridge shadow or a neighbouring stone.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = process.env.ICON_SRC || path.join(ROOT, 'all each cat');
// ICON_SCALE=3 writes the same cut-outs at 480x384 WebP into .../categories/hd2
// for the public website, where they are shown larger than in a dropdown.
// The dropdown PNGs and lib/category-icons.ts are left alone on that run.
// The site serves these through /_next/image, which caches for 31 days by
// URL, so a re-cut that should show up sooner goes into a new folder (hd2
// replaced hd when the white rims were cleaned) and lib/site/category-images.ts
// follows it.
const SCALE = Number(process.env.ICON_SCALE || 1);
const HD = SCALE > 1;
const OUT_DIR = path.join(ROOT, 'public/reference/categories', HD ? 'hd2' : '');
// Every icon is written onto the same 5:4 landscape tile. It is landscape
// rather than square because these stones are not all round: a rose-cut
// polki, a strand of rainbow corundum and a pair of foiled crystals are all
// much wider than they are tall, and inside a square tile they shrank to a
// sliver while a round CZ filled the whole thing. 160x128 renders at 40x32
// in a dropdown row, so it covers retina with room to spare.
const TILE_W = 160 * SCALE, TILE_H = 128 * SCALE;

// How much of the tile a stone's own pixels should cover, so every category
// carries roughly the same visual weight in the list. Measured against the
// pixels that are actually stone -- NOT the bounding box -- because a thin
// diagonal strand fills its box while covering very little of it, and box
// sizing left those looking tiny next to a round stone of the same box size.
// A stone is never enlarged past the tile, so very wide ones simply run the
// full width.
const TARGET_INK = 0.45;

// slug -> source photo + the tolerances that photo needs.
// The 3A/4A/5A/7A/Swiss CZ grades share one source: the owner filed that
// photo under all of those names, because they are the same stone at
// different qualities. Heighted CZ had its own photo supplied later and no
// longer uses the shared one.
const CATEGORY_ICONS = {
  'crushed-ice-cut':       { src: 'ICE CRUSH (4).JPEG', fringe: 24 },
  // One strand on a ridged white sweep. The ridges cast shadow lines the fill
  // can't reach, and one of them survived as a stray streak under the strand;
  // solo drops it, because there is only ever one object in this shot.
  'rainbow-corundum':      { src: 'rainbow-corundum-300.jpg', near: 22, global: 92, chroma: 24, holes: true, open: 3, solo: true },
  'ruby-synthetic':        { src: 'ruby: ruby glass filled.png', oval: [0.138, 0.128, 0.817, 0.845, 3.5], skipFill: true, fringe: 6 },
  'ruby-glass-filled':     { src: 'ruby: ruby glass filled.png', oval: [0.138, 0.128, 0.817, 0.845, 3.5], skipFill: true, fringe: 6 },
  'ruby-green-cabs':       { src: 'green cabs.jpg', fringe: 24 },
  'coloured-cz-stones':    { src: 'color cz.jpg', circle: 'fit', skipFill: true },
  'lab-grown-stones':      { src: 'labEm.webp', oval: [0.206, 0.272, 0.781, 0.745, 3], skipFill: true, fringe: 6 },
  'synthetic-opals':       { src: 'syn opal.jpg', fringe: 24 },
  'fusion-stones':         { src: 'fusionstone.webp', fringe: 24, fringeLo: 0.28, fringeHi: 0.5 },
  'turkey-ring-stones':    { src: 'turkey-ring-stones-29.webp', near: 34, global: 125, key: true, fringe: 24 },
  // Strands edge to edge: framed, not cut out. The crop is a wide band across
  // the middle of a portrait photo, which is where every colour appears.
  'cz-glass-beads':        { src: 'glass beads.png', frame: { w: 150, h: 104, crop: [0, 0.2, 1, 0.59] } },
  'mop-mother-of-pearl':   { src: 'mop.png', near: 34, global: 130 },
  'mop-onyx':              { src: 'onyx.png', fringe: 24 },
  'evil-eye-malachite':    { src: 'evileye.png', oval: [0.085, 0.005, 0.955, 0.93], skipFill: true },
  'flat-polki-foil-polki': { src: 'polki.png' },
  'glass-pearls':          { src: 'glass pearl.jpg', near: 26, global: 110 },
  'crystal':               { src: 'Amethyst-1-scaled crystal.jpg', fringe: 24 },
  'queen-conch':           { src: 'QUEEN CONCH.png', near: 32, global: 125 },
  'foiled-glass-crystal':  { src: 'foiled stone.jpeg', fringe: 24 },
  // A soft white glow sits between this stone and its backdrop; the fill
  // stops at it, so key it out by colour as well.
  'natural-emeralds':      { src: 'natEmerald.webp', near: 20, global: 150, key: true, fringe: 24 },
  'glass-stones':          { src: 'glass-green gemstone.webp', fringe: 24 },
  'star-light':            { src: 'starlighht.webp', circle: [0.487, 0.47, 0.275], skipFill: true },
  // A turquoise bead on a grey sweep -- the two are close in brightness and
  // the border fill left the whole backdrop, but nothing else in the frame is
  // coloured at all, so key on saturation and close the pale facets after.
  'ceramic':               { src: 'ceramic.jpg', chroma: 34, holes: true, solo: true },
  'malachite':             { src: 'malachite.jpeg', fringe: 24 },
  '7a-quality':            { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg', circle: 'fit', skipFill: true, fitT: 40, fitShrink: 0.03 },
  '5a-quality-cz':         { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg', circle: 'fit', skipFill: true, fitT: 40, fitShrink: 0.03 },
  '4a-quality-cz':         { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg', circle: 'fit', skipFill: true, fitT: 40, fitShrink: 0.03 },
  '3a-quality-cz':         { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg', circle: 'fit', skipFill: true, fitT: 40, fitShrink: 0.03 },
  'heighted-cz-stones':    { src: 'heightened cz.jpeg', near: 30, global: 115, key: true },
  // SWIZZ in that shared filename is Swiss High Density CZ.
  'high-density-cz':       { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg', circle: 'fit', skipFill: true, fitT: 40, fitShrink: 0.03 },
  'nano':                  { src: 'blue nano.png', circle: 'fit', skipFill: true },
  'moissanite':            { src: 'moissanite.jpg' },
  // A dark backdrop with lighter blobs at the corners; one of them clung to
  // the top right of the heart as a hairline. It is a separate blob, so solo
  // removes it.
  'hole-punched-stones':   { src: 'hole.punch.png', skipFill: true, luma: 70, holes: true, open: 4, solo: true },
  // The left flank fades into the black backdrop with no edge for the fill to
  // find, so a flood from the border cut the stone in half. Keyed on
  // brightness instead -- the backdrop is genuinely black -- then holes closes
  // the dark facets the threshold punched out, and solo drops the lens flare.
  'fancy-special-shapes':  { src: 'fancy special shp.png', skipFill: true, luma: 40, holes: true, solo: true },
  'green-onyx-chatam':     { src: 'green onyx.webp', oval: [0.068, 0.07, 0.929, 0.875], skipFill: true, fringe: 6 },
  'ruby-opaque-chatam':    { src: 'red-opeque-synthetic-stone.jpg', oval: [0.024, 0.12, 0.966, 0.885], skipFill: true },
  'preform-balls':         { src: 'preformballs.tiff' },
  'synthetic-corundum':    { src: 'synthtic corundum.png', fringe: 24 },
  'natural-pearls':        { src: 'pearl.webp' },
  'semi-precious-stones':  { src: 'semiPrecious.png', fringe: 24 }
  // Every category is illustrated. If a new one is added, give it an entry
  // here and re-run this script.
};

const dist = (a, b, c, r, g, bl) => Math.abs(a - r) + Math.abs(b - g) + Math.abs(c - bl);

// circle: 'fit' -- finds a round stone's own circle, for round stones on a
// pale sweep where any colour threshold either leaves a grey rim of shadow and
// backdrop or eats the stone's pale outer facets. Pixels far from the border's
// mean colour are the stone plus its drop shadow; the shadow only ever falls
// below it, so the width of that blob gives the diameter and its top edge the
// centre's height. fitShrink trims a hair off the radius so the anti-aliased
// girdle -- half backdrop -- doesn't survive as a light ring.
function fitCircle(data, W, H, C, opts) {
  let sr = 0, sg = 0, sb = 0, n = 0;
  const edge = (p) => { sr += data[p * C]; sg += data[p * C + 1]; sb += data[p * C + 2]; n++; };
  for (let x = 0; x < W; x++) { edge(x); edge((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { edge(y * W); edge(y * W + W - 1); }
  sr /= n; sg /= n; sb /= n;
  const T = opts.fitT ?? 60;
  const on = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) on[p] = dist(sr, sg, sb, data[p * C], data[p * C + 1], data[p * C + 2]) > T ? 1 : 0;
  // Largest blob only, so a speck of dust or a watermark letter off the stone
  // can't stretch the fit.
  const seen = new Uint8Array(W * H);
  let best = null;
  for (let p0 = 0; p0 < W * H; p0++) {
    if (seen[p0] || !on[p0]) continue;
    const stack = [p0]; seen[p0] = 1;
    const b = { n: 0, minX: W, maxX: -1, minY: H };
    while (stack.length) {
      const p = stack.pop(), x = p % W, y = (p / W) | 0;
      b.n++; if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x; if (y < b.minY) b.minY = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (seen[q] || !on[q]) continue;
        seen[q] = 1; stack.push(q);
      }
    }
    if (!best || b.n > best.n) best = b;
  }
  const r0 = (best.maxX - best.minX + 1) / 2;
  const r = r0 * (1 - (opts.fitShrink ?? 0.015));
  if (process.env.ICON_DEBUG) console.log(`  fit cx=${((best.minX + r0) / W).toFixed(3)} cy=${((best.minY + r0) / H).toFixed(3)} r=${(r / Math.min(W, H)).toFixed(3)}`);
  return { cx: best.minX + r0 - 0.5, cy: best.minY + r0 - 0.5, r };
}

// Not every category photo is one stone on a backdrop. Glass Beads is a
// full-bleed shot of strands -- there is no background to remove, only beads
// edge to edge. Those are shown as a small framed snapshot instead: a crop of
// the photo fitted to a rectangle on the same tile, with softly rounded
// corners so it reads as a deliberate swatch rather than a cut-out that
// failed. The rectangle is sized to sit among the cut-out stones rather than
// tower over them or disappear beside them.
async function framedSnapshot(SRC, OUT, opts) {
  const { w, h, crop } = opts.frame;
  const meta = await sharp(SRC).metadata();
  const [cx, cy, cwF, chF] = crop || [0, 0, 1, 1];
  const region = {
    left: Math.round(cx * meta.width),
    top: Math.round(cy * meta.height),
    width: Math.round(cwF * meta.width),
    height: Math.round(chF * meta.height)
  };

  const r = 10;
  const rounded = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
  const tile = await sharp(SRC)
    .extract(region)
    .resize(w, h, { fit: 'cover' })
    .composite([{ input: rounded, blend: 'dest-in' }])
    .png()
    .toBuffer();

  await sharp({ create: { width: TILE_W, height: TILE_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tile, left: Math.round((TILE_W - w) / 2), top: Math.round((TILE_H - h) / 2) }])
    [HD ? 'webp' : 'png'](HD ? { quality: 90, alphaQuality: 100 } : { compressionLevel: 9 })
    .toFile(OUT);

  return { ink: (w * h) / (TILE_W * TILE_H), outW: w, outH: h };
}

async function cutout(SRC, OUT, opts) {
  if (opts.frame) return framedSnapshot(SRC, OUT, opts);
  const NEAR = opts.near ?? 14;
  const GLOBAL = opts.global ?? 52;
  const base = sharp(SRC).rotate();
  const meta = await base.metadata();
  const work = base.resize({ width: Math.min(meta.width, 900), height: Math.min(meta.height, 900), fit: 'inside', withoutEnlargement: true });
  const { data, info } = await work.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  // The backdrop's colour, read before anything is cut, for the fringe pass.
  const backdrop = [0, 0, 0];
  {
    let n = 0;
    const add = (p) => { for (let c = 0; c < 3; c++) backdrop[c] += data[p * C + c]; n++; };
    for (let x = 0; x < W; x++) { add(x); add((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { add(y * W); add(y * W + W - 1); }
    for (let c = 0; c < 3; c++) backdrop[c] /= n;
  }

  // If the source already ships a real cutout, trust it and skip the fill.
  let alreadyTransparent = 0;
  for (let i = 3; i < data.length; i += C) if (data[i] < 200) alreadyTransparent++;
  const preCut = alreadyTransparent / (W * H) > 0.05;

  // A circle crop masks everything outside the gem before the fill runs, for
  // sources that aren't a stone on a backdrop at all.
  if (opts.circle) {
    let cx, cy, r;
    if (opts.circle === 'fit') ({ cx, cy, r } = fitCircle(data, W, H, C, opts));
    else { const [cxf, cyf, rf] = opts.circle; cx = cxf * W; cy = cyf * H; r = rf * Math.min(W, H); }
    // One pixel of soft edge, so the circle isn't a stair-step once scaled.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const a = Math.max(0, Math.min(1, r - Math.hypot(x - cx, y - cy) + 0.5));
      const i = (y * W + x) * C + 3;
      data[i] = Math.round(data[i] * a);
    }
  }

  // The same idea for an oval or cushion stone, whose outline is a
  // superellipse inside the given box: n = 2 is an ellipse, n around 4 a
  // cushion's rounded rectangle. The box is measured from the photo by eye.
  if (opts.oval) {
    const [x0, y0, x1, y1, n = 2] = opts.oval;
    const cx = ((x0 + x1) / 2) * W, cy = ((y0 + y1) / 2) * H;
    const a = ((x1 - x0) / 2) * W, b = ((y1 - y0) / 2) * H;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = (Math.abs((x - cx) / a) ** n + Math.abs((y - cy) / b) ** n) ** (1 / n);
      const k = Math.max(0, Math.min(1, (1 - v) * Math.min(a, b) + 0.5));
      const i = (y * W + x) * C + 3;
      data[i] = Math.round(data[i] * k);
    }
  }

  const bg = new Uint8Array(W * H);
  if (!preCut && !opts.skipFill) {
    let sr = 0, sg = 0, sb = 0, n = 0;
    const border = [];
    for (let x = 0; x < W; x++) { border.push(x, (H - 1) * W + x); }
    for (let y = 0; y < H; y++) { border.push(y * W, y * W + W - 1); }
    for (const p of border) { sr += data[p * C]; sg += data[p * C + 1]; sb += data[p * C + 2]; n++; }
    sr /= n; sg /= n; sb /= n;

    const queue = [];
    for (const p of border) {
      if (bg[p]) continue;
      if (data[p * C + 3] === 0) { bg[p] = 1; queue.push(p); continue; }
      if (dist(sr, sg, sb, data[p * C], data[p * C + 1], data[p * C + 2]) <= GLOBAL) { bg[p] = 1; queue.push(p); }
    }
    for (let qi = 0; qi < queue.length; qi++) {
      const p = queue[qi], x = p % W, y = (p / W) | 0;
      const pr = data[p * C], pg = data[p * C + 1], pb = data[p * C + 2];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (bg[q]) continue;
        const qr = data[q * C], qg = data[q * C + 1], qb = data[q * C + 2];
        if (dist(pr, pg, pb, qr, qg, qb) <= NEAR && dist(sr, sg, sb, qr, qg, qb) <= GLOBAL) { bg[q] = 1; queue.push(q); }
      }
    }
    // The key pass drops every pixel close to the backdrop colour, not just the ones
    // reachable from the border. Needed where a soft drop shadow touches the
    // stone -- connectivity alone keeps the shadow, because it's attached.
    if (opts.key) {
      for (let p = 0; p < W * H; p++) {
        if (dist(sr, sg, sb, data[p * C], data[p * C + 1], data[p * C + 2]) <= GLOBAL) bg[p] = 1;
      }
    }
    for (let p = 0; p < W * H; p++) if (bg[p]) data[p * C + 3] = 0;
  }

  // Colour- and brightness-keyed backdrops. Both judge a pixel on its own, so
  // they run on the whole image rather than from the border, and both leave
  // holes inside the stone that `holes` closes again.
  if (opts.chroma || opts.luma) {
    for (let p = 0; p < W * H; p++) {
      const r = data[p * C], g = data[p * C + 1], b = data[p * C + 2];
      if (opts.chroma && Math.max(r, g, b) - Math.min(r, g, b) < opts.chroma) { data[p * C + 3] = 0; continue; }
      if (opts.luma && (0.299 * r + 0.587 * g + 0.114 * b) < opts.luma) data[p * C + 3] = 0;
    }
  }

  // Transparency that can't be reached from the image edge isn't backdrop --
  // it's a facet inside the stone that happened to be grey or dark. Flood the
  // transparent pixels from the border and restore everything the flood missed.
  if (opts.holes) {
    const outside = new Uint8Array(W * H);
    const queue = [];
    for (let x = 0; x < W; x++) for (const p of [x, (H - 1) * W + x]) if (!outside[p] && data[p * C + 3] <= 24) { outside[p] = 1; queue.push(p); }
    for (let y = 0; y < H; y++) for (const p of [y * W, y * W + W - 1]) if (!outside[p] && data[p * C + 3] <= 24) { outside[p] = 1; queue.push(p); }
    for (let qi = 0; qi < queue.length; qi++) {
      const p = queue[qi], x = p % W, y = (p / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (outside[q] || data[q * C + 3] > 24) continue;
        outside[q] = 1; queue.push(q);
      }
    }
    for (let p = 0; p < W * H; p++) if (!outside[p]) data[p * C + 3] = 255;
  }

  // A thin bridge to something that isn't the stone -- the sliver of backdrop
  // trim touching the heart's right lobe -- survives every threshold that
  // still leaves the stone a clean edge, and connects the two into one blob so
  // the pass below can't tell them apart. Eroding by a few pixels snaps the
  // bridge, and dilating the surviving piece back restores the silhouette
  // exactly, because the result is intersected with the original mask.
  if (opts.open) {
    const N = opts.open;
    let mask = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) mask[p] = data[p * C + 3] > 24 ? 1 : 0;
    const morph = (src, grow) => {
      const out = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const p = y * W + x;
        let hit = grow ? 0 : 1;
        for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          // Outside the frame counts as empty, so a stone running off the edge
          // erodes there too -- harmless, since the dilate puts it back.
          const v = nx < 0 || ny < 0 || nx >= W || ny >= H ? 0 : src[ny * W + nx];
          if (grow) hit |= v; else hit &= v;
        }
        out[p] = hit;
      }
      return out;
    };
    for (let i = 0; i < N; i++) mask = morph(mask, false);
    // Largest piece of the eroded mask, then grow it back past where it started.
    const seen = new Uint8Array(W * H);
    let best = null;
    for (let p0 = 0; p0 < W * H; p0++) {
      if (seen[p0] || !mask[p0]) continue;
      const stack = [p0]; seen[p0] = 1; const cells = [];
      while (stack.length) {
        const p = stack.pop(); cells.push(p);
        const x = p % W, y = (p / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (seen[q] || !mask[q]) continue;
          seen[q] = 1; stack.push(q);
        }
      }
      if (!best || cells.length > best.length) best = cells;
    }
    let grown = new Uint8Array(W * H);
    for (const p of best || []) grown[p] = 1;
    for (let i = 0; i < N + 1; i++) grown = morph(grown, true);
    for (let p = 0; p < W * H; p++) if (!grown[p]) data[p * C + 3] = 0;
  }

  // Keep only the largest surviving blob (plus anything comparable to it) --
  // the flood fill leaves a rim of speckles where a noisy backdrop meets the
  // stone, and at 28px those read as dirt around the gem.
  {
    const seen = new Uint8Array(W * H);
    const blobs = [];
    for (let p0 = 0; p0 < W * H; p0++) {
      if (seen[p0] || data[p0 * C + 3] <= 24) continue;
      const stack = [p0]; seen[p0] = 1; const cells = [];
      while (stack.length) {
        const p = stack.pop(); cells.push(p);
        const x = p % W, y = (p / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const q = ny * W + nx;
          if (seen[q] || data[q * C + 3] <= 24) continue;
          seen[q] = 1; stack.push(q);
        }
      }
      blobs.push(cells);
    }
    const totalKept = blobs.reduce((n, b) => n + b.length, 0);
    const biggest = blobs.reduce((n, b) => Math.max(n, b.length), 0);
    // 2% of everything kept, so a photo of several stones keeps all of them.
    // `solo` instead keeps only the largest, for the photos that really are
    // one object and where the runner-up is a tray edge or a ridge shadow --
    // both far too big for the 2% rule to catch.
    const floor = opts.solo ? biggest : totalKept * 0.02;
    for (const cells of blobs) if (cells.length < floor) for (const p of cells) data[p * C + 3] = 0;
  }

  // fringe: every threshold above leaves a band of pale pixels round the stone
  // -- its drop shadow and the anti-aliased girdle, both part backdrop. On a
  // white page that is invisible; on the website's navy it reads as a white
  // rim. Within this many pixels of the outline, each pixel's opacity becomes
  // how far it is from the backdrop colour -- a colour-to-alpha against the
  // backdrop -- ramped so anything closer than fringeLo (a pale shadow, the
  // girdle's half-backdrop pixels) goes and anything past fringeHi (real
  // stone) stays solid. Its colour is un-mixed from the backdrop to match.
  // Only for pale backdrops, and never for pale stones (pearls, white CZ),
  // whose own edge is as close to white as the shadow is.
  if (opts.fringe) {
    const BAND = opts.fringe, LO = opts.fringeLo ?? 0.18, HI = opts.fringeHi ?? 0.4;
    const d = new Int16Array(W * H).fill(-1);
    const queue = [];
    for (let p = 0; p < W * H; p++) if (data[p * C + 3] <= 24) { d[p] = 0; queue.push(p); }
    for (let qi = 0; qi < queue.length; qi++) {
      const p = queue[qi], x = p % W, y = (p / W) | 0;
      if (d[p] >= BAND) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (d[q] >= 0) continue;
        d[q] = d[p] + 1; queue.push(q);
      }
    }
    for (let p = 0; p < W * H; p++) {
      if (d[p] <= 0) continue;
      const i = p * C;
      // Only a pixel darker than the backdrop can be backdrop plus something;
      // a brighter one is a highlight on the stone, so those channels count 0.
      let a = 0;
      for (let c = 0; c < 3; c++) a = Math.max(a, Math.max(0, backdrop[c] - data[i + c]) / backdrop[c]);
      const k = Math.max(0, Math.min(1, (a - LO) / (HI - LO)));
      if (k >= 1) continue;
      if (k <= 0) { data[i + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) data[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - a) * backdrop[c]) / a)));
      data[i + 3] = Math.round(data[i + 3] * k);
    }
  }

  // Bounding box of what survived, then a small transparent margin so the gem
  // never touches the edge of its 1:1 tile.
  let minX = W, minY = H, maxX = -1, maxY = -1, kept = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (data[(y * W + x) * C + 3] > 24) { kept++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const removed = 1 - kept / (W * H);
  if (maxX < 0) throw new Error('nothing left after background removal');

  const cw = maxX - minX + 1, ch = maxY - minY + 1;

  // Scale so this stone's ink covers TARGET_INK of the tile, then clamp so it
  // still fits inside the tile with a hair of margin.
  const margin = 0.96;
  const byInk = Math.sqrt((TARGET_INK * TILE_W * TILE_H) / kept);
  const toFit = Math.min((TILE_W * margin) / cw, (TILE_H * margin) / ch);
  const scale = Math.min(byInk, toFit);
  const outW = Math.max(1, Math.round(cw * scale));
  const outH = Math.max(1, Math.round(ch * scale));

  await sharp(data, { raw: { width: W, height: H, channels: C } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .resize(outW, outH, { fit: 'fill' })
    .extend({
      top: Math.round((TILE_H - outH) / 2), bottom: TILE_H - outH - Math.round((TILE_H - outH) / 2),
      left: Math.round((TILE_W - outW) / 2), right: TILE_W - outW - Math.round((TILE_W - outW) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    [HD ? 'webp' : 'png'](HD ? { quality: 90, alphaQuality: 100 } : { compressionLevel: 9, palette: true })
    .toFile(OUT);

  return { ink: (kept * scale * scale) / (TILE_W * TILE_H), outW, outH };
  }

fs.mkdirSync(OUT_DIR, { recursive: true });
// Naming slugs on the command line re-cuts just those, for tuning one photo
// without waiting on the other thirty-nine. lib/category-icons.ts is only
// rewritten on a full run, so a partial run can't shrink the list.
const only = new Set(process.argv.slice(2));
const written = [];
for (const [slug, opts] of Object.entries(CATEGORY_ICONS)) {
  if (only.size && !only.has(slug)) continue;
  const src = path.join(SRC_DIR, opts.src);
  if (!fs.existsSync(src)) { console.log(`${slug}\tSKIPPED (missing ${opts.src})`); continue; }
  const out = path.join(OUT_DIR, `${slug}.${HD ? 'webp' : 'png'}`);
  const r = await cutout(src, out, opts);
  written.push(slug);
  console.log(`${slug.padEnd(24)}${r.outW}x${r.outH}\tink ${(r.ink * 100).toFixed(0)}%\t${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}

// The app can't read the filesystem from a client component, so the list of
// slugs that actually have an icon is emitted here and imported as data.
const lib = `// GENERATED by scripts/make-category-icons.mjs -- do not edit by hand.
// Re-run that script after adding or replacing a photo in "all each cat/".

const SLUGS_WITH_ICONS = new Set([
${written.sort().map((s) => `  '${s}'`).join(',\n')}
]);

/**
 * The little transparent gemstone cut-out shown beside a category's name in
 * every category dropdown, or null for categories whose reference photo the
 * owner hasn't supplied yet -- those fall back to a plain text row.
 */
export function categoryIconUrl(slug: string | null | undefined): string | null {
  if (!slug || !SLUGS_WITH_ICONS.has(slug)) return null;
  return \`/reference/categories/\${slug}.png\`;
}
`;
if (HD) {
  console.log('\nHD run -- lib/category-icons.ts left alone.');
} else if (only.size) {
  console.log('\nPartial run -- lib/category-icons.ts left alone.');
} else {
  fs.writeFileSync(path.join(ROOT, 'lib/category-icons.ts'), lib);
  console.log(`\nlib/category-icons.ts\t${written.length} categories with icons`);
}
