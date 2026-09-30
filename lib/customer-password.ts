import crypto from 'node:crypto';
import { promisify } from 'node:util';

// Customer passwords. Sign-in checks a scrypt hash; the owner also asked to be
// able to see each customer's password in admin (decided 2026-09-30, after
// being told the risk), so an AES-256-GCM copy is kept too. Both live in
// customer_credentials (see lib/customer-credentials.ts), which only the
// service-role key can read.
//
// The encryption key is CUSTOMER_PASSWORD_KEY when set, otherwise derived from
// ADMIN_SESSION_SECRET. Changing either later only loses the admin's ability to
// *view* old passwords -- sign-in keeps working because it uses the hash.

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 32;

// Owner's rule (2026-09-30): any characters, 4 or more. The cap only stops
// absurd input.
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 128;

/** Why a password can't be used, or null when it's fine. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function checkPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = (stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function viewKey(): Buffer | null {
  const own = process.env.CUSTOMER_PASSWORD_KEY;
  if (own) return crypto.createHash('sha256').update(own).digest();
  const base = process.env.ADMIN_SESSION_SECRET;
  if (!base) return null;
  return Buffer.from(crypto.hkdfSync('sha256', base, 'yoyo-gems', 'customer-password-view', 32));
}

export function encryptForAdmin(password: string): string | null {
  const key = viewKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`;
}

/** The readable password, or null if it can't be decrypted (e.g. the key changed). */
export function decryptForAdmin(enc: string | null | undefined): string | null {
  const key = viewKey();
  const parts = (enc || '').split('.');
  if (!key || parts.length !== 4 || parts[0] !== 'v1') return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** Easy to read out over the phone: no 0/O or 1/l/I. */
export function generatePassword(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[crypto.randomInt(chars.length)]).join('');
}
