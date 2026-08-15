import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const VALID = ['pending', 'partial', 'paid'];

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { paymentStatus } = await req.json();
  if (!VALID.includes(paymentStatus)) {
    return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
