import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseWorkbookRows } from '@/lib/xlsx-import';

const ALIASES: Record<string, string> = {
  name: 'name', 'supplier name': 'name',
  company: 'company',
  'contact person': 'contactName', 'contact name': 'contactName', contact: 'contactName',
  phone: 'phone', mobile: 'phone', 'phone number': 'phone',
  email: 'email',
  address: 'address',
  categories: 'categories', category: 'categories', 'categories dealt in': 'categories',
  notes: 'notes', note: 'notes'
};

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Upload a .xlsx file.' }, { status: 400 });

  const buffer = await file.arrayBuffer();
  let parsedRows;
  try {
    parsedRows = await parseWorkbookRows(buffer, ALIASES);
  } catch {
    return NextResponse.json({ error: 'Could not read that file. Make sure it is a valid .xlsx spreadsheet.' }, { status: 400 });
  }
  if (!parsedRows.length) return NextResponse.json({ error: 'No data rows found in the first sheet.' }, { status: 400 });

  const { data: categories } = await supabaseAdmin.from('categories').select('id,name');
  const categoryByName = new Map((categories || []).map((c: any) => [c.name.toLowerCase(), c.id]));

  const rows = parsedRows.map((row) => {
    const name = (row.name || '').trim();
    const categoryNames = (row.categories || '').split(',').map((v) => v.trim()).filter(Boolean);
    const categoryIds: number[] = [];
    const unmatchedCategories: string[] = [];
    categoryNames.forEach((catName) => {
      const id = categoryByName.get(catName.toLowerCase());
      if (id) categoryIds.push(id); else unmatchedCategories.push(catName);
    });
    return {
      data: { name, company: row.company || '', contactName: row.contactName || '', phone: row.phone || '', email: row.email || '', address: row.address || '', notes: row.notes || '', categoryIds },
      status: !name ? 'missing_name' as const : unmatchedCategories.length ? 'unmatched_category' as const : 'valid' as const,
      unmatchedCategories
    };
  });

  return NextResponse.json({ rows });
}
