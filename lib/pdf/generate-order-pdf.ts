import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { getSettings } from '@/lib/settings';
import { milestoneLabel } from '@/lib/order-milestones';
import OrderPdfDocument from './OrderPdfDocument';
import { getPdfLogoDataUrl } from './brand';
import { buildPdfItems } from './build-pdf-items';

// Shared by the order-summary/quotation PDF and the invoice PDF -- same
// document data assembly and upload, just a different storage path/URL
// column and (for the invoice) the docTitle and an all-priced requirement.
export async function generateOrderPdf(orderId: number, { isInvoice = false }: { isInvoice?: boolean } = {}) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, request_type, created_at, comment, customer_id, contact_name')
    .eq('id', orderId)
    .single();

  if (!order) return { error: 'Order not found', status: 404 } as const;

  const { data: customer } = order.customer_id
    ? await supabaseAdmin.from('customers').select('name, phone, company').eq('id', order.customer_id).single()
    : { data: null };

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);

  if (itemsError) return { error: 'Could not load order items. Please retry.', status: 500 } as const;

  if (isInvoice && (items || []).some((i: any) => i.unit_price == null)) {
    return { error: 'Please enter all the selling prices.', status: 400 } as const;
  }

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

  const pdfItems = buildPdfItems(items || [], { categoryName: catMap, shapeName: shapeMap, sizeMm: sizeMap, colorName: colorMap });

  const settings = await getSettings();

  // renderToBuffer's TS signature expects a ReactElement<DocumentProps> specifically
  // (the <Document> element itself), not a wrapping component's element -- cast needed
  // purely to satisfy the type checker, no behavior change.
  const buffer = await renderToBuffer(
    React.createElement(OrderPdfDocument, {
      data: {
        orderId: order.id,
        statusLabel: milestoneLabel(order.status),
        requestType: order.request_type || 'Place Order',
        createdAt: order.created_at,
        customerName: customer?.name || order.contact_name || null,
        customerPhone: customer?.phone || null,
        customerCompany: (customer as any)?.company || null,
        comment: order.comment,
        items: pdfItems,
        contactWhatsapp: settings.whatsapp_number || null,
        contactLocation: settings.location || null,
        logoUrl: await getPdfLogoDataUrl(),
        isInvoice
      }
    }) as any
  );

  const path = `order-pdfs/${isInvoice ? 'invoice' : 'order'}-${orderId}.pdf`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(path, buffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) return { error: uploadError.message, status: 400 } as const;

  // Every regeneration reuses the same storage path (upsert) so old links keep
  // working, but that means an unchanged URL -- a cache-busting query string
  // is the only way to stop the browser/CDN from serving the previous file
  // after a price edit, which is why edits weren't "reflecting" in the PDF.
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}?v=${Date.now()}`;

  const { error: saveError } = await supabaseAdmin.from('orders').update(isInvoice ? { invoice_url: url } : { pdf_url: url }).eq('id', orderId);
  if (saveError) return { error: 'PDF generated but could not be attached to the order. Please retry.', status: 500 } as const;

  return { url } as const;
}
