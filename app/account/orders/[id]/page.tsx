import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import AccountHeader from '@/components/AccountHeader';
import OrderStepper, { milestoneLabel } from '@/components/OrderStepper';
import OrderDetailClient from './OrderDetailClient';

export default async function AccountOrderDetailPage({ params }: { params: { id: string } }) {
  const customerId = getCustomerId();
  if (!customerId) redirect('/account/login');

  const orderId = Number(params.id);

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_status, created_at, comment, customer_id')
    .eq('id', orderId)
    .single();

  if (!order || order.customer_id !== customerId) {
    notFound();
  }

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('id, category_id, shape_id, shape_size_id, custom_size, color_id, quantity, request_type')
    .eq('order_id', orderId);

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [{ data: cats }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name, slug').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value').in('id', colorIds) : Promise.resolve({ data: [] })
  ]);

  const catMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.name]));
  const catSlugMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.slug]));
  const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, { name: string; hex: string | null }> = Object.fromEntries(
    (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value }])
  );

  const itemsFormatted = (items || []).map((it: any) => ({
    id: it.id,
    categoryId: it.category_id,
    categoryName: catMap[it.category_id] || '—',
    categorySlug: catSlugMap[it.category_id] || '',
    shapeId: it.shape_id,
    shapeName: shapeMap[it.shape_id] || '—',
    sizeId: it.shape_size_id,
    sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
    colorId: it.color_id,
    colorName: colorMap[it.color_id]?.name || '—',
    colorHex: colorMap[it.color_id]?.hex || '#ccc',
    quantity: it.quantity,
    requestType: it.request_type || 'Place Order'
  }));

  const canEdit = order.status === 'placed' || order.status === 'confirmed';

  // "Add to order" can pull in any category, not just ones already on this
  // order -- shape/color/size options for whichever category gets picked are
  // fetched on demand client-side via /api/app/categories/[slug], same as
  // Quick Order's builder did.
  const { data: allCategoriesRaw } = canEdit
    ? await supabaseAdmin.from('categories').select('id, name, slug').order('num')
    : { data: [] };
  const allCategories = (allCategoriesRaw || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }));

  const { data: history } = await supabaseAdmin
    .from('order_status_history')
    .select('id, status, changed_at')
    .eq('order_id', orderId)
    .order('changed_at', { ascending: true });

  const { data: notes } = await supabaseAdmin
    .from('order_notes')
    .select('id, author_type, message, created_at')
    .eq('order_id', orderId)
    .eq('internal_only', false)
    .order('created_at', { ascending: true });

  const timeline = [
    ...(history || []).map((h: any) => ({ type: 'status' as const, at: h.changed_at, label: milestoneLabel(h.status) })),
    ...(notes || []).map((n: any) => ({ type: 'note' as const, at: n.created_at, author: n.author_type, message: n.message }))
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav">
          <Link href="/">&#127968; Home</Link>
          <span className="breadcrumb-sep">/</span>
          <Link href="/account/orders">My Orders</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Order #{order.id}</span>
        </nav>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 16px' }}>Order #{order.id}</h1>

        <div className="po-card" style={{ marginBottom: 20 }}>
          <OrderStepper status={order.status} />
        </div>

        <OrderDetailClient
          orderId={order.id}
          status={order.status}
          canEdit={canEdit}
          items={itemsFormatted}
          allCategories={allCategories}
          timeline={timeline}
        />
      </div>
    </>
  );
}
