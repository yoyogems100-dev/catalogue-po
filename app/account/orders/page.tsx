import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import AccountHeader from '@/components/AccountHeader';
import OrderStepper from '@/components/OrderStepper';
import ProfileGate from './ProfileGate';
import RepeatOrderButton from './RepeatOrderButton';

export default async function AccountOrdersPage() {
  const customerId = getCustomerId();
  if (!customerId) redirect('/account/login');

  const { data: customer } = await supabaseAdmin.from('customers').select('name').eq('id', customerId).maybeSingle();
  if (!customer?.name) {
    return (
      <>
        <AccountHeader />
        <div className="container" style={{ padding: '28px 20px 80px' }}>
          <ProfileGate />
        </div>
      </>
    );
  }

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, created_at, payment_status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const orderIds = (orders || []).map((o) => o.id);
  const { data: items } = orderIds.length
    ? await supabaseAdmin
        .from('order_items')
        .select('order_id, category_id, shape_id, shape_size_id, custom_size, color_id, quantity, request_type')
        .in('order_id', orderIds)
    : { data: [] };

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [{ data: catRows }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value').in('id', colorIds) : Promise.resolve({ data: [] })
  ]);

  const catMap: Record<number, string> = Object.fromEntries((catRows || []).map((c: any) => [c.id, c.name]));
  const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, { name: string; hex: string | null }> = Object.fromEntries(
    (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value }])
  );

  const statsByOrder: Record<number, { lines: number; pieces: number }> = {};
  const itemsByOrder: Record<number, any[]> = {};
  (items || []).forEach((it: any) => {
    if (!statsByOrder[it.order_id]) statsByOrder[it.order_id] = { lines: 0, pieces: 0 };
    statsByOrder[it.order_id].lines += 1;
    statsByOrder[it.order_id].pieces += it.quantity;

    if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
    itemsByOrder[it.order_id].push({
      categoryId: it.category_id,
      categoryName: catMap[it.category_id] || '—',
      shapeId: it.shape_id,
      shapeName: shapeMap[it.shape_id] || '—',
      sizeId: it.shape_size_id,
      sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
      colorId: it.color_id,
      colorName: colorMap[it.color_id]?.name || '—',
      colorHex: colorMap[it.color_id]?.hex || '#ccc',
      quantity: it.quantity,
      requestType: it.request_type || 'Place Order'
    });
  });

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav">
          <Link href="/">&#127968; Home</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">My Orders</span>
        </nav>
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
                    <RepeatOrderButton orderId={o.id} items={itemsByOrder[o.id] || []} />
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
