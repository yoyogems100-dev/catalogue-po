import { cookies } from 'next/headers';
import crypto from 'crypto';
import { sessionSecret } from './session-secret';

const COOKIE_NAME = 'yoyo_admin_session';

function sign(value: string) {
  const secret = sessionSecret('admin');
  if (!secret) throw new Error('Admin session signing is not configured');
  const hmac = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${hmac}`;
}

function verify(signed: string) {
  const [value, hmac] = signed.split('.');
  if (!sessionSecret('admin') || value !== 'ok' || !/^[a-f0-9]{64}$/.test(hmac || '')) return false;
  const expected = sign(value);
  return expected.length === signed.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signed));
}

export async function isAdminAuthed(): Promise<boolean> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (!cookie) return false;
  return verify(cookie.value);
}

export function adminCookieName() {
  return COOKIE_NAME;
}

export function signAdminToken() {
  return sign('ok');
}
