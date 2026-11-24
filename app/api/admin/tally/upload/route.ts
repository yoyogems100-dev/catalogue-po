import { NextRequest, NextResponse } from 'next/server';
import { gzipSync } from 'zlib';
import { tallyGate } from '@/lib/tally/auth';
import { parseTallyWorkbook } from '@/lib/tally/parse';
import { DATA_FILE, writeTallyFile } from '@/lib/tally/store';

export const maxDuration = 60;

// Replace the Tally snapshot with a newly exported workbook. The previous
// snapshot is overwritten (the owner keeps the Excel files themselves).
export async function POST(req: NextRequest) {
  if ((await tallyGate()) !== 'open') return NextResponse.json({ error: 'Unlock the Tally portal first.' }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose the Tally Excel file (.xlsx).' }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: 'That is not an .xlsx file.' }, { status: 400 });

  let data;
  try {
    data = await parseTallyWorkbook(await file.arrayBuffer(), file.name);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not read that file.' }, { status: 400 });
  }
  try {
    await writeTallyFile(DATA_FILE, gzipSync(JSON.stringify(data)), 'application/gzip');
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save the data.' }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    counts: { parties: data.parties.length, sales: data.sales.length, purchases: data.purchases.length, vouchers: data.vouchers.length, stock: data.stock.length }
  });
}
