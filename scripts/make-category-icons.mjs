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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'all each cat');
const OUT_DIR = path.join(ROOT, 'public/reference/categories');
// 128px: these render at 22-28px in a dropdown row, so 128 covers retina
// with room to spare and keeps the whole set around 200 KB.
const MAX = 128;

// slug -> source photo + the tolerances that photo needs.
// The 3A/4A/5A/7A/Swiss CZ grades share one source: the owner filed that
// photo under all of those names, because they are the same stone at
// different qualities. Heighted CZ had its own photo supplied later and no
// longer uses the shared one.
const CATEGORY_ICONS = {
  'crushed-ice-cut':       { src: 'ICE CRUSH (4).JPEG' },
  'rainbow-corundum':      { src: 'rainbow-corundum-300.jpg', near: 22, global: 80 },
  'ruby-synthetic':        { src: 'ruby: ruby glass filled.png', near: 40, global: 170, key: true },
  'ruby-glass-filled':     { src: 'ruby: ruby glass filled.png', near: 40, global: 170, key: true },
  'ruby-green-cabs':       { src: 'green cabs.jpg' },
  'coloured-cz-stones':    { src: 'color cz.jpg' },
  'lab-grown-stones':      { src: 'labEm.webp' },
  'synthetic-opals':       { src: 'syn opal.jpg' },
  'fusion-stones':         { src: 'fusionstone.webp' },
  'turkey-ring-stones':    { src: 'turkey-ring-stones-29.webp', near: 34, global: 125, key: true },
  // glassbeads.png (the newer photo) is a full-bleed shot of bead strands --
  // no backdrop to remove, and it carries a stock-library watermark -- so this
  // stays on the earlier photo until a replacement arrives.
  'cz-glass-beads':        { src: 'GLASS BEADS.jpeg', near: 40, global: 120, key: true },
  'mop-mother-of-pearl':   { src: 'mop.png', near: 34, global: 130 },
  'mop-onyx':              { src: 'onyx.png' },
  'evil-eye-malachite':    { src: 'evileye.png' },
  'flat-polki-foil-polki': { src: 'polki.png' },
  'glass-pearls':          { src: 'glass pearl.jpg', near: 26, global: 110 },
  'crystal':               { src: 'Amethyst-1-scaled crystal.jpg' },
  'queen-conch':           { src: 'QUEEN CONCH.png', near: 32, global: 125 },
  'foiled-glass-crystal':  { src: 'foiled stone.jpeg' },
  'natural-emeralds':      { src: 'natEmerald.webp' },
  'glass-stones':          { src: 'glass-green gemstone.webp' },
  'star-light':            { src: 'starlighht.webp', circle: [0.487, 0.47, 0.275], skipFill: true },
  'ceramic':               { src: 'ceramic.jpg' },
  'malachite':             { src: 'malachite.jpeg' },
  '7a-quality':            { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg' },
  '5a-quality-cz':         { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg' },
  '4a-quality-cz':         { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg' },
  '3a-quality-cz':         { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg' },
  'heighted-cz-stones':    { src: 'heightened cz.jpeg', near: 30, global: 115, key: true },
  // SWIZZ in that shared filename is Swiss High Density CZ.
  'high-density-cz':       { src: '7A:5A:3A:4A:SWIZZ:HEIGHTED.jpg' },
  'nano':                  { src: 'blue nano.png' },
  'moissanite':            { src: 'moissanite.jpg' },
  'hole-punched-stones':   { src: 'hole.punch.png', near: 30, global: 115 },
  // The left flank of this stone fades into its black backdrop with no edge
  // to find, so the cut-out loses it whatever the tolerance; 8/32 keeps the
  // most stone. A shot on a light backdrop would cut out cleanly.
  'fancy-special-shapes':  { src: 'fancy special shp.png', near: 8, global: 32 },
  'green-onyx-chatam':     { src: 'green onyx.webp' },
  'ruby-opaque-chatam':    { src: 'red-opeque-synthetic-stone.jpg' },
  'preform-balls':         { src: 'preformballs.tiff' },
  'synthetic-corundum':    { src: 'synthtic corundum.png' }
  // Still unillustrated: semi-precious-stones (no photo supplied), and
  // natural-pearls (the file supplied is a byte-for-byte copy of the Glass
  // Pearls photo, so it would show the wrong stone).
};

const dist = (a, b, c, r, g, bl) => Math.abs(a - r) + Math.abs(b - g) + Math.abs(c - bl);

async function cutout(SRC, OUT, opts) {
  const NEAR = opts.near ?? 14;
  const GLOBAL = opts.global ?? 52;
  const base = sharp(SRC).rotate();
  const meta = await base.metadata();
  const work = base.resize({ width: Math.min(meta.width, 900), height: Math.min(meta.height, 900), fit: 'inside', withoutEnlargement: true });
  const { data, info } = await work.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  // If the source already ships a real cutout, trust it and skip the fill.
  let alreadyTransparent = 0;
  for (let i = 3; i < data.length; i += C) if (data[i] < 200) alreadyTransparent++;
  const preCut = alreadyTransparent / (W * H) > 0.05;

  // A circle crop masks everything outside the gem before the fill runs, for
  // sources that aren't a stone on a backdrop at all.
  if (opts.circle) {
    const [cxf, cyf, rf] = opts.circle;
    const cx = cxf * W, cy = cyf * H, r = rf * Math.min(W, H), r2 = r * r;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) data[(y * W + x) * C + 3] = 0;
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
    for (const cells of blobs) if (cells.length < totalKept * 0.02) for (const p of cells) data[p * C + 3] = 0;
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
  const pad = Math.round(Math.max(cw, ch) * 0.04);
  const side = Math.max(cw, ch) + pad * 2;

  await sharp(data, { raw: { width: W, height: H, channels: C } })
    .extract({ left: minX, top: minY, width: cw, height: ch })
    .extend({
      top: Math.round((side - ch) / 2), bottom: side - ch - Math.round((side - ch) / 2),
      left: Math.round((side - cw) / 2), right: side - cw - Math.round((side - cw) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .resize(MAX, MAX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toFile(OUT);

  }

fs.mkdirSync(OUT_DIR, { recursive: true });
const written = [];
for (const [slug, opts] of Object.entries(CATEGORY_ICONS)) {
  const src = path.join(SRC_DIR, opts.src);
  if (!fs.existsSync(src)) { console.log(`${slug}\tSKIPPED (missing ${opts.src})`); continue; }
  const out = path.join(OUT_DIR, `${slug}.png`);
  await cutout(src, out, opts);
  written.push(slug);
  console.log(`${slug}\t${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
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
fs.writeFileSync(path.join(ROOT, 'lib/category-icons.ts'), lib);
console.log(`\nlib/category-icons.ts\t${written.length} categories with icons`);
