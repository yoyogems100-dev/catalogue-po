import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ImportRow = { name: string; company?: string; contactName?: string; phone?: string; email?: string; address?: string; notes?: string; categoryIds?: number[] };

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  const valid = rows.filter((row) => row.name && row.name.trim());
  if (!valid.length) return NextResponse.json({ error: 'No valid rows to import.' }, { status: 400 });

  let created = 0;
  for (const row of valid) {
    const { data, error } = await supabaseAdmin.from('suppliers').insert({
      name: row.name.trim(),
      company: (row.company || '').trim() || null,
      contact_name: (row.contactName || '').trim() || null,
      phone: (row.phone || '').trim() || null,
      email: (row.email || '').trim().toLowerCase() || null,
      address: (row.address || '').trim() || null,
      notes: (row.notes || '').trim() || null
    }).select('id').single();
    if (error || !data) continue;
    const categoryIds = (row.categoryIds || []).filter((id) => Number.isSafeInteger(id) && id > 0);
    if (categoryIds.length) {
      await supabaseAdmin.from('supplier_categories').insert(categoryIds.map((categoryId) => ({ supplier_id: data.id, category_id: categoryId })));
    }
    created++;
  }
  return NextResponse.json({ created, skipped: rows.length - created });
}
