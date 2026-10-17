import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Thumbnails of files under /public, for PDFs. react-pdf can't read WebP, so
// each photo is re-encoded once (and kept for the life of the server) as a
// high-quality JPEG on white, sized for crisp print: `size` px across a
// ~20pt tile is well over 300 dpi. The whole photo is kept (centred in the
// square), so every stone prints at the same size and none loses its sides.
const cache = new Map<string, Promise<string | null>>();

export function publicThumbDataUrl(source: string | null | undefined, size = 240): Promise<string | null> {
  if (!source || !source.startsWith('/')) return Promise.resolve(null);
  const key = `${size}:${source}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = (async () => {
      try {
        const publicRoot = path.resolve(process.cwd(), 'public');
        const filePath = path.resolve(publicRoot, source.slice(1));
        if (!filePath.startsWith(publicRoot + path.sep)) return null;
        const jpg = await sharp(await readFile(filePath))
          .resize(size, size, { fit: 'contain', background: '#ffffff', withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
          .toBuffer();
        return `data:image/jpeg;base64,${jpg.toString('base64')}`;
      } catch {
        return null;
      }
    })();
    cache.set(key, hit);
  }
  return hit;
}
