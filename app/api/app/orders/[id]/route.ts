import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { milestoneLabel } from '@/lib/order-milestones';

// JSON equivalent of app/account/orders/[id]/page.tsx + OrderDetailClient's data --
// powers the app's order detail screen (items, timeline, edit-while-early-stage
// options, reorder data).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const customerId = getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const orderId = Number(params.id);

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, payment_status, created_at, comment, customer_id')
    .eq('id', orderId)
    .single();

  if (!order || order.customer_id !== customerId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('id, category_id, shape_id, shape_size_id, color_id, quantity')
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
    sizeMm: sizeMap[it.shape_size_id] || '—',
    colorId: it.color_id,
    colorName: colorMap[it.color_id]?.name || '—',
    colorHex: colorMap[it.color_id]?.hex || '#ccc',
    quantity: it.quantity
  }));

  const canEdit = order.status === 'placed' || order.status === 'confirmed';

  let categoryOptions: Record<number, { shapes: any[]; colors: any[]; sizes: any[] }> = {};
  if (canEdit && categoryIds.length > 0) {
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

  return NextResponse.json({
    id: order.id,
    status: order.status,
    paymentStatus: order.payment_status,
    createdAt: order.created_at,
    comment: order.comment,
    items: itemsFormatted,
    categoryOptions,
    canEdit,
    timeline
  });
}
