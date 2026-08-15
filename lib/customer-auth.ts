import { cookies } from 'next/headers';
import crypto from 'crypto';

const COOKIE_NAME = 'yoyo_customer_session';

function sign(value: string) {
  const secret = process.env.CUSTOMER_SESSION_SECRET || 'dev-secret';
  const hmac = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${hmac}`;
}

function verify(signed: string): string | null {
  const [value, hmac] = signed.split('.');
  if (!value || !hmac) return null;
  return sign(value) === signed ? value : null;
}

export function customerCookieName() {
  return COOKIE_NAME;
}

export function signCustomerToken(customerId: number) {
  return sign(String(customerId));
}

// Returns the logged-in customer's id, or null if there's no valid session.
// Server-side (API routes, server components) only -- middleware.ts has its
// own Web-Crypto-based check since Edge Runtime can't use Node's `crypto`.
export function getCustomerId(): number | null {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie) return null;
  const value = verify(cookie.value);
  return value ? Number(value) : null;
}
