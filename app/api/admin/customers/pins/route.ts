import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { customerIdsWithCredentials, savePassword } from '@/lib/customer-credentials';
import { decryptForAdmin, generatePin } from '@/lib/customer-password';
import { withoutAccessRequest } from '@/lib/access-requests';

export const runtime = 'nodejs';
// Each PIN is hashed with scrypt; a few hundred take a while.
export const maxDuration = 60;

type Customer = { id: number; name: string | null; company: string | null; phone: string | null; place: string | null; tags: string[] | null };

async function activeCustomers() {
  const { data, error } = await fetchAllRows<Customer>((from, to) =>
    supabaseAdmin.from('customers').select('id, name, company, phone, place, tags', { count: 'exact' }).is('deleted_at', null).order('name').range(from, to));
  if (error) throw new Error(error.message);
  return data || [];
}

/** Give every customer with a WhatsApp number but no PIN a random 4-digit PIN. */
export async function POST() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const [customers, has] = await Promise.all([activeCustomers(), customerIdsWithCredentials()]);
    const todo = customers.filter((c) => c.phone && !has.has(c.id));
    let created = 0;
    for (let i = 0; i < todo.length; i += 8) {
      await Promise.all(todo.slice(i, i + 8).map(async (c) => {
        await savePassword(c.id, generatePin(), 'admin');
        // A PIN answers an access request, as when it is set on the customer's page.
        const tags = withoutAccessRequest(c.tags);
        if (tags.length !== (c.tags || []).length) await supabaseAdmin.from('customers').update({ tags }).eq('id', c.id);
        created++;
      }));
    }
    return NextResponse.json({ created, withoutPhone: customers.filter((c) => !c.phone && !has.has(c.id)).length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not set PINs.' }, { status: 400 });
  }
}

/** Every customer's sign-in number and PIN, as an Excel sheet to share them from. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const customers = await activeCustomers();
  const { data: creds, error } = await supabaseAdmin.from('customer_credentials').select('customer_id, password_enc, set_by');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const byId = new Map((creds || []).map((c: any) => [c.customer_id, c]));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Login PINs');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Company', key: 'company', width: 28 },
    { header: 'WhatsApp (sign-in number)', key: 'phone', width: 22 },
    { header: 'Place', key: 'place', width: 16 },
    { header: 'PIN', key: 'pin', width: 10 }
  ];
  for (const c of customers) {
    const cred = byId.get(c.id);
    const pin = cred ? decryptForAdmin(cred.password_enc) ?? 'set (reset to view)' : c.phone ? 'none yet' : 'add a number first';
    sheet.addRow({ name: c.name || '', company: c.company || '', phone: c.phone || '', place: c.place || '', pin });
  }
  sheet.getRow(1).font = { bold: true };
  sheet.getColumn('pin').numFmt = '@';
  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="customer-pins.xlsx"',
      'Cache-Control': 'no-store'
    }
  });
}
