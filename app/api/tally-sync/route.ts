import { NextRequest, NextResponse } from 'next/server';
import { gunzipSync, gzipSync } from 'zlib';
import { fromTally, isRawSync } from '@/lib/tally/from-tally';
import { DATA_FILE, writeTallyFile } from '@/lib/tally/store';
import { checkSyncKey, readSyncStatus, syncRequestedAt, writeSyncStatus } from '@/lib/tally/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The door the Tally sync program uses (scripts/tally-sync). It has no admin
// cookie, so the middleware lets this path through and the sync key — checked
// on every call — is the only way in.

const MAX_BYTES = 4_000_000; // gzipped upload; the year's books are ~1 MB

/** "Has anyone tapped Sync now?" — asked every 20 seconds. */
export async function GET(req: NextRequest) {
  if (!(await checkSyncKey(req.headers.get('authorization')))) return NextResponse.json({ error: 'Unknown sync key' }, { status: 401 });
  // Note the program is alive, at most every two minutes (keeps storage writes low).
  const status = await readSyncStatus();
  if (!status.lastSeenAt || Date.now() - Date.parse(status.lastSeenAt) > 120_000) {
    await writeSyncStatus({ ...status, lastSeenAt: new Date().toISOString() }).catch(() => {});
  }
  return NextResponse.json({ requestedAt: await syncRequestedAt() });
}

/** A fresh copy of the books. */
export async function POST(req: NextRequest) {
  if (!(await checkSyncKey(req.headers.get('authorization')))) return NextResponse.json({ error: 'Unknown sync key' }, { status: 401 });
  const body = Buffer.from(await req.arrayBuffer());
  if (!body.length || body.length > MAX_BYTES) return NextResponse.json({ error: 'Upload is empty or too large.' }, { status: 413 });

  let raw: unknown;
  try { raw = JSON.parse(gunzipSync(body).toString('utf8')); } catch { return NextResponse.json({ error: 'Could not read the upload.' }, { status: 400 }); }
  if (!isRawSync(raw)) return NextResponse.json({ error: 'Not a Tally sync upload.' }, { status: 400 });

  try {
    const data = fromTally(raw);
    await writeTallyFile(DATA_FILE, gzipSync(JSON.stringify(data)), 'application/gzip');
    const now = new Date().toISOString();
    await writeSyncStatus({
      lastSyncAt: now, lastSeenAt: now, computer: raw.computer,
      counts: { parties: data.parties.length, vouchers: data.vouchers.length, sales: data.sales.length, purchases: data.purchases.length, stock: data.stock.length }
    });
    return NextResponse.json({ ok: true, requestedAt: await syncRequestedAt() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save.' }, { status: 500 });
  }
}
