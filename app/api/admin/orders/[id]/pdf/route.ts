import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { getSettings } from '@/lib/settings';
import { milestoneLabel } from '@/lib/order-milestones';
import OrderPdfDocument, { PdfItem } from '@/lib/pdf/OrderPdfDocument';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, request_type, created_at, comment, customer_id')
    .eq('id', orderId)
    .single();

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { data: customer } = order.customer_id
    ? await supabaseAdmin.from('customers').select('name, phone, company').eq('id', order.customer_id).single()
    : { data: null };

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('category_id, shape_id, shape_size_id, color_id, quantity, unit_price')
    .eq('order_id', orderId);

  const categoryIds = [...new Set((items || []).map((i: any) => i.category_id).filter(Boolean))];
  const shapeIds = [...new Set((items || []).map((i: any) => i.shape_id).filter(Boolean))];
  const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
  const colorIds = [...new Set((items || []).map((i: any) => i.color_id).filter(Boolean))];

  const [{ data: cats }, { data: shapesData }, { data: sizesData }, { data: colorsData }] = await Promise.all([
    categoryIds.length ? supabaseAdmin.from('categories').select('id, name').in('id', categoryIds) : Promise.resolve({ data: [] }),
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name').in('id', colorIds) : Promise.resolve({ data: [] })
  ]);

  const catMap: Record<number, string> = Object.fromEntries((cats || []).map((c: any) => [c.id, c.name]));
  const shapeMap: Record<number, string> = Object.fromEntries((shapesData || []).map((s: any) => [s.id, s.name]));
  const sizeMap: Record<number, string> = Object.fromEntries((sizesData || []).map((s: any) => [s.id, s.size_mm]));
  const colorMap: Record<number, string> = Object.fromEntries((colorsData || []).map((c: any) => [c.id, c.name]));

  const pdfItems: PdfItem[] = (items || []).map((it: any) => ({
    categoryName: catMap[it.category_id] || '—',
    shapeName: shapeMap[it.shape_id] || '—',
    sizeMm: sizeMap[it.shape_size_id] || '—',
    colorName: colorMap[it.color_id] || '—',
    quantity: it.quantity,
    unitPrice: it.unit_price != null ? Number(it.unit_price) : null
  }));

  const settings = await getSettings();

  const buffer = await renderToBuffer(
    React.createElement(OrderPdfDocument, {
      data: {
        orderId: order.id,
        statusLabel: milestoneLabel(order.status),
        requestType: order.request_type || 'Place Order',
        createdAt: order.created_at,
        customerName: customer?.name || null,
        customerPhone: customer?.phone || null,
        customerCompany: (customer as any)?.company || null,
        comment: order.comment,
        items: pdfItems,
        contactWhatsapp: settings.whatsapp_number || null,
        contactLocation: settings.location || null
      }
    })
  );

  const path = `order-pdfs/order-${orderId}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;

  await supabaseAdmin.from('orders').update({ pdf_url: url }).eq('id', orderId);

  return NextResponse.json({ url });
}
