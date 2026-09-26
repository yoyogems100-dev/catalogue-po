import { NextRequest, NextResponse } from 'next/server';
import { fail, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';
import { listRevisions, publish, restoreRevision, saveDraft, type Entity } from '@/lib/site/content-store';

// Draft autosave, publish, and undo history for pages and category pages.

function target(entity: unknown, key: unknown): { entity: Entity; key: string } | null {
  if ((entity !== 'page' && entity !== 'category') || typeof key !== 'string' || !key) return null;
  return { entity, key };
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const t = target(req.nextUrl.searchParams.get('entity'), req.nextUrl.searchParams.get('key'));
  if (!t) return fail('Unknown page.');
  return NextResponse.json({ revisions: await listRevisions(t.entity, t.key) });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await readJson(req);
  const t = target(body?.entity, body?.key);
  if (!t) return fail('Unknown page.');
  const result = await saveDraft(t.entity, t.key, body!.draft);
  if ('error' in result) return fail(result.error!);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await readJson(req);
  const t = target(body?.entity, body?.key);
  if (!t) return fail('Unknown page.');
  if (body!.action === 'publish') {
    const result = await publish(t.entity, t.key);
    if ('error' in result) return fail(result.error!);
    refreshPublicSite();
    return NextResponse.json(result);
  }
  if (body!.action === 'restore') {
    const id = Number(body!.revision_id);
    if (!Number.isSafeInteger(id)) return fail('Choose a version to restore.');
    const result = await restoreRevision(t.entity, t.key, id);
    if ('error' in result) return fail(result.error!);
    return NextResponse.json(result);
  }
  return fail('Unknown action.');
}
