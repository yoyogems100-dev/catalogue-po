import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { MIN_PASSWORD, checkPassword, clearedCookie, readAuth, sessionCookie, setPassword, tallyGate } from '@/lib/tally/auth';

// Unlock, lock, first-time set-up and change of the Tally password.
// Every action needs the admin cookie first.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Sign in to admin first.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || '');
  const password = typeof body?.password === 'string' ? body.password : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

  if (action === 'logout') {
    const res = NextResponse.json({ ok: true });
    res.cookies.set(clearedCookie.name, clearedCookie.value, clearedCookie.options);
    return res;
  }

  try {
    if (action === 'setup') {
      if (await readAuth()) return NextResponse.json({ error: 'A Tally password is already set. Unlock with it instead.' }, { status: 409 });
      if (password.length < MIN_PASSWORD) return NextResponse.json({ error: `Use at least ${MIN_PASSWORD} characters.` }, { status: 400 });
      const auth = await setPassword(password);
      const c = sessionCookie(auth);
      const res = NextResponse.json({ ok: true });
      res.cookies.set(c.name, c.value, c.options);
      return res;
    }

    if (action === 'login') {
      if (!(await checkPassword(password))) {
        await new Promise((r) => setTimeout(r, 700)); // slow down guessing
        return NextResponse.json({ error: 'That is not the Tally password.' }, { status: 401 });
      }
      const c = sessionCookie((await readAuth())!);
      const res = NextResponse.json({ ok: true });
      res.cookies.set(c.name, c.value, c.options);
      return res;
    }

    if (action === 'change') {
      if ((await tallyGate()) !== 'open') return NextResponse.json({ error: 'Unlock the Tally portal first.' }, { status: 401 });
      if (!(await checkPassword(password))) return NextResponse.json({ error: 'The current password is not right.' }, { status: 401 });
      if (newPassword.length < MIN_PASSWORD) return NextResponse.json({ error: `Use at least ${MIN_PASSWORD} characters.` }, { status: 400 });
      const c = sessionCookie(await setPassword(newPassword));
      const res = NextResponse.json({ ok: true });
      res.cookies.set(c.name, c.value, c.options);
      return res;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Something went wrong.' }, { status: 500 });
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
}
