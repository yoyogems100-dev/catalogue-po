import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CUSTOMER_PLACES } from '@/lib/customer-places';

const WORK_STREAMS = ['Silver jewellery', 'Gold jewellery', 'Commercial jewellery', 'Fashion jewellery', 'Gemstone trader', 'Manufacturer', 'Retailer', 'Other'];

function parseMulti(raw: string, allowed: readonly string[]) {
  return raw.split(',').map((v) => v.trim()).filter((v) => allowed.includes(v));
}

async function customerIdsOrderedFromCategories(categoryIds: number[]) {
  if (!categoryIds.length) return [];
  const { data: matchingItems } = await supabaseAdmin.from('order_items').select('order_id').in('category_id', categoryIds);
  const orderIds = [...new Set((matchingItems || []).map((i: any) => i.order_id))];
  if (!orderIds.length) return [];
  const { data: matchingOrders } = await supabaseAdmin.from('orders').select('customer_id').in('id', orderIds);
  return [...new Set((matchingOrders || []).map((o: any) => o.customer_id).filter(Boolean))];
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  const safeQ = q.replace(/[,()%]/g, '');
  const places = parseMulti(req.nextUrl.searchParams.get('place') || '', CUSTOMER_PLACES);
  const workStreams = parseMulti(req.nextUrl.searchParams.get('workStream') || '', WORK_STREAMS);
  const categoryIds = (req.nextUrl.searchParams.get('category') || '').split(',').map((v) => v.trim()).filter((v) => /^\d+$/.test(v)).map(Number);

  let categoryCustomerIds: number[] = [];
  if (safeQ) {
    const { data: matchingCategories } = await supabaseAdmin.from('categories').select('id').ilike('name', `%${safeQ}%`);
    categoryCustomerIds = await customerIdsOrderedFromCategories((matchingCategories || []).map((c: any) => c.id));
  }

  let query = supabaseAdmin.from('customers').select('*').order('created_at', { ascending: false });
  if (safeQ) {
    const orClauses = [`name.ilike.%${safeQ}%`, `company.ilike.%${safeQ}%`, `phone.ilike.%${safeQ}%`];
    if (categoryCustomerIds.length) orClauses.push(`id.in.(${categoryCustomerIds.join(',')})`);
    query = query.or(orClauses.join(','));
  }
  if (places.length) query = query.in('place', places);
  if (workStreams.length) query = query.in('work_stream', workStreams);
  if (categoryIds.length) {
    const ids = await customerIdsOrderedFromCategories(categoryIds);
    query = query.in('id', ids.length ? ids : [-1]);
  }
  const { data: customers, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Customers');
  sheet.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Company', key: 'company', width: 24 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Email', key: 'email', width: 24 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'Place', key: 'place', width: 16 },
    { header: 'Work Stream', key: 'workStream', width: 22 },
    { header: 'Go-to Requirements', key: 'goToRequirements', width: 40 },
  ];
  (customers || []).forEach((c: any) => {
    sheet.addRow({
      name: c.name || '', company: c.company || '', phone: c.phone || '', email: c.email || '',
      address: c.address || '', place: c.place || '', workStream: c.work_stream || '', goToRequirements: c.go_to_requirements || ''
    });
  });
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="customers.xlsx"'
    }
  });
}
