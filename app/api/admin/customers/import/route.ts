import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

type ImportRow = { name?: string; company?: string; phone?: string; email?: string; address?: string; place?: string; workStream?: string; goToRequirements?: string };

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
  // Every row always creates a new customer record -- imported rows are never
  // matched against existing customers by phone or anything else.
  const valid = rows.filter((row) => (row.name && row.name.trim()) || (row.company && row.company.trim()));
  if (!valid.length) return NextResponse.json({ error: 'No valid rows to import.' }, { status: 400 });

  const inserts = valid.map((row) => ({
    name: (row.name || '').trim() || null,
    company: (row.company || '').trim() || null,
    phone: normalizePhone(row.phone) || null,
    email: (row.email || '').trim().toLowerCase() || null,
    address: (row.address || '').trim() || null,
    place: (row.place || '').trim() || null,
    work_stream: (row.workStream || '').trim() || null,
    go_to_requirements: (row.goToRequirements || '').trim() || null
  }));
  const { data, error } = await supabaseAdmin.from('customers').insert(inserts).select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ created: data?.length || 0, skipped: rows.length - (data?.length || 0) });
}
