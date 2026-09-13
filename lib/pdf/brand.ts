import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const PDF_BRAND_TAGLINE = 'Premium Synthetic Gemstones. Infinite Choices. One Trusted Name.';

let cachedLogo: string | null = null;

export async function getPdfLogoDataUrl() {
  if (cachedLogo) return cachedLogo;
  const file = await readFile(path.join(process.cwd(), 'public', 'brand', 'yoyo-gems-pdf-wordmark.png'));
  cachedLogo = `data:image/png;base64,${file.toString('base64')}`;
  return cachedLogo;
}
