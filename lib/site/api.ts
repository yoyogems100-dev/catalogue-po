import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';

// Small shared helpers for the /api/admin/site/* routes.

export async function requireAdmin(): Promise<NextResponse | null> {
  return (await isAdminAuthed()) ? null : NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson(req: Request): Promise<Record<string, any> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export function positiveId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function idArray(raw: unknown, max = 500): number[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null;
  const ids = raw.map(positiveId);
  return ids.every((n): n is number => n !== null) ? [...new Set(ids)] : null;
}

export function slugify(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** The public site is statically cached; refresh all of it after a change. */
export function refreshPublicSite() {
  revalidateTag('site', { expire: 0 });
  revalidatePath('/', 'layout');
}
