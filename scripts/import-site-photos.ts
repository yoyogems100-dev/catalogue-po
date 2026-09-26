// One-time: give every website category its own copy of the /po photos it
// shows today, so the website and /po photos can be managed independently.
//
//   npx tsx --tsconfig tsconfig.json scripts/import-site-photos.ts --env <file>           (dry run, reads only)
//   npx tsx --tsconfig tsconfig.json scripts/import-site-photos.ts --env <file> --apply   (copies and links)
//
// Repeat-safe: a /po photo is copied once (site_media.source_photo_id) and a
// photo already on a category is skipped. Never deletes or changes /po data.
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const envFile = args[args.indexOf('--env') + 1];
if (!args.includes('--env') || !envFile) throw new Error('Pass --env <path to an env file>.');
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const { copyPoPhotos, poPhotosFor } = await import('../lib/site/copy-po-photos');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  const { data: cats, error } = await db.from('site_categories').select('id, name, parent_id, sort_order').order('parent_id', { nullsFirst: true }).order('sort_order');
  if (error) throw error;
  console.log(apply ? 'APPLYING' : 'DRY RUN (nothing is written)');
  let copied = 0, reused = 0, linked = 0;
  const errors: string[] = [];
  for (const c of cats || []) {
    const { photos } = await poPhotosFor(db, c.id);
    if (!photos.length) continue;
    const r = await copyPoPhotos(db, c.id, photos.map((p) => p.id), { dryRun: !apply });
    copied += r.copied; reused += r.reused; linked += r.linked; errors.push(...r.errors.map((e) => `${c.name}: ${e}`));
    console.log(`${String(c.id).padStart(3)} ${c.name.padEnd(28)} ${photos.length} /po photos → ${r.linked} added (${r.copied} copied, ${r.reused} reused)`);
  }
  console.log(`\nTotal: ${linked} added to categories, ${copied} copied, ${reused} reused, ${errors.length} problems.`);
  errors.forEach((e) => console.log('  ! ' + e));
  if (errors.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
