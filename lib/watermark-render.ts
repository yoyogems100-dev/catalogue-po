import path from 'node:path';
import { openSync } from 'fontkit';
import sharp, { type OverlayOptions, type Sharp } from 'sharp';

/**
 * The YOYO GEMS watermark every photo on the site and /po carries.
 *
 * It is drawn into the pixels once, when a photo is stored -- never laid over
 * it on screen, where saving or screenshotting the picture would drop it. It
 * goes on a separate copy: the original upload is kept untouched
 * (photos.original_path, site_media.original_path), and every crop or resize
 * is rebuilt from that original, so a photo can never end up marked twice.
 *
 * The style is the usual one on gemstone supplier photos: small, thin
 * lettering at 45 degrees, repeated in an even grid over the whole picture.
 * Each letter is a faint white fill with a hair-thin grey edge, so it reads
 * on a white background and on a dark stone alike without hiding the cut.
 */

export const WATERMARK_TEXT = 'YOYO GEMS';

/** Letter size (em), as a share of the photo's shorter side. */
const FONT_SIZE = 0.043;
/** Distance between neighbouring repeats, both ways, as a share of the shorter side. */
const SPACING = 0.3125;
/** Rising left to right. */
const ANGLE = -45;
const FILL_OPACITY = 0.15;
const EDGE_OPACITY = 0.07;
/** Edge width, as a share of the letter size. */
const EDGE = 0.045;

/*
 * Text becomes an SVG of glyph OUTLINES -- no font-family, no text element,
 * nothing for the renderer to look up. sharp draws SVG through librsvg, which
 * resolves font-family through fontconfig: fine on a Mac with fonts, a coin
 * toss inside a serverless Linux function with none. Outlines make the mark
 * byte-identical everywhere. The face is Geist Regular (assets/fonts, SIL
 * OFL, licence alongside it; traced in next.config.js).
 */
const FONT_PATH = path.join(process.cwd(), 'assets/fonts/Geist-Regular.ttf');

let cachedFont: any = null;
function font() {
  // Parsing the file is the slow part and it never changes, so a backfill
  // across hundreds of photos parses it once.
  if (!cachedFont) cachedFont = openSync(FONT_PATH);
  return cachedFont;
}

/**
 * One repeat of the mark, unrotated, as an SVG string.
 * @param fontSize the em size in pixels.
 * @returns null when the text has no drawable glyphs.
 */
export function textWatermarkSvg(text: string, fontSize: number): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const f = font();
  const run = f.layout(trimmed);
  const { minX, minY, maxX, maxY } = run.bbox;
  if (!(maxX - minX > 0) || !(maxY - minY > 0)) return null;

  let d = '', pen = 0;
  run.glyphs.forEach((glyph: any, i: number) => {
    d += glyph.path.translate(pen, 0).toSVG();
    pen += run.positions[i].xAdvance;
  });

  const scale = fontSize / f.unitsPerEm;
  const edge = fontSize * EDGE;
  const pad = Math.ceil(edge * 2);
  const width = Math.ceil((maxX - minX) * scale) + 2 * pad;
  const height = Math.ceil((maxY - minY) * scale) + 2 * pad;
  // Font outlines are y-up and start wherever the first glyph's bearing puts
  // them; SVG is y-down from the top left. This flips and shifts the whole
  // run so its ink sits inside the padded box.
  const transform = `translate(${pad - minX * scale} ${pad + maxY * scale}) scale(${scale} ${-scale})`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + `<path transform="${transform}" d="${d}" fill="#ffffff" fill-opacity="${FILL_OPACITY}" stroke="#000000" stroke-opacity="${EDGE_OPACITY}" stroke-width="${edge / scale}" stroke-linejoin="round" paint-order="stroke"/></svg>`;
}

/** Centres of the repeats: a square grid, turned with the text, centred on the photo. */
function places(w: number, h: number, step: number) {
  const out: { cx: number; cy: number }[] = [];
  const n = Math.ceil(Math.max(w, h) / 2 / step) + 1;
  for (let r = -n; r <= n; r++) {
    for (let c = -n; c <= n; c++) {
      const cx = w / 2 + c * step, cy = h / 2 + r * step;
      if (cx > -step && cx < w + step && cy > -step && cy < h + step) out.push({ cx, cy });
    }
  }
  return out;
}

/**
 * The photo with the watermark pattern drawn in, as a sharp pipeline so the
 * caller chooses the size and output format. `image` must already be upright
 * (rotated) and cropped -- the mark goes on exactly what will be shown.
 *
 * The result is flattened to raw pixels before it is handed back: sharp
 * always resizes BEFORE it composites, whatever order the calls are chained
 * in, so a caller's .resize() on an unflattened pipeline would shrink the
 * photo and then place the marks at full-size coordinates.
 */
export async function withWatermark(image: Buffer): Promise<Sharp> {
  const meta = await sharp(image, { limitInputPixels: 60_000_000 }).metadata();
  const w = meta.width || 800, h = meta.height || 800;
  const short = Math.min(w, h);
  const fontSize = short * FONT_SIZE;
  // Too small for lettering to be drawn legibly: left as it is.
  if (fontSize < 7) return sharp(image, { limitInputPixels: 60_000_000 });

  const mark = await sharp(Buffer.from(textWatermarkSvg(WATERMARK_TEXT, fontSize)!))
    .rotate(ANGLE, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const { width: mw = 1, height: mh = 1 } = await sharp(mark).metadata();

  // Repeats near the edges run off the photo; they are drawn on a canvas with
  // room around it and the photo-sized middle is cut out afterwards.
  const m = Math.max(mw, mh);
  const layers: OverlayOptions[] = places(w, h, short * SPACING)
    .map(({ cx, cy }) => ({ input: mark, left: Math.round(cx - mw / 2 + m), top: Math.round(cy - mh / 2 + m) }));
  const overlay = await sharp({ create: { width: w + 2 * m, height: h + 2 * m, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers).png().toBuffer();
  const cut = await sharp(overlay).extract({ left: m, top: m, width: w, height: h }).png().toBuffer();

  const { data, info } = await sharp(image, { limitInputPixels: 60_000_000 })
    .composite([{ input: cut }]).raw().toBuffer({ resolveWithObject: true });
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
}
