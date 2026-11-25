import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { catalogueChanged } from '@/lib/catalogue-cache';
import { MAX_COURIER_NAME } from '@/lib/couriers';

// Admin only: the order's courier and whether it ships straight from Jaipur
// stock. Buyers can't set either; they only see the resulting stage names.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: 'Invalid order' }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if ('fromJaipur' in body) {
    if (typeof body.fromJaipur !== 'boolean') return NextResponse.json({ error: 'Invalid dispatch choice' }, { status: 400 });
    patch.dispatch_from_jaipur = body.fromJaipur;
  }
  if ('courier' in body) {
    if (body.courier != null && typeof body.courier !== 'string') return NextResponse.json({ error: 'Invalid courier' }, { status: 400 });
    const name = (body.courier || '').replace(/\s+/g, ' ').trim().slice(0, MAX_COURIER_NAME);
    patch.courier = name || null;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  catalogueChanged();
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('id')
    .maybeSingle();
  if (error) {
    const missing = /dispatch_from_jaipur|courier/.test(error.message);
    return NextResponse.json({ error: missing ? 'Courier and Jaipur dispatch need a database update first.' : error.message }, { status: 400 });
  }
  if (!data) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
