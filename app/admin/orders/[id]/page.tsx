import { supabaseAdmin } from '@/lib/supabase-admin';
import Link from 'next/link';
import OrderAdminClient from './OrderAdminClient';

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const orderId = Number(params.id);

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_status, created_at, comment, request_type, contact_name, customer_id, whatsapp_message, pdf_url')
    .eq('id', orderId)
    .single();

  if (!order) {
    return <p>Order not found. <Link href="/admin/orders">&larr; Back</Link></p>;
  }

  const { data: customer } = order.customer_id
    ? await supabaseAdmin.from('customers').select('id, name, phone, email, phone_verified, company').eq('id', order.customer_id).single()
    : { data: null };

  const { data: customerOrderHistory } = customer
    ? await supabaseAdmin
        .from('orders')
        .select('id, status, created_at')
        .eq('customer_id', customer.id)
        .neq('id', orderId)
        .order('created_at', { ascending: false })
    : { data: [] };

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('id, category_id, shape_id, shape_size_id, custom_size, color_id, quantity, unit_price, request_type')
    .eq('order_id', orderId);

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [{ data: cats }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value').in('id', colorIds) : Promise.resolve({ data: [] })
  ]);

  const catMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.name]));
  const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, { name: string; hex: string | null }> = Object.fromEntries(
    (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value }])
  );

  const itemsFormatted = (items || []).map((it: any) => ({
    id: it.id,
    categoryId: it.category_id,
    categoryName: catMap[it.category_id] || '—',
    shapeName: shapeMap[it.shape_id] || '—',
    sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
    colorName: colorMap[it.color_id]?.name || '—',
    colorHex: colorMap[it.color_id]?.hex || '#ccc',
    quantity: it.quantity,
    unitPrice: it.unit_price != null ? Number(it.unit_price) : null,
    requestType: it.request_type || 'Place Order'
  }));

  // For editing: fetch each order category's linked shapes/sizes/colors, so admin
  // can add a new line within a category already on this order (offline/phone
  // requests) -- same pattern as the customer editor, but admin can always edit
  // regardless of status.
  let categoryOptions: Record<number, { shapes: { id: number; name: string }[]; colors: { id: number; name: string; hex: string | null }[]; sizes: { id: number; shapeId: number; sizeMm: string }[] }> = {};
  if (categoryIds.length > 0) {
    const [{ data: catShapes }, { data: catColors }, { data: catSizes }] = await Promise.all([
      supabaseAdmin.from('category_shapes').select('category_id, shape_id').in('category_id', categoryIds),
      supabaseAdmin.from('category_colors').select('category_id, color_id').in('category_id', categoryIds),
      supabaseAdmin.from('category_shape_sizes').select('category_id, shape_size_id').in('category_id', categoryIds)
    ]);

    const allShapeIds = [...new Set((catShapes || []).map((r: any) => r.shape_id))];
    const allColorIds = [...new Set((catColors || []).map((r: any) => r.color_id))];
    const allSizeIds = [...new Set((catSizes || []).map((r: any) => r.shape_size_id))];

    const [{ data: allShapes }, { data: allColors }, { data: allSizes }] = await Promise.all([
      allShapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', allShapeIds) : Promise.resolve({ data: [] }),
      allColorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value').in('id', allColorIds) : Promise.resolve({ data: [] }),
      allSizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm').in('id', allSizeIds) : Promise.resolve({ data: [] })
    ]);

    const shapeById = Object.fromEntries((allShapes || []).map((s: any) => [s.id, s]));
    const colorById = Object.fromEntries((allColors || []).map((c: any) => [c.id, c]));
    const sizeById = Object.fromEntries((allSizes || []).map((s: any) => [s.id, s]));

    categoryOptions = Object.fromEntries(
      categoryIds.map((cid: number) => [
        cid,
        {
          shapes: (catShapes || []).filter((r: any) => r.category_id === cid).map((r: any) => shapeById[r.shape_id]).filter(Boolean),
          colors: (catColors || [])
            .filter((r: any) => r.category_id === cid)
            .map((r: any) => colorById[r.color_id])
            .filter(Boolean)
            .map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value })),
          sizes: (catSizes || []).filter((r: any) => r.category_id === cid).map((r: any) => sizeById[r.shape_size_id]).filter(Boolean).map((s: any) => ({ id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm }))
        }
      ])
    );
  }

  const { data: history } = await supabaseAdmin
    .from('order_status_history')
    .select('id, status, changed_at, message_sent')
    .eq('order_id', orderId)
    .order('changed_at', { ascending: true });

  const { data: notes } = await supabaseAdmin
    .from('order_notes')
    .select('id, author_type, message, internal_only, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });

  return (
    <>
      <Link href="/admin/orders" style={{ fontSize: 13, color: 'var(--navy)' }}>&larr; All orders</Link>
      <h1 style={{ marginTop: 8 }}>Order #{order.id}</h1>
      <OrderAdminClient
        orderId={order.id}
        status={order.status}
        paymentStatus={order.payment_status}
        pdfUrl={order.pdf_url}
        createdAt={order.created_at}
        comment={order.comment}
        requestType={order.request_type}
        contactName={order.contact_name}
        customer={customer}
        customerOrderHistory={customerOrderHistory || []}
        items={itemsFormatted}
        categoryOptions={categoryOptions}
        history={history || []}
        notes={notes || []}
      />
    </>
  );
}
