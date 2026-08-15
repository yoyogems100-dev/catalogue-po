import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import AccountHeader from '@/components/AccountHeader';
import OrderStepper from '@/components/OrderStepper';

export default async function AccountOrdersPage() {
  const customerId = getCustomerId();
  if (!customerId) redirect('/account/login');

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, created_at, payment_status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const orderIds = (orders || []).map((o) => o.id);
  const { data: items } = orderIds.length
    ? await supabaseAdmin.from('order_items').select('order_id, quantity').in('order_id', orderIds)
    : { data: [] };

  const statsByOrder: Record<number, { lines: number; pieces: number }> = {};
  (items || []).forEach((it: any) => {
    if (!statsByOrder[it.order_id]) statsByOrder[it.order_id] = { lines: 0, pieces: 0 };
    statsByOrder[it.order_id].lines += 1;
    statsByOrder[it.order_id].pieces += it.quantity;
  });

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', marginBottom: 18 }}>My Orders</h1>

        {(orders || []).length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#8a8370', border: '1px dashed var(--line)' }}>
            You haven't placed any orders yet. <Link href="/" style={{ color: 'var(--navy)' }}>Browse the catalogue &rarr;</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(orders || []).map((o) => {
              const stats = statsByOrder[o.id] || { lines: 0, pieces: 0 };
              return (
                <Link key={o.id} href={`/account/orders/${o.id}`} className="account-order-row card">
                  <div className="account-order-row-top">
                    <span className="account-order-id">Order #{o.id}</span>
                    <span className="account-order-date">
                      {new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <OrderStepper status={o.status} compact />
                  <div className="account-order-row-bottom">
                    <span>{stats.lines} line{stats.lines !== 1 ? 's' : ''} · {stats.pieces.toLocaleString('en-IN')} pcs</span>
                    <span className={`payment-badge payment-${o.payment_status}`}>{o.payment_status}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
