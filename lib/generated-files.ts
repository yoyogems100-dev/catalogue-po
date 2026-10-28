import { createHash } from 'node:crypto';

// Files the server would otherwise rebuild on every download (the Moissanite
// size-chart PDF: a dozen images re-encoded and a PDF laid out each time).
// Built once per version of their source data, kept in the public `photos`
// bucket under generated/, and handed out from Supabase's CDN.
//
// The name carries a hash of everything the file is made from, so a changed
// source simply gets a new file; nothing is ever overwritten or served stale,
// and the stored copy can be cached for a year. Only for files that are safe
// to be public -- never prices or anything admin-only.

const BUCKET = 'photos';
const known = new Set<string>(); // paths this instance already knows exist

export function generatedPath(prefix: string, source: unknown, ext: string): string {
  const hash = createHash('sha256').update(JSON.stringify(source)).digest('hex').slice(0, 16);
  return `generated/${prefix}-${hash}.${ext}`;
}

export function publicFileUrl(path: string, downloadName?: string): string {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return downloadName ? `${url}?download=${encodeURIComponent(downloadName)}` : url;
}

async function exists(path: string): Promise<boolean> {
  if (known.has(path)) return true;
  try {
    const res = await fetch(publicFileUrl(path), { method: 'HEAD', cache: 'no-store' });
    if (res.ok) known.add(path);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The stored copy's URL, building and storing it first if this version has
 * never been made. If storing fails (e.g. no service key locally), the freshly
 * built bytes come back instead so the caller can still answer.
 */
export async function storedFile(path: string, contentType: string, build: () => Promise<Buffer>): Promise<{ stored: true } | { stored: false; bytes: Buffer }> {
  if (await exists(path)) return { stored: true };
  const bytes = await build();
  // Loaded here so the path helpers above work without a database key.
  const { supabaseAdmin } = await import('./supabase-admin');
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType, cacheControl: '31536000', upsert: true });
  if (error) return { stored: false, bytes };
  known.add(path);
  return { stored: true };
}
