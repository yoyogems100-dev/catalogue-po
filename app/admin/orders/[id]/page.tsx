import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import Link from 'next/link';
import OrderAdminClient from './OrderAdminClient';

// See app/admin/categories/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const orderId = Number(params.id);

  // Everything that needs only the order id is read in one parallel round
  // trip; the customer and the item lookups follow in a second. This page
  // used to await nine queries one after another.
  const [
    { data: order },
    { data: items },
    { data: history },
    { data: notes },
    { data: suppliers },
    { data: supplierCategoryLinks }
  ] = await Promise.all([
    supabaseAdmin
      .from('orders')
      .select('id, status, payment_status, created_at, comment, request_type, contact_name, customer_id, whatsapp_message, pdf_url, invoice_url')
      .eq('id', orderId)
      .single(),
    supabaseAdmin.from('order_items').select('*').eq('order_id', orderId),
    supabaseAdmin
      .from('order_status_history')
      .select('id, status, changed_at, message_sent')
      .eq('order_id', orderId)
      .order('changed_at', { ascending: true }),
    supabaseAdmin
      .from('order_notes')
      .select('id, author_type, message, internal_only, created_at')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true }),
    supabaseAdmin.from('suppliers').select('id,name').order('name'),
    supabaseAdmin.from('supplier_categories').select('supplier_id,category_id')
  ]);

  if (!order) {
    return <p>Order not found. <Link href="/admin/orders">&larr; Back</Link></p>;
  }

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [
    { data: customer },
    { data: customerOrderHistoryRaw },
    { data: cats },
    { data: shapesData },
    { data: sizesData },
    { data: colorsData },
    { data: catShapes },
    { data: catColors },
    { data: catSizes }
  ] = await Promise.all([
    order.customer_id
      ? supabaseAdmin.from('customers').select('*').eq('id', order.customer_id).single()
      : Promise.resolve({ data: null }),
    order.customer_id
      ? supabaseAdmin
          .from('orders')
          .select('id, status, created_at')
          .eq('customer_id', order.customer_id)
          .neq('id', orderId)
          .order('created_at', { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] }),
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value').in('id', colorIds) : Promise.resolve({ data: [] }),
    // For the line editor below: each order category's linked options.
    categoryIds.length ? supabaseAdmin.from('category_shapes').select('category_id, shape_id').in('category_id', categoryIds) : Promise.resolve({ data: [] }),
    categoryIds.length ? supabaseAdmin.from('category_colors').select('category_id, color_id').in('category_id', categoryIds) : Promise.resolve({ data: [] }),
    categoryIds.length ? fetchAllRows<{ category_id: number; shape_size_id: number }>((from, to) => supabaseAdmin.from('category_shape_sizes').select('category_id, shape_size_id', { count: 'exact' }).in('category_id', categoryIds).order('category_id').order('shape_size_id').range(from, to)) : Promise.resolve({ data: [] })
  ]);
  // Only shown for a customer record that still exists, as before.
  const customerOrderHistory = customer ? customerOrderHistoryRaw : [];

  const catMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.name]));
  const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, { name: string; hex: string | null }> = Object.fromEntries(
    (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value }])
  );

  const suppliersFormatted = (suppliers || []).map((supplier: any) => ({
    ...supplier,
    categoryIds: (supplierCategoryLinks || []).filter((link: any) => link.supplier_id === supplier.id).map((link: any) => link.category_id),
  }));

  const itemsFormatted = (items || []).map((it: any) => ({
    id: it.id,
    categoryId: it.category_id,
    categoryName: catMap[it.category_id] || '—',
    shapeId: it.shape_id || null,
    shapeName: shapeMap[it.shape_id] || '—',
    sizeId: it.shape_size_id || null,
    sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
    colorId: it.color_id || null,
    colorName: colorMap[it.color_id]?.name || '—',
    colorHex: colorMap[it.color_id]?.hex || '#ccc',
    orderSpecs: it.order_specs || null,
    quantity: it.quantity,
    unitPrice: it.unit_price != null ? Number(it.unit_price) : null,
    costPrice: it.cost_price != null ? Number(it.cost_price) : null,
    supplierId: it.supplier_id || null,
    requestType: it.request_type || 'Place Order'
  }));

  // For editing: fetch each order category's linked shapes/sizes/colors, so admin
  // can add a new line within a category already on this order (offline/phone
  // requests) -- same pattern as the customer editor, but admin can always edit
  // regardless of status.
  let categoryOptions: Record<number, { shapes: { id: number; name: string }[]; colors: { id: number; name: string; hex: string | null }[]; sizes: { id: number; shapeId: number; sizeMm: string }[] }> = {};
  if (categoryIds.length > 0) {
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

  return (
    <>
      <Link href="/admin/orders" className="back-link">&larr; All orders</Link>
      <OrderAdminClient
        orderId={order.id}
        status={order.status}
        paymentStatus={order.payment_status}
        pdfUrl={order.pdf_url}
        invoiceUrl={order.invoice_url}
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
        suppliers={suppliersFormatted}
      />
    </>
  );
}
