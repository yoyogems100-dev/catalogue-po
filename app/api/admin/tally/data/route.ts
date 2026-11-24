import { NextResponse } from 'next/server';
import { tallyGate } from '@/lib/tally/auth';
import { DATA_FILE, readTallyFile } from '@/lib/tally/store';

export const dynamic = 'force-dynamic';

// The whole Tally snapshot, already gzipped in storage, sent as-is so the
// browser can search it instantly. Never cached anywhere.
export async function GET() {
  const gate = await tallyGate();
  if (gate !== 'open') return NextResponse.json({ error: 'Locked', gate }, { status: 401 });
  const bytes = await readTallyFile(DATA_FILE);
  if (!bytes) return NextResponse.json({ error: 'No Tally data uploaded yet.', empty: true }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex'
    }
  });
}
