import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { catalogueChanged } from '@/lib/catalogue-cache';
import { isPaymentStatus, isNaNotSupportedError } from '@/lib/payment-status';

export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  catalogueChanged();

  const orderId = Number(params.id);
  const { paymentStatus } = await req.json();
  if (!isPaymentStatus(paymentStatus)) {
    return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ payment_status: paymentStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) {
    // Database not migrated yet: the old check constraint only knows pending/partial/paid.
    if (isNaNotSupportedError(error.message)) {
      return NextResponse.json({ error: 'N/A needs a one-time database update first. Pending, Partially paid and Paid still work.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
