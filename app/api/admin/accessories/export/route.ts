import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ACCESSORIES_SETTING_KEY, effectiveCatalogue, parseOverrides } from '@/lib/accessories/overrides';

export const dynamic = 'force-dynamic';

const yes = (b: boolean) => (b ? 'Yes' : 'No');

/** The complete Accessories list as Excel: one sheet of ranges, one of every style, with the saved edits applied. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', ACCESSORIES_SETTING_KEY).maybeSingle();
  const { ranges, styles } = effectiveCatalogue(parseOverrides(data?.value ?? null));
  const rangeById = new Map(ranges.map((r) => [r.id, r]));

  const wb = new ExcelJS.Workbook();
  const rs = wb.addWorksheet('Ranges', { views: [{ state: 'frozen', ySplit: 1 }] });
  rs.columns = [
    { header: 'Position', key: 'pos', width: 9 },
    { header: 'Range ID', key: 'id', width: 10 },
    { header: 'Series', key: 'series', width: 9 },
    { header: 'Name', key: 'name', width: 34 },
    { header: 'Description', key: 'text', width: 70 },
    { header: 'Finish', key: 'finish', width: 40 },
    { header: 'Styles', key: 'count', width: 8 },
    { header: 'Styles shown', key: 'shown', width: 12 },
    { header: 'Photo views', key: 'views', width: 50 },
    { header: 'Shown on page', key: 'visible', width: 13 },
    { header: 'Original name', key: 'orig', width: 34 },
    { header: 'Link', key: 'link', width: 48 }
  ];
  ranges.forEach((r, i) => rs.addRow({
    pos: i + 1, id: r.id, series: r.series, name: r.name, text: r.text, finish: r.finish,
    count: r.styleCount, shown: r.hidden ? 0 : r.shownCount, views: r.views.join(', '), visible: yes(!r.hidden),
    orig: r.name !== r.original.name ? r.original.name : '', link: `https://www.yoyogems.co.in/po/accessories#${r.id}`
  }));

  const ss = wb.addWorksheet('Styles', { views: [{ state: 'frozen', ySplit: 1 }] });
  ss.columns = [
    { header: 'Style ID', key: 'sku', width: 11 },
    { header: 'Code', key: 'code', width: 9 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Range ID', key: 'cat', width: 10 },
    { header: 'Series', key: 'series', width: 9 },
    { header: 'Range', key: 'range', width: 34 },
    { header: 'Style', key: 'style', width: 12 },
    { header: 'Colours', key: 'colours', width: 46 },
    { header: 'Colour families', key: 'families', width: 36 },
    { header: 'Range description', key: 'text', width: 60 },
    { header: 'Finish', key: 'finish', width: 40 },
    { header: 'Shown on page', key: 'visible', width: 13 },
    { header: 'Out of stock', key: 'out', width: 12 },
    { header: 'Original name', key: 'origName', width: 28 },
    { header: 'Original code', key: 'origCode', width: 13 },
    { header: 'Link', key: 'link', width: 48 }
  ];
  const order = new Map(ranges.map((r, i) => [r.id, i]));
  [...styles].sort((a, b) => order.get(a.cat)! - order.get(b.cat)! || a.sku.localeCompare(b.sku, 'en', { numeric: true })).forEach((s) => {
    const r = rangeById.get(s.cat)!;
    ss.addRow({
      sku: s.sku, code: s.code, name: s.name, cat: s.cat, series: r.series, range: r.name, style: s.style,
      colours: s.colours.join(', '), families: s.families.join(', '), text: r.text, finish: r.finish,
      visible: yes(!s.hidden && !r.hidden), out: yes(s.out),
      origName: s.name !== s.original.name ? s.original.name : '', origCode: s.code !== s.original.code ? s.original.code : '',
      link: `https://www.yoyogems.co.in/po/accessories#${s.sku}`
    });
  });
  for (const sh of [rs, ss]) {
    sh.getRow(1).font = { bold: true };
    sh.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sh.columnCount } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="yoyo-accessories-${date}.xlsx"`,
      'Cache-Control': 'no-store'
    }
  });
}
