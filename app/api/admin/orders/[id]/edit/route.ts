import { validateOrderSpecs } from '@/lib/validate-order-specs';
import { validSpecQuantity } from '@/lib/order-specs';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCategoryPricing } from '@/lib/pricing';
import { lineInrPrice } from '@/lib/pricing-calc';

export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { data: order } = await supabaseAdmin.from('orders').select('id').eq('id', orderId).single();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const body=await req.json();
  const updates=Array.isArray(body.updates)?body.updates:[], removedIds=Array.isArray(body.removedIds)?body.removedIds:[];
  let validRawNewItems:any[];
  try {
    validRawNewItems=await validateOrderSpecs((Array.isArray(body.newItems)?body.newItems:[]).map(n=>({...n,qty:n.quantity})));
    const existing=await supabaseAdmin.from('order_items').select('*').eq('order_id',orderId);
    if(existing.error)throw Error('Could not load order lines.');
    for(const u of updates){const item=existing.data?.find(i=>i.id===u.id);if(!item||!validSpecQuantity(item.order_specs,u.quantity))throw Error('Enter whole quantities; rainbow quantities must be complete strips.');}
  } catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Invalid order options'},{status:400});}
  for(const u of updates){const {error}=await supabaseAdmin.from('order_items').update({quantity:u.quantity}).eq('id',u.id).eq('order_id',orderId);if(error)return NextResponse.json({error:'Quantity change could not be saved.'},{status:400});}
  if(removedIds.length){const {error}=await supabaseAdmin.from('order_items').delete().in('id',removedIds).eq('order_id',orderId);if(error)return NextResponse.json({error:'Removal could not be saved.'},{status:400});}
  const newItemCategoryIds = [...new Set(validRawNewItems.map((n: any) => n.categoryId))];
  const newItemPricingByCategory = new Map(
    await Promise.all(newItemCategoryIds.map(async (id) => [id, await getCategoryPricing(id, supabaseAdmin)] as const))
  );
  const validNewItems = validRawNewItems.map((n: any) => {
    const pricing = newItemPricingByCategory.get(n.categoryId);
    const unitPrice = !n.orderSpecs && pricing ? lineInrPrice(pricing, n.shapeId, n.sizeId, n.colorId) : null;
    return {
      order_id: orderId,
      category_id: n.categoryId,
      shape_id: n.shapeId,
      shape_size_id: n.sizeId,
      color_id: n.colorId,
      quantity: n.quantity,
      order_specs: n.orderSpecs || null,
      unit_price: unitPrice
    };
  });

  if (validNewItems.length > 0) {
    const {error}=await supabaseAdmin.from('order_items').insert(validNewItems);
    if(error)return NextResponse.json({error:'New lines could not be saved. Please reload the order before retrying.'},{status:400});
  }

  await supabaseAdmin.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabaseAdmin.from('order_notes').insert({
    order_id: orderId,
    author_type: 'admin',
    message: 'Order edited by admin (offline/phone request)',
    internal_only: false
  });

  return NextResponse.json({ ok: true });
}
