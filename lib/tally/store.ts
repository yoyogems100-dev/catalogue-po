import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/supabase-admin';

// The Tally snapshot and the Tally password hash live in a PRIVATE storage
// bucket. It is never public: files are read here with the service-role key
// and only handed out by routes that check both the admin and Tally cookies.
// The repository is public, so the data must never be committed.
//
// For local development, TALLY_LOCAL_DIR points at a folder used instead of
// the bucket, so trying the portal never touches the live project. It is
// ignored in production.
export const TALLY_BUCKET = 'tally';
export const DATA_FILE = 'data.json.gz';
export const AUTH_FILE = 'auth.json';

function localDir(): string | null {
  const dir = process.env.TALLY_LOCAL_DIR;
  return dir && process.env.NODE_ENV !== 'production' ? dir : null;
}

export async function readTallyFile(name: string): Promise<Buffer | null> {
  const dir = localDir();
  if (dir) {
    try { return await fs.readFile(path.join(dir, name)); } catch { return null; }
  }
  const { data, error } = await supabaseAdmin.storage.from(TALLY_BUCKET).download(name);
  if (error || !data) return null; // no bucket yet, or no file yet
  return Buffer.from(await data.arrayBuffer());
}

let bucketReady = false;
async function ensureBucket() {
  if (bucketReady) return;
  const { data } = await supabaseAdmin.storage.getBucket(TALLY_BUCKET);
  if (!data) {
    const { error } = await supabaseAdmin.storage.createBucket(TALLY_BUCKET, { public: false });
    if (error && !/already exists/i.test(error.message)) throw new Error(`Could not create the private Tally storage: ${error.message}`);
  } else if (data.public) {
    throw new Error('The "tally" storage bucket is public. Make it private in Supabase before using the Tally portal.');
  }
  bucketReady = true;
}

export async function writeTallyFile(name: string, bytes: Buffer, contentType: string) {
  const dir = localDir();
  if (dir) {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), bytes);
    return;
  }
  await ensureBucket();
  const { error } = await supabaseAdmin.storage.from(TALLY_BUCKET).upload(name, bytes, { contentType, upsert: true, cacheControl: '0' });
  if (error) throw new Error(`Could not save to the private Tally storage: ${error.message}`);
}
