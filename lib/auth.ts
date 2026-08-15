import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'yoyo_admin_session';

function sign(value: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || 'dev-secret';
  const hmac = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${hmac}`;
}

function verify(signed: string) {
  const [value, hmac] = signed.split('.');
  if (!value || !hmac) return false;
  return sign(value) === signed;
}

export function isAdminAuthed(): boolean {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie) return false;
  return verify(cookie.value);
}

export function adminCookieName() {
  return COOKIE_NAME;
}

export function signAdminToken() {
  return sign('ok');
}
