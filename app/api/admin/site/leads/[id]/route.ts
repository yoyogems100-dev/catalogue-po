import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, positiveId, readJson, requireAdmin } from '@/lib/site/api';
import { LEAD_STATUSES, LIMITS } from '@/lib/site/leads';

type Context = { params: Promise<{ id: string }> };

/** Change a catalogue request's status or its internal notes. */
export async function PATCH(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  if (!id || !body) return fail('Invalid request.');
  const patch: Record<string, unknown> = {};
  if ('status' in body) {
    if (!LEAD_STATUSES.includes(body.status)) return fail('Unknown status.');
    patch.status = body.status;
  }
  if ('notes' in body) patch.notes = typeof body.notes === 'string' ? body.notes.slice(0, LIMITS.notes) : '';
  if (!Object.keys(patch).length) return fail('Nothing to change.');
  patch.updated_at = new Date().toISOString();
  const { data, error } = await supabaseAdmin.from('site_leads').update(patch).eq('id', id).select('id, status, notes, updated_at').maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail('This request no longer exists.', 404);
  return NextResponse.json({ lead: data });
}

/** Remove a request (spam, test or duplicate). */
export async function DELETE(_req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { error } = await supabaseAdmin.from('site_leads').delete().eq('id', id);
  if (error) return fail(error.message, 500);
  return NextResponse.json({ ok: true });
}
