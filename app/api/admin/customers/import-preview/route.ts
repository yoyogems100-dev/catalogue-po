import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { parseWorkbookRows } from '@/lib/xlsx-import';
import { CUSTOMER_PLACES } from '@/lib/customer-places';

const ALIASES: Record<string, string> = {
  name: 'name',
  company: 'company',
  phone: 'phone', mobile: 'phone', 'phone number': 'phone', 'whatsapp number': 'phone',
  email: 'email',
  address: 'address',
  place: 'place',
  'work stream': 'workStream', workstream: 'workStream',
  'go-to requirements': 'goToRequirements', 'go to requirements': 'goToRequirements', requirements: 'goToRequirements'
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

  const placeSet = new Set<string>(CUSTOMER_PLACES);

  const rows = parsedRows.map((row) => {
    const name = (row.name || '').trim();
    const company = (row.company || '').trim();
    const place = (row.place || '').trim();
    return {
      data: {
        name, company, phone: row.phone || '', email: row.email || '', address: row.address || '',
        place: placeSet.has(place) ? place : '', workStream: row.workStream || '', goToRequirements: row.goToRequirements || ''
      },
      status: (!name && !company) ? 'missing_required' as const : 'valid' as const,
      unmatchedPlace: place && !placeSet.has(place) ? place : undefined
    };
  });

  return NextResponse.json({ rows });
}
