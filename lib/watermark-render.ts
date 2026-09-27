import path from 'node:path';
import { openSync } from 'fontkit';
import sharp, { type Sharp } from 'sharp';

/**
 * The YOYO GEMS watermark every photo on the site and /po carries.
 *
 * It is applied once, when a photo is stored -- never on the fly -- to a
 * separate copy: the original upload is kept untouched (photos.original_path,
 * site_media.original_path), and every crop or resize is rebuilt from that
 * original, so a photo can never end up watermarked twice.
 *
 * The mark sits small in the bottom-right corner, away from the stone, which
 * product photos almost always centre. White lettering over a soft dark halo
 * keeps it readable on the white backdrops most stone photos use and on dark
 * ones alike, without a box or band over the picture.
 */

export const WATERMARK_TEXT = 'YOYO GEMS';

/** Share of the photo's width the lettering covers. */
const WIDTH_RATIO = 0.24;
/** Gap from the bottom and right edges, as a share of the shorter side. */
const MARGIN_RATIO = 0.035;
/**
 * Two looks, chosen per photo from how bright the corner is: brand navy over a
 * faint white halo on light backdrops, white over a dark halo on dark ones.
 * A single colour disappears on one or the other.
 */
const LOOKS = {
  light: { text: '#1B3A6B', textOpacity: 0.62, halo: '#ffffff', haloOpacity: 0.7 },
  dark: { text: '#ffffff', textOpacity: 0.82, halo: '#000000', haloOpacity: 0.5 }
} as const;
export type WatermarkLook = keyof typeof LOOKS;
/** Mean corner luminance (0-255) above which a backdrop counts as light. */
const LIGHT_CORNER = 150;

/*
 * Text becomes an SVG of glyph OUTLINES -- no font-family, no text element,
 * nothing for the renderer to look up. sharp draws SVG through librsvg, which
 * resolves font-family through fontconfig: fine on a Mac with fonts, a coin
 * toss inside a serverless Linux function with none. Outlines make the mark
 * byte-identical everywhere. The face is Playfair Display, the site's heading
 * font (assets/fonts, SIL OFL, licence alongside it; traced in next.config.js).
 */
const FONT_PATH = path.join(process.cwd(), 'assets/fonts/PlayfairDisplay-Variable.ttf');

let cachedFont: any = null;
function font() {
  // Parsing the file is the slow part and it never changes, so a backfill
  // across hundreds of photos parses it once.
  if (!cachedFont) {
    const file: any = openSync(FONT_PATH);
    cachedFont = typeof file.getVariation === 'function' ? file.getVariation({ wght: 700 }) : file;
  }
  return cachedFont;
}

/**
 * @param width the SVG's width in pixels; the height follows from the text.
 * @returns an SVG string, or null when the text has no drawable glyphs.
 */
export function textWatermarkSvg(text: string, width: number, color: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const run = font().layout(trimmed);
  const { minX, minY, maxX, maxY } = run.bbox;
  const inkW = maxX - minX, inkH = maxY - minY;
  if (!(inkW > 0) || !(inkH > 0)) return null;

  let d = '', pen = 0;
  run.glyphs.forEach((glyph: any, i: number) => {
    d += glyph.path.translate(pen, 0).toSVG();
    pen += run.positions[i].xAdvance;
  });

  const scale = width / inkW;
  const height = Math.max(1, Math.round(inkH * scale));
  // Font outlines are y-up and start wherever the first glyph's bearing puts
  // them; SVG is y-down from the top left. This flips and shifts the whole
  // run so its ink exactly fills the box.
  const transform = `translate(${-minX * scale} ${maxY * scale}) scale(${scale} ${-scale})`;
  const fill = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${height}" viewBox="0 0 ${Math.round(width)} ${height}"><path transform="${transform}" d="${d}" fill="${fill}"/></svg>`;
}

/** Scales every pixel's alpha. sharp's composite() has no opacity option. */
async function fade(png: Buffer, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** The finished mark for a photo `photoWidth` wide: lettering over its halo, with room for the blur. */
export async function watermarkOverlay(photoWidth: number, look: WatermarkLook = 'dark'): Promise<{ input: Buffer; width: number; height: number; pad: number }> {
  const style = LOOKS[look];
  const textWidth = Math.max(60, Math.round(photoWidth * WIDTH_RATIO));
  const white = textWatermarkSvg(WATERMARK_TEXT, textWidth, style.text)!;
  const dark = textWatermarkSvg(WATERMARK_TEXT, textWidth, style.halo)!;
  const pad = Math.max(3, Math.round(textWidth * 0.06));
  const sigma = Math.max(0.8, textWidth * 0.014);
  const extend = { top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } };

  const halo = await fade(await sharp(Buffer.from(dark)).extend(extend).blur(sigma).png().toBuffer(), style.haloOpacity);
  const text = await fade(await sharp(Buffer.from(white)).extend(extend).png().toBuffer(), style.textOpacity);
  const { width = textWidth, height = 1 } = await sharp(text).metadata();
  const input = await sharp(halo).composite([{ input: text }]).png().toBuffer();
  return { input, width, height, pad };
}

/** Average brightness of one region of an image, 0 (black) to 255 (white). */
async function cornerLuminance(image: Buffer, region: { left: number; top: number; width: number; height: number }): Promise<number> {
  const { channels } = await sharp(image, { limitInputPixels: 60_000_000 }).extract(region).removeAlpha().stats();
  const [r, g, b] = channels.map((c) => c.mean);
  return g === undefined ? r : 0.2126 * r + 0.7152 * g + 0.0722 * (b ?? g);
}

/**
 * The photo with the mark in its bottom-right corner, as a sharp pipeline so
 * the caller chooses the size and output format. `image` must already be
 * upright (rotated) and cropped -- the mark goes on exactly what will be shown.
 *
 * The composite is flattened to raw pixels before it is handed back: sharp
 * always resizes BEFORE it composites, whatever order the calls are chained
 * in, so a caller's .resize() on an unflattened pipeline would shrink the
 * photo and then place the mark at full-size coordinates, off the picture.
 */
export async function withWatermark(image: Buffer): Promise<Sharp> {
  const meta = await sharp(image, { limitInputPixels: 60_000_000 }).metadata();
  const width = meta.width || 800, height = meta.height || 800;
  // Measured at the dark look's size -- both looks are the same size -- then
  // the look is chosen from the patch of photo the mark will cover.
  let mark = await watermarkOverlay(width);
  // A sliver of an image too small to hold the mark is left as it is.
  if (mark.width > width || mark.height > height) return sharp(image, { limitInputPixels: 60_000_000 });
  const margin = Math.round(Math.min(width, height) * MARGIN_RATIO);
  // The padding around the lettering is transparent, so it may run into the
  // margin; the lettering itself sits `margin` in from the edges.
  const left = Math.min(width - mark.width, Math.max(0, width - margin - mark.width + mark.pad));
  const top = Math.min(height - mark.height, Math.max(0, height - margin - mark.height + mark.pad));
  if ((await cornerLuminance(image, { left, top, width: mark.width, height: mark.height })) > LIGHT_CORNER) {
    mark = await watermarkOverlay(width, 'light');
  }
  const { data, info } = await sharp(image, { limitInputPixels: 60_000_000 })
    .composite([{ input: mark.input, left, top }]).raw().toBuffer({ resolveWithObject: true });
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
}
