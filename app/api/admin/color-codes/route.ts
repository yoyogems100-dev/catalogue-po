import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cleanAdminColorCode } from '@/lib/color-admin-codes';
import { catalogueChanged } from '@/lib/catalogue-cache';

// Sets or clears the owner's own code for one colour (admin only; see
// lib/color-admin-codes.ts). A blank code removes it.
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  catalogueChanged();
  const { colorId, code } = await req.json().catch(() => ({}));
  const id = Number(colorId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'colorId required' }, { status: 400 });
  const clean = cleanAdminColorCode(code);
  const { error } = clean
    ? await supabaseAdmin.from('color_admin_codes').upsert({ color_id: id, code: clean, updated_at: new Date().toISOString() })
    : await supabaseAdmin.from('color_admin_codes').delete().eq('color_id', id);
  if (error) {
    const message = error.code === '42P01' ? 'Colour codes are not set up yet -- the database update still needs to be applied.' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, code: clean });
}
