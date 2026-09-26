import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { preferencesFromBody } from '@/lib/customer-preferences';
import { sanitizeColorButtons } from '@/lib/color-family';

// One buyer's colour buttons (null = same as the shop) and the stone each
// colour opens for them. Only these two columns are written.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  const body = await request.json();
  const values: Record<string, unknown> = {};
  if ('colorButtons' in body) values.color_buttons = body.colorButtons === null ? null : sanitizeColorButtons(body.colorButtons) ?? null;
  const prefs = await preferencesFromBody(body.orderPreferences, supabaseAdmin);
  if (prefs) values.order_preferences = prefs;
  if (Object.keys(values).length === 0) return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('customers').update(values).eq('id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
