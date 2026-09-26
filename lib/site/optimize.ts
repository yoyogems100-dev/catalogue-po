// Serve catalogue and reference pictures through Next's image optimiser
// (/_next/image): resized to what the phone actually shows and sent as WebP.
// The shape, colour and catalogue photos are stored full size (a Moissanite
// shape PNG is ~550 KB but shown at 64px), so without this a chart page
// downloads megabytes. Website images uploaded under Admin → Images already
// come in stored sizes and are left alone. Client-safe, pure.

// Must be widths from next.config's imageSizes/deviceSizes (Next's defaults).
const WIDTHS = [32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920];
const QUALITY = 75; // the only quality Next 16 allows by default

const SUPABASE = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\//;
const DRIVE = /^https:\/\/lh3\.googleusercontent\.com\//;

export function canOptimize(src: string | null | undefined): src is string {
  if (!src) return false;
  if (/\.svg($|\?)/i.test(src)) return false;
  if (src.startsWith('/')) return !src.startsWith('/_next/') && !src.startsWith('/api/') && !src.startsWith('//');
  return SUPABASE.test(src) || DRIVE.test(src);
}

const widthFor = (px: number) => WIDTHS.find((w) => w >= px) ?? WIDTHS[WIDTHS.length - 1];

export function optimized(src: string, width: number): string {
  return canOptimize(src) ? `/_next/image?url=${encodeURIComponent(src)}&w=${widthFor(width)}&q=${QUALITY}` : src;
}

/** A small fixed-size picture (swatch, shape icon): sharp on 1x and 2x screens. */
export function thumb(src: string, cssPx: number): { src: string; srcSet?: string } {
  if (!canOptimize(src)) return { src };
  const one = optimized(src, cssPx);
  const two = optimized(src, cssPx * 2);
  return one === two ? { src: one } : { src: one, srcSet: `${one} 1x, ${two} 2x` };
}

/** A photo that fills a column: let the browser pick the width it needs. */
export function responsive(src: string, widths: number[] = [256, 384, 640, 828, 1080]): { src: string; srcSet?: string } {
  if (!canOptimize(src)) return { src };
  return { src: optimized(src, 640), srcSet: [...new Set(widths.map(widthFor))].map((w) => `${optimized(src, w)} ${w}w`).join(', ') };
}

/** An image object from the data layer: keep its stored sizes, else optimise. */
export function pic(image: { src: string; srcSet?: string }): { src: string; srcSet?: string } {
  return image.srcSet ? { src: image.src, srcSet: image.srcSet } : responsive(image.src);
}
