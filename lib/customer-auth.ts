import { cookies, headers } from 'next/headers';
import crypto from 'crypto';
import { sessionSecret } from './session-secret';

const COOKIE_NAME = 'yoyo_customer_session';
// "Ordering for": a customer allowed to order for others (customers.
// can_order_for_others) has switched to another buyer. Holds "actor:buyer",
// signed, and only counts alongside the actor's own session cookie.
const ACTING_COOKIE_NAME = 'yoyo_acting_as';
export const ACTING_HOURS = 12;

function sign(value: string) {
  const secret = sessionSecret('customer');
  if (!secret) throw new Error('Customer session signing is not configured');
  const hmac = crypto.createHmac('sha256', secret).update(value).digest('hex');
  return `${value}.${hmac}`;
}

function verify(signed: string): string | null {
  const [value, hmac] = signed.split('.');
  if (!sessionSecret('customer') || !/^[1-9]\d*$/.test(value || '') || !Number.isSafeInteger(Number(value)) || !/^[a-f0-9]{64}$/.test(hmac || '')) return null;
  const expected = sign(value);
  return expected.length === signed.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signed)) ? value : null;
}

/** "actor:buyer" from a switch cookie, or null if it is not one we signed. */
export function parseActingToken(signed: string): { actorId: number; buyerId: number } | null {
  const [value, hmac] = signed.split('.');
  const m = /^([1-9]\d{0,15}):([1-9]\d{0,15})$/.exec(value || '');
  if (!m || !sessionSecret('customer') || !/^[a-f0-9]{64}$/.test(hmac || '')) return null;
  const expected = sign(value);
  if (expected.length !== signed.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signed))) return null;
  return { actorId: Number(m[1]), buyerId: Number(m[2]) };
}

export function actingCookieName() {
  return ACTING_COOKIE_NAME;
}

export function signActingToken(actorId: number, buyerId: number) {
  return sign(`${actorId}:${buyerId}`);
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
//
// Checks the cookie first (web), then falls back to an `Authorization: Bearer
// <token>` header (the mobile app, which stores the same signed value from
// signCustomerToken() in expo-secure-store instead of a cookie -- same HMAC
// token format either way, just delivered differently).
async function signedInCustomerId(): Promise<number | null> {
  const cookie = (await cookies()).get(COOKIE_NAME);
  if (cookie) {
    const value = verify(cookie.value);
    if (value) return Number(value);
  }

  const authHeader = (await headers()).get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const value = verify(authHeader.slice(7).trim());
    if (value) return Number(value);
  }

  return null;
}

/**
 * Who is signed in (`actorId`) and whose account they are using
 * (`customerId`). They differ only while a customer allowed to order for
 * others has switched to a buyer; the switch is only honoured alongside that
 * same person's own session, so a copied switch cookie is useless on its own.
 */
export async function getCustomerSession(): Promise<{ customerId: number; actorId: number } | null> {
  const own = await signedInCustomerId();
  if (!own) return null;
  const acting = (await cookies()).get(ACTING_COOKIE_NAME);
  const switched = acting ? parseActingToken(acting.value) : null;
  if (switched && switched.actorId === own && switched.buyerId !== own && (await canOrderForOthers(own))) {
    return { customerId: switched.buyerId, actorId: own };
  }
  return { customerId: own, actorId: own };
}

/** Whether this customer may switch to other buyers (set on the admin customer page). */
export async function canOrderForOthers(customerId: number): Promise<boolean> {
  // Loaded here, not at the top: the token helpers above must work without a database.
  const { supabaseAdmin } = await import('./supabase-admin');
  const { data } = await supabaseAdmin.from('customers').select('can_order_for_others').eq('id', customerId).is('deleted_at', null).maybeSingle();
  return (data as any)?.can_order_for_others === true;
}

/** The customer whose account is in use -- the buyer, while ordering for someone else. */
export async function getCustomerId(): Promise<number | null> {
  return (await getCustomerSession())?.customerId ?? null;
}
