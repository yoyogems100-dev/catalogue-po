// One-time: put the YOYO GEMS watermark on every photo already on the site
// and /po. New uploads are watermarked as they arrive; this catches up the rest.
//
//   npx tsx --tsconfig tsconfig.json scripts/watermark-all-photos.ts --env <file>
//       dry run: counts what would change, writes nothing
//   ... --preview <dir> [--limit N]
//       also downloads N real photos and saves watermarked samples in <dir>; writes nothing to the site
//   ... --apply [--limit N] [--manifest <file>]
//       watermarks them. Originals are kept in the private `originals` bucket;
//       the files each row stopped pointing at are listed in the manifest
//   ... --cleanup <manifest> [--apply]
//       later (after cached pages have refreshed, about an hour): removes the
//       replaced public files in the manifest that no row points at any more
//
// Covers: /po photos (photo, both crops, Drive imports), website images
// (site_media, every width) and category colour charts.
// Repeat-safe: anything already watermarked is skipped.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const apply = args.includes('--apply');
const envFile = opt('--env');
if (!envFile) throw new Error('Pass --env <path to an env file>.');
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
}
const limit = Number(opt('--limit')) || Infinity;
const previewDir = opt('--preview');
const cleanupFile = opt('--cleanup');
const manifest = opt('--manifest') || path.resolve(`watermark-replaced-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.jsonl`);

async function main() {
  const { createClient } = await import('@supabase/supabase-js');
  const sharp = (await import('sharp')).default;
  const files = await import('../lib/photo-files');
  const media = await import('../lib/site/media');
  const { withWatermark } = await import('../lib/watermark-render');
  const { fetchAllRows } = await import('../lib/fetch-all-rows');
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const PHOTOS = 'photos';

  const photoRead = await fetchAllRows<any>((f, t) => db.from('photos')
    .select('id, category_id, storage_path, original_path, drive_id, photo_crop, cover_crop', { count: 'exact' }).order('id').range(f, t));
  const mediaRead = await fetchAllRows<any>((f, t) => db.from('site_media')
    .select('id, storage_path, original_path, variants', { count: 'exact' }).order('id').range(f, t));
  if (photoRead.error || mediaRead.error) throw new Error((photoRead.error || mediaRead.error)!.message);
  const photos = photoRead.data, mediaRows = mediaRead.data;
  const { data: charts, error: chartErr } = await db.from('categories').select('id, color_chart_url').not('color_chart_url', 'is', null);
  if (chartErr) throw chartErr;
  const publicPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS}/`;

  if (cleanupFile) return cleanup(cleanupFile);

  const todoPhotos = photos.filter((p) => !files.isWatermarked(p) && (p.storage_path || p.drive_id)).slice(0, limit);
  const todoMedia = mediaRows.filter((m) => !m.original_path).slice(0, limit);
  // A chart is watermarked once its clean copy is in the originals bucket.
  const todoCharts: { id: number; path: string }[] = [];
  for (const c of charts || []) {
    if (!c.color_chart_url.startsWith(publicPrefix)) continue;
    const p = c.color_chart_url.slice(publicPrefix.length).split('?')[0];
    const { data } = await db.storage.from(files.ORIGINALS_BUCKET).list(path.dirname(p), { search: path.basename(p) });
    if (!data?.some((o) => o.name === path.basename(p))) todoCharts.push({ id: c.id, path: p });
  }

  console.log(apply ? 'APPLYING' : 'DRY RUN (nothing is written)');
  console.log(`/po photos:     ${todoPhotos.length} to watermark of ${photos.length} (${todoPhotos.filter((p) => p.drive_id).length} from Google Drive, ${todoPhotos.filter((p) => p.photo_crop || p.cover_crop).length} with saved crops)`);
  console.log(`website images: ${todoMedia.length} to watermark of ${mediaRows.length}`);
  console.log(`colour charts:  ${todoCharts.length} to watermark of ${(charts || []).length}`);

  if (previewDir) {
    mkdirSync(previewDir, { recursive: true });
    const sample = [...todoPhotos.filter((p) => !p.drive_id).slice(0, 4), ...todoPhotos.filter((p) => p.drive_id).slice(0, 4)].slice(0, Number.isFinite(limit) ? limit : 8);
    for (const p of sample) {
      try {
        const upright = await files.uprightOriginal(await files.loadOriginalBytes(db, p));
        writeFileSync(path.join(previewDir, `photo-${p.id}.webp`), await files.watermarkedVariant(upright));
        if (p.cover_crop) writeFileSync(path.join(previewDir, `photo-${p.id}-cover.webp`), await files.watermarkedVariant(upright, p.cover_crop));
      } catch (e: any) { console.log(`  ! preview photo ${p.id}: ${e.message}`); }
    }
    for (const m of todoMedia.slice(0, 3)) {
      const { data } = await db.storage.from(PHOTOS).download(m.storage_path);
      if (!data) continue;
      const upright = await sharp(Buffer.from(await data.arrayBuffer())).rotate().png().toBuffer();
      writeFileSync(path.join(previewDir, `site-${m.id}.webp`), await (await withWatermark(upright)).webp({ quality: 88 }).toBuffer());
    }
    console.log(`Samples saved in ${previewDir}`);
  }
  if (!apply) return;

  const errors: string[] = [];
  const record = (kind: string, id: number, replaced: string[]) => appendFileSync(manifest, JSON.stringify({ kind, id, replaced }) + '\n');
  let done = 0;

  for (const p of todoPhotos) {
    try {
      const { update, replaced, created } = await files.rebuildWatermarkedFiles(db, p);
      // Only if nothing changed the row meanwhile (an admin re-crop, say).
      const { data, error } = await db.from('photos').update(update).eq('id', p.id)
        .is('original_path', p.original_path).select('id');
      if (error || !data?.length) {
        await db.storage.from(PHOTOS).remove(created);
        throw new Error(error?.message || 'changed while converting; run again');
      }
      record('photo', p.id, replaced);
      console.log(`  photo ${p.id} ✓ (${++done}/${todoPhotos.length})`);
    } catch (e: any) { errors.push(`photo ${p.id}: ${e.message}`); console.log(`  ! photo ${p.id}: ${e.message}`); }
  }

  done = 0;
  for (const m of todoMedia) {
    try {
      const { update, replaced, created } = await media.watermarkStoredMedia(db, m);
      const { data, error } = await db.from('site_media').update(update).eq('id', m.id).eq('storage_path', m.storage_path).select('id');
      if (error || !data?.length) {
        await db.storage.from(PHOTOS).remove(created);
        throw new Error(error?.message || 'changed while converting; run again');
      }
      record('site_media', m.id, replaced);
      console.log(`  website image ${m.id} ✓ (${++done}/${todoMedia.length})`);
    } catch (e: any) { errors.push(`website image ${m.id}: ${e.message}`); console.log(`  ! website image ${m.id}: ${e.message}`); }
  }

  for (const c of todoCharts) {
    try {
      const { data: file, error: dlErr } = await db.storage.from(PHOTOS).download(c.path);
      if (dlErr || !file) throw new Error(dlErr?.message || 'missing');
      const clean = Buffer.from(await file.arrayBuffer());
      const kept = await db.storage.from(files.ORIGINALS_BUCKET).upload(c.path, clean, { contentType: 'image/webp', upsert: true });
      if (kept.error) throw new Error(kept.error.message);
      const marked = await (await withWatermark(await sharp(clean).rotate().png().toBuffer())).webp({ quality: 95 }).toBuffer();
      const next = c.path.replace(/\.webp$/, '') + `-wm.webp`;
      const up = await db.storage.from(PHOTOS).upload(next, marked, { contentType: 'image/webp', upsert: true });
      if (up.error) throw new Error(up.error.message);
      const { error } = await db.from('categories').update({ color_chart_url: publicPrefix + next }).eq('id', c.id);
      if (error) throw new Error(error.message);
      record('color_chart', c.id, [c.path]);
      console.log(`  colour chart for category ${c.id} ✓`);
    } catch (e: any) { errors.push(`colour chart ${c.id}: ${e.message}`); console.log(`  ! colour chart ${c.id}: ${e.message}`); }
  }

  console.log(`\nDone with ${errors.length} problem(s). Replaced files are listed in ${manifest}`);
  console.log('Run --cleanup with that file in about an hour, once cached pages have refreshed.');
  errors.forEach((e) => console.log('  ! ' + e));
  if (errors.length) process.exitCode = 1;

  // Removes replaced public files -- but never one a row still points at.
  async function cleanup(file: string) {
    const listed = readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => JSON.parse(l).replaced as string[]);
    const inUse = new Set<string>();
    for (const p of photos) [p.storage_path, p.photo_crop?.path, p.cover_crop?.path].forEach((x) => x && inUse.add(x));
    for (const m of mediaRows) [m.storage_path, ...Object.values(m.variants || {})].forEach((x: any) => x && inUse.add(x));
    for (const c of charts || []) if (c.color_chart_url.startsWith(publicPrefix)) inUse.add(c.color_chart_url.slice(publicPrefix.length).split('?')[0]);
    const remove = [...new Set(listed)].filter((p) => !inUse.has(p));
    console.log(`${apply ? 'REMOVING' : 'DRY RUN:'} ${remove.length} replaced public files (${listed.length - remove.length} skipped as still in use). Clean originals stay in the private bucket.`);
    if (!apply) return;
    for (let i = 0; i < remove.length; i += 100) {
      const { error } = await db.storage.from(PHOTOS).remove(remove.slice(i, i + 100));
      if (error) { console.log(`  ! ${error.message}`); process.exitCode = 1; }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
