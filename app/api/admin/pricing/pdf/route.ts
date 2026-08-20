import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSettings } from '@/lib/settings';
import PriceListPdfDocument, { type PriceListData, type PriceListShapeSection } from '@/lib/pdf/PriceListPdfDocument';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

  const [{ data: category }, { data: shapeLinks }, { data: groups }, { data: prices }, settings] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').eq('id', categoryId).single(),
    supabaseAdmin.from('category_shapes').select('shape_id, shapes(id, name)').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_groups').select('id, name').order('sort_order'),
    supabaseAdmin.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_rmb').eq('category_id', categoryId),
    getSettings()
  ]);

  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const shapeIds = (shapeLinks || []).map((s: any) => s.shape_id);
  const { data: sizeLinks } = shapeIds.length
    ? await supabaseAdmin.from('category_shape_sizes').select('shape_size_id, shape_sizes(id, shape_id, size_mm)').eq('category_id', categoryId)
    : { data: [] };

  const sizesByShape: Record<number, { id: number; sizeMm: string }[]> = {};
  (sizeLinks || []).forEach((s: any) => {
    const shapeId = s.shape_sizes.shape_id;
    if (!sizesByShape[shapeId]) sizesByShape[shapeId] = [];
    sizesByShape[shapeId].push({ id: s.shape_sizes.id, sizeMm: s.shape_sizes.size_mm });
  });
  Object.values(sizesByShape).forEach((list) =>
    list.sort((a, b) => a.sizeMm.localeCompare(b.sizeMm, undefined, { numeric: true }))
  );

  const priceLookup = new Map<string, number>();
  (prices || []).forEach((p: any) => priceLookup.set(`${p.shape_size_id}:${p.price_group_id}`, Number(p.price_rmb)));

  const groupsFormatted = (groups || []).map((g: any) => ({ id: g.id, name: g.name }));

  // Only shapes that actually have a priced size are worth a page section --
  // a linked-but-unpriced shape would just render an empty table.
  const sections: PriceListShapeSection[] = (shapeLinks || [])
    .map((s: any) => {
      const sizes = sizesByShape[s.shape_id] || [];
      const rows = sizes.map((size) => {
        const rowPrices: Record<number, number | null> = {};
        groupsFormatted.forEach((g) => {
          const rmb = priceLookup.get(`${size.id}:${g.id}`);
          rowPrices[g.id] = rmb ?? null;
        });
        return { sizeMm: size.sizeMm, prices: rowPrices };
      });
      return { shapeName: s.shapes.name, rows };
    })
    .filter((section: PriceListShapeSection) => section.rows.some((r) => Object.values(r.prices).some((v) => v !== null)));

  const multiplierRow = await supabaseAdmin.from('settings').select('value').eq('key', 'rmb_inr_multiplier').maybeSingle();
  const multiplier = Number(multiplierRow.data?.value) || 1;

  const data: PriceListData = {
    categoryName: category.name,
    generatedAt: new Date().toISOString(),
    multiplier,
    groups: groupsFormatted,
    sections,
    logoUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/brand/yoyo-logo-horizontal.png`,
    contactWhatsapp: settings.whatsapp_number || null,
    contactLocation: settings.location || null
  };

  const buffer = await renderToBuffer(React.createElement(PriceListPdfDocument, { data }) as any);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="price-list-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf"`
    }
  });
}
