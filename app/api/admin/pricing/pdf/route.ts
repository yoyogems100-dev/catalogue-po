import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSettings } from '@/lib/settings';
import PriceListPdfDocument, { type PriceListData, type PriceListShapeSection } from '@/lib/pdf/PriceListPdfDocument';
import { getPdfLogoDataUrl } from '@/lib/pdf/brand';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  if (categoryId === 34) return NextResponse.redirect(new URL('/api/categories/34/size-chart?type=prices', req.url));

  const [{ data: category }, { data: shapeLinks }, { data: groups }, { data: prices }, { data: categoryColors }, { data: groupMembers }, settings] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').eq('id', categoryId).single(),
    supabaseAdmin.from('category_shapes').select('shape_id, shapes(id, name)').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_groups').select('id, name').order('sort_order'),
    supabaseAdmin.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_rmb').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id, colors(name)').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_group_members').select('group_id, color_id'),
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

  const selectedColors = new Map<number, string>();
  (categoryColors || []).forEach((row: any) => {
    const color = Array.isArray(row.colors) ? row.colors[0] : row.colors;
    if (color?.name) selectedColors.set(row.color_id, color.name);
  });
  const colorNamesByGroup = new Map<number, string[]>();
  (groupMembers || []).forEach((member: any) => {
    const colorName = selectedColors.get(member.color_id);
    if (!colorName) return;
    colorNamesByGroup.set(member.group_id, [...(colorNamesByGroup.get(member.group_id) || []), colorName]);
  });
  const groupsFormatted = (groups || [])
    .filter((group: any) => colorNamesByGroup.has(group.id))
    .map((group: any) => ({
      id: group.id,
      name: group.name,
      colors: (colorNamesByGroup.get(group.id) || []).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    }));

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
  const multiplier = Number(multiplierRow.data?.value);
  if (multiplierRow.error || !Number.isFinite(multiplier) || multiplier <= 0) return NextResponse.json({ error: 'Save a valid conversion rate before exporting INR prices.' }, { status: 400 });

  const data: PriceListData = {
    categoryName: category.name,
    generatedAt: new Date().toISOString(),
    multiplier,
    groups: groupsFormatted,
    sections,
    logoUrl: await getPdfLogoDataUrl(),
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
