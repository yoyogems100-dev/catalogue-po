import { sentOf } from '@/lib/line-fulfilment';
import { redirect, notFound } from 'next/navigation';
import { getQuantityFields } from '@/lib/quantity-fields-server';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buyerPaymentStatus, paymentStatusLabel } from '@/lib/payment-status';
import { stagesForOrder } from '@/lib/order-stages-server';
import { canOrderForOthers, getCustomerSession } from '@/lib/customer-auth';
import { isAdminAuthed } from '@/lib/auth';
import { OrderOnAnotherAccount, SwitchToOrderBuyer } from './WrongAccount';
import AccountHeader from '@/components/AccountHeader';
import BreadcrumbHome from '@/components/BreadcrumbHome';
import OrderStepper, { milestoneLabel } from '@/components/OrderStepper';
import { milestoneIndex } from '@/lib/order-milestones';
import OrderDetailClient from './OrderDetailClient';
import { ANY_CATEGORY_ID, ANY_CATEGORY_NAME } from '@/lib/cart-storage';

export default async function AccountOrderDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const session = await getCustomerSession();
  const customerId = session?.customerId ?? null;
  // Back to this order after signing in -- the WhatsApp updates link here.
  if (!customerId) redirect(`/po/account/login?next=${encodeURIComponent(`/po/account/orders/${params.id}`)}`);
  const orderId = Number(params.id);
  const stages = await stagesForOrder(orderId);

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_status, created_at, comment, customer_id, pdf_url')
    .eq('id', orderId)
    .single();

  if (!order) notFound();
  if (order.customer_id !== customerId) {
    return <OrderForAnotherAccount orderId={order.id} ownerId={order.customer_id} actorId={session!.actorId} />;
  }

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [{ data: cats }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name, slug').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url').in('id', colorIds) : Promise.resolve({ data: [] })
  ]);

  const catMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.name]));
  const catSlugMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.slug]));
  const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, { name: string; hex: string | null; refPhotoUrl: string | null }> = Object.fromEntries(
    (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url }])
  );

  const fieldOf = await getQuantityFields();

  const itemsFormatted = (items || []).map((it: any) => ({
    id: it.id,
    categoryId: it.category_id ?? ANY_CATEGORY_ID,
    categoryName: it.category_id == null ? ANY_CATEGORY_NAME : catMap[it.category_id] || '—',
    categorySlug: catSlugMap[it.category_id] || '',
    shapeId: it.shape_id,
    shapeName: shapeMap[it.shape_id] || '—',
    sizeId: it.shape_size_id,
    sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
    colorId: it.color_id,
    colorName: colorMap[it.color_id]?.name || '—',
    colorHex: colorMap[it.color_id]?.hex || '#ccc',
    colorRefPhotoUrl: colorMap[it.color_id]?.refPhotoUrl || null,
    orderSpecs: it.order_specs || null,
    sentQty: sentOf(it),
    note: it.note || null,
    quantity: it.quantity,
    qtyUnit: fieldOf(it.category_id).unit,
    requestType: it.request_type || 'Place Order',
    unitPrice: it.unit_price != null ? Number(it.unit_price) : null
  }));

  // Editable any time before the order actually ships -- placed, confirmed,
  // sourcing, quality_check, packed all qualify, not just the first two.
  const canEdit = milestoneIndex(order.status) >= 0 && milestoneIndex(order.status) < milestoneIndex('shipped');

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
    ...(history || []).map((h: any) => ({ type: 'status' as const, at: h.changed_at, label: milestoneLabel(h.status, stages) })),
    ...(notes || []).map((n: any) => ({ type: 'note' as const, at: n.created_at, author: n.author_type, message: n.message }))
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav" aria-label="Breadcrumb">
          <BreadcrumbHome />
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/po/account/orders">My Orders</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current" aria-current="page">Order #{order.id}</span>
        </nav>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 16px' }}>Order #{order.id}</h1>

        <div className="po-card" style={{ marginBottom: 20 }}>
          <OrderStepper status={order.status} stages={stages} />
        </div>

        {order.comment && <p><strong>Order description:</strong> {order.comment}</p>}
        {buyerPaymentStatus(order.payment_status) && <p>Payment: {paymentStatusLabel(order.payment_status)}</p>}
        {order.pdf_url && <p><a className="btn-ghost" href={order.pdf_url} target="_blank" rel="noopener noreferrer">Download latest order PDF</a></p>}
        {order.status === 'placed' && <p>Our team will confirm pricing and availability.</p>}

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

// The order exists but belongs to someone other than the account in use -- most
// often a WhatsApp order link opened on a phone signed in as another buyer.
// Never names the order's buyer to someone who could not switch to them anyway.
async function OrderForAnotherAccount({ orderId, ownerId, actorId }: { orderId: number; ownerId: number | null; actorId: number }) {
  let body;
  if (ownerId && (ownerId === actorId || (await canOrderForOthers(actorId)))) {
    // Their own order while switched to a buyer, or a buyer they may order for.
    const { data: owner } = ownerId === actorId
      ? { data: { name: 'your own account' } }
      : await supabaseAdmin.from('customers').select('name, phone').eq('id', ownerId).is('deleted_at', null).maybeSingle();
    if (owner) body = <SwitchToOrderBuyer buyerId={ownerId} buyerName={(owner as any).name || (owner as any).phone || 'this buyer'} />;
  }
  if (!body) {
    const [{ data: me }, admin] = await Promise.all([
      supabaseAdmin.from('customers').select('name, phone').eq('id', actorId).maybeSingle(),
      isAdminAuthed()
    ]);
    const signedInAs = [me?.name, me?.phone].filter(Boolean).join(' · ') || 'another account';
    body = <OrderOnAnotherAccount orderId={orderId} signedInAs={signedInAs} adminHref={admin ? `/admin/orders/${orderId}` : null} />;
  }
  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 16px' }}>Order #{orderId}</h1>
        {body}
      </div>
    </>
  );
}
