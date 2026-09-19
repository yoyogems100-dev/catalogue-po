import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { generateOrderPdf } from '@/lib/pdf/generate-order-pdf';

// A separate, deliberate document from the order-summary/quotation PDF:
// requires every line to already have a selling price (SP) on record, shows
// the full total, and never includes supplier or cost price (CP) -- same as
// the regular order PDF, which already keeps CP internal-only.
export async function POST(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await generateOrderPdf(Number(params.id), { isInvoice: true });
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url });
}
