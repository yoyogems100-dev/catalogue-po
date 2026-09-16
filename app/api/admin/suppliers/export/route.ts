import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80).replace(/[,()%]/g, '');
  const categoryIds = (req.nextUrl.searchParams.get('category') || '').split(',').map((v) => v.trim()).filter((v) => /^\d+$/.test(v)).map(Number);

  const [{ data: allCategories }, { data: categoryLinks }] = await Promise.all([
    supabaseAdmin.from('categories').select('id,name'),
    supabaseAdmin.from('supplier_categories').select('supplier_id,category_id'),
  ]);
  const categoryNames = new Map((allCategories || []).map((c: any) => [c.id, c.name]));

  let query = supabaseAdmin.from('suppliers').select('*').order('name');
  if (q) query = query.or(`name.ilike.%${q}%,company.ilike.%${q}%,contact_name.ilike.%${q}%`);
  if (categoryIds.length) {
    const matchingIds = [...new Set((categoryLinks || []).filter((l: any) => categoryIds.includes(l.category_id)).map((l: any) => l.supplier_id))];
    query = query.in('id', matchingIds.length ? matchingIds : [-1]);
  }
  const { data: suppliers, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Suppliers');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Company', key: 'company', width: 24 },
    { header: 'Contact Person', key: 'contactName', width: 20 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Email', key: 'email', width: 24 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'Categories', key: 'categories', width: 40 },
    { header: 'Notes', key: 'notes', width: 30 },
  ];
  (suppliers || []).forEach((s: any) => {
    const names = (categoryLinks || []).filter((l: any) => l.supplier_id === s.id).map((l: any) => categoryNames.get(l.category_id)).filter(Boolean);
    sheet.addRow({
      name: s.name, company: s.company || '', contactName: s.contact_name || '', phone: s.phone || '',
      email: s.email || '', address: s.address || '', categories: names.join(', '), notes: s.notes || ''
    });
  });
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="suppliers.xlsx"'
    }
  });
}
