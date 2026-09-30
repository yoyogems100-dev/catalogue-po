import { NextRequest, NextResponse } from 'next/server';
import { getCustomerId } from '@/lib/customer-auth';
import { checkPassword, passwordProblem } from '@/lib/customer-password';
import { getCredentials, savePassword } from '@/lib/customer-credentials';

// A signed-in customer's own password, from My Info.
export async function GET() {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  const creds = await getCredentials(customerId);
  return NextResponse.json({ hasPassword: !!creds, setAt: creds?.set_at ?? null });
}

// Set one (signed in with a WhatsApp code and never had one) or change it
// (the current password is required, so a borrowed signed-in phone can't
// quietly take over the account).
export async function POST(req: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ error: problem, field: 'password' }, { status: 400 });

  const creds = await getCredentials(customerId);
  if (creds && !(await checkPassword(String(body.current || ''), creds.password_hash))) {
    return NextResponse.json({ error: 'Your current password is not right.', field: 'current' }, { status: 400 });
  }
  await savePassword(customerId, body.password, 'customer');
  return NextResponse.json({ ok: true });
}
