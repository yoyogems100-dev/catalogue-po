import path from 'node:path';
import { openSync } from 'fontkit';
import sharp from 'sharp';

/**
 * Turns watermark text into an SVG of glyph OUTLINES -- no font-family, no
 * text element, nothing for the renderer to look up.
 *
 * sharp draws SVG through librsvg, which resolves font-family through
 * fontconfig. That works on this Mac, which has fonts installed, and is a
 * coin toss inside a serverless Linux function, which may have none: the text
 * would come out in a fallback face or not at all, and only in production.
 * Converting to paths here makes the watermark byte-identical everywhere.
 *
 * The face is Playfair Display, the same one the site sets its headings in
 * (assets/fonts, SIL OFL, licence alongside it).
 */

const FONT_PATH = path.join(process.cwd(), 'assets/fonts/PlayfairDisplay-Variable.ttf');

let cached: any = null;
function font() {
  // Parsing the file is the slow part and it never changes, so a watermark
  // applied across a selection of forty photos parses it once.
  if (!cached) {
    const file: any = openSync(FONT_PATH);
    cached = typeof file.getVariation === 'function' ? file.getVariation({ wght: 700 }) : file;
  }
  return cached;
}

export type TextWatermark = { text: string; color: string };

/** A hex colour, or '#ffffff' -- never interpolate unchecked text into SVG. */
export function safeColor(value: string | null | undefined): string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff';
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${height}" viewBox="0 0 ${Math.round(width)} ${height}"><path transform="${transform}" d="${d}" fill="${safeColor(color)}"/></svg>`;
}

/** The share of the photo's width a watermark covers. */
export const WATERMARK_WIDTH_RATIO = 0.4;

export type WatermarkRow = {
  text?: string | null;
  color?: string | null;
  storage_path?: string | null;
  opacity: number | string;
};

/**
 * The finished overlay for one photo: sized to the photo, already faded.
 * Both the live preview and the real apply go through here, so the sample the
 * owner adjusts is the same picture they get.
 */
export async function watermarkOverlay(
  watermark: WatermarkRow,
  imageBuffer: Buffer | null,
  photoWidth: number
): Promise<Buffer> {
  const targetWidth = Math.max(40, Math.round(photoWidth * WATERMARK_WIDTH_RATIO));

  let layer: Buffer;
  if (watermark.text && watermark.text.trim()) {
    const svg = textWatermarkSvg(watermark.text, targetWidth, safeColor(watermark.color));
    if (!svg) throw new Error('That watermark text has nothing to draw.');
    layer = await sharp(Buffer.from(svg)).png().toBuffer();
  } else {
    if (!imageBuffer) throw new Error('Watermark image could not be loaded.');
    layer = await sharp(imageBuffer).resize({ width: targetWidth, withoutEnlargement: false }).png().toBuffer();
  }

  // sharp's composite() has no opacity option, and ensureAlpha() only fills in
  // a MISSING alpha channel rather than scaling one that is already there.
  const opacity = Math.min(1, Math.max(0.05, Number(watermark.opacity) || 0.5));
  const { data, info } = await sharp(layer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}
