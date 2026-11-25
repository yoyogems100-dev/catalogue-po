import { NextRequest, NextResponse } from 'next/server';
import { tallyGate } from '@/lib/tally/auth';
import { createSyncKey, requestSync, revokeSyncKey, syncOverview } from '@/lib/tally/sync';

export const dynamic = 'force-dynamic';

// Live-sync controls for the owner: status, "Sync now", and the sync key.
export async function GET() {
  if ((await tallyGate()) !== 'open') return NextResponse.json({ error: 'Locked' }, { status: 401 });
  return NextResponse.json(await syncOverview(), { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  if ((await tallyGate()) !== 'open') return NextResponse.json({ error: 'Unlock the Tally portal first.' }, { status: 401 });
  const { action } = await req.json().catch(() => ({}));
  try {
    if (action === 'request') return NextResponse.json({ ok: true, requestedAt: await requestSync() });
    if (action === 'create-key') return NextResponse.json({ ok: true, key: await createSyncKey() }, { headers: { 'Cache-Control': 'no-store' } });
    if (action === 'revoke-key') { await revokeSyncKey(); return NextResponse.json({ ok: true }); }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Something went wrong.' }, { status: 500 });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
