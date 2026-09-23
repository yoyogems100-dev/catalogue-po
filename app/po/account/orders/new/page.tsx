import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import type { CartItem } from '@/lib/cart-storage';
import RepeatOrderRedirect from './RepeatOrderRedirect';

// This route only ever exists as the "Repeat order" destination
// (?from=<orderId>) -- there's no separate "start a fresh order" flow here;
// that's just browsing the catalogue. Without a valid, owned order to repeat
// there's nothing for this page to do.
export default async function NewOrderPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ from?: string }> }) {
  const searchParams = await searchParamsPromise;
  const customerId = await getCustomerId();
  if (!customerId) redirect('/po/account/login');

  const fromOrderId = searchParams.from ? Number(searchParams.from) : null;
  if (!fromOrderId) redirect('/po/account/orders');

  const { data: order } = await supabaseAdmin.from('orders').select('id, customer_id').eq('id', fromOrderId).single();
  if (!order || order.customer_id !== customerId) redirect('/po/account/orders');

  const { data: items } = await supabaseAdmin.from('order_items').select('*').eq('order_id', fromOrderId);

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [{ data: cats }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name, icon_key, ref_photo_url').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url').in('id', colorIds) : Promise.resolve({ data: [] })
  ]);

  const catMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.name]));
  const shapeMap: Record<number, { name: string; iconKey: string | null; refPhotoUrl: string | null }> = Object.fromEntries(
    (shapesData || []).map((s: any) => [s.id, { name: s.name, iconKey: s.icon_key, refPhotoUrl: s.ref_photo_url }])
  );
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, { name: string; hex: string | null; refPhotoUrl: string | null }> = Object.fromEntries(
    (colorsData || []).map((c: any) => [c.id, { name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url }])
  );

  const seedItems: CartItem[] = (items || []).map((it: any, i: number) => ({
    id: `repeat-${fromOrderId}-${it.id ?? i}`,
    categoryId: it.category_id,
    categoryName: catMap[it.category_id] || '—',
    shapeId: it.shape_id,
    shapeName: shapeMap[it.shape_id]?.name || '—',
    shapeIconKey: shapeMap[it.shape_id]?.iconKey || null,
    shapeRefPhotoUrl: shapeMap[it.shape_id]?.refPhotoUrl || null,
    sizeId: it.shape_size_id,
    sizeMm: sizeMap[it.shape_size_id] || it.custom_size || '—',
    colorId: it.color_id,
    colorName: colorMap[it.color_id]?.name || '—',
    colorHex: colorMap[it.color_id]?.hex || '#ccc',
    colorRefPhotoUrl: colorMap[it.color_id]?.refPhotoUrl || null,
    orderSpecs: it.order_specs || undefined,
    qty: it.quantity,
    requestType: it.request_type || 'Place Order'
  }));

  return <RepeatOrderRedirect seedItems={seedItems} />;
}
