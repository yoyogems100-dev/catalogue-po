import 'server-only';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { isAdminAuthed } from '@/lib/auth';
import { sessionSecret } from '@/lib/session-secret';
import { AUTH_FILE, readTallyFile, writeTallyFile } from './store';

// A second lock on top of the admin login: the Tally accounts open only with
// the Tally password, so someone who knows the shared admin password still
// can't read balances and ledgers. The owner sets the password the first
// time they open the page; only a scrypt hash is stored, in the private
// Tally bucket. The session cookie is tied to that hash, so changing the
// password signs every other device out.
const COOKIE = 'yoyo_tally_session';
const SESSION_HOURS = 12;
export const MIN_PASSWORD = 6;

type StoredAuth = { salt: string; hash: string; setAt: string };

export async function readAuth(): Promise<StoredAuth | null> {
  const buf = await readTallyFile(AUTH_FILE);
  if (!buf) return null;
  try {
    const a = JSON.parse(buf.toString('utf8'));
    return typeof a?.salt === 'string' && typeof a?.hash === 'string' ? a : null;
  } catch { return null; }
}

function hashPassword(password: string, salt: string) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export async function checkPassword(password: string): Promise<boolean> {
  const auth = await readAuth();
  if (!auth || typeof password !== 'string') return false;
  const got = Buffer.from(hashPassword(password, auth.salt), 'hex');
  const want = Buffer.from(auth.hash, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function setPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const auth: StoredAuth = { salt, hash: hashPassword(password, salt), setAt: new Date().toISOString() };
  await writeTallyFile(AUTH_FILE, Buffer.from(JSON.stringify(auth)), 'application/json');
  return auth;
}

function mac(expires: string, auth: StoredAuth) {
  const secret = sessionSecret('admin');
  if (!secret) throw new Error('Admin session signing is not configured');
  return crypto.createHmac('sha256', `tally:${secret}`).update(`${expires}|${auth.hash.slice(0, 32)}`).digest('hex');
}

export function sessionCookie(auth: StoredAuth) {
  const expires = String(Date.now() + SESSION_HOURS * 3600_000);
  return {
    name: COOKIE,
    value: `${expires}.${mac(expires, auth)}`,
    options: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: SESSION_HOURS * 3600 }
  };
}

export const clearedCookie = { name: COOKIE, value: '', options: { path: '/', maxAge: 0 } };

/** 'admin' = not signed in to admin; 'setup' = no Tally password yet; 'locked' = needs the Tally password; 'open'. */
export type TallyGate = 'admin' | 'setup' | 'locked' | 'open';

export async function tallyGate(): Promise<TallyGate> {
  if (!(await isAdminAuthed())) return 'admin';
  const auth = await readAuth();
  if (!auth) return 'setup';
  const raw = (await cookies()).get(COOKIE)?.value || '';
  const [expires, sig] = raw.split('.');
  if (!expires || !/^\d+$/.test(expires) || Number(expires) < Date.now() || !/^[a-f0-9]{64}$/.test(sig || '')) return 'locked';
  const want = Buffer.from(mac(expires, auth), 'hex');
  const got = Buffer.from(sig, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want) ? 'open' : 'locked';
}
