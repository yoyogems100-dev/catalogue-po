import 'server-only';
import crypto from 'crypto';
import { readTallyFile, writeTallyFile } from './store';

// The sync program on the Tally computer proves itself with a sync key the
// owner creates in the portal. Only a SHA-256 hash of the key is stored; the
// key is shown once. Creating a new key cuts off the old one.
//
// Three small files in the private bucket, each written by one side only:
//   sync-key.json     the key hash          (owner, from the portal)
//   sync-request.json "Sync now" timestamp  (owner, from the portal)
//   sync-status.json  last sync / last seen (the sync program)
const KEY_FILE = 'sync-key.json';
const REQUEST_FILE = 'sync-request.json';
const STATUS_FILE = 'sync-status.json';

export type SyncStatus = { lastSyncAt?: string; lastSeenAt?: string; computer?: string; counts?: Record<string, number> };

async function readJson<T>(name: string): Promise<T | null> {
  const b = await readTallyFile(name);
  if (!b) return null;
  try { return JSON.parse(b.toString('utf8')) as T; } catch { return null; }
}
const writeJson = (name: string, v: unknown) => writeTallyFile(name, Buffer.from(JSON.stringify(v)), 'application/json');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function createSyncKey(): Promise<string> {
  const key = `ytk_${crypto.randomBytes(24).toString('base64url')}`;
  await writeJson(KEY_FILE, { hash: sha(key), createdAt: new Date().toISOString() });
  return key;
}

export async function revokeSyncKey() {
  await writeJson(KEY_FILE, { hash: '', createdAt: '', revokedAt: new Date().toISOString() });
}

export async function checkSyncKey(header: string | null): Promise<boolean> {
  const key = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!/^ytk_[A-Za-z0-9_-]{30,}$/.test(key)) return false;
  const stored = await readJson<{ hash: string }>(KEY_FILE);
  if (!stored?.hash) return false;
  const a = Buffer.from(sha(key), 'hex');
  const b = Buffer.from(stored.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function requestSync() {
  const requestedAt = new Date().toISOString();
  await writeJson(REQUEST_FILE, { requestedAt });
  return requestedAt;
}

export async function syncRequestedAt(): Promise<string> {
  return (await readJson<{ requestedAt: string }>(REQUEST_FILE))?.requestedAt || '';
}

export async function readSyncStatus(): Promise<SyncStatus> {
  return (await readJson<SyncStatus>(STATUS_FILE)) || {};
}

export async function writeSyncStatus(s: SyncStatus) {
  await writeJson(STATUS_FILE, s);
}

/** Everything the portal shows about live sync. */
export async function syncOverview() {
  const [key, status, requestedAt] = await Promise.all([readJson<{ hash: string; createdAt: string }>(KEY_FILE), readSyncStatus(), syncRequestedAt()]);
  return { hasKey: Boolean(key?.hash), keyCreatedAt: key?.createdAt || '', requestedAt, ...status };
}
