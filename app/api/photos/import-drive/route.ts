import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { fetchDriveImage, uploadWatermarked, uprightOriginal, watermarkedVariant } from '@/lib/photo-files';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Bulk-imports photos that are already sitting on Google Drive. The Drive
// file stays the untouched original; what the site shows is a watermarked
// copy stored in Storage (storage_path). A Drive file that can't be fetched
// is left out and reported rather than shown unwatermarked.
// Body: { category_id: number, drive_ids: string[] }
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { category_id, drive_ids } = await req.json();
  if (!Number.isInteger(category_id) || !Array.isArray(drive_ids) || drive_ids.length === 0) {
    return NextResponse.json({ error: 'category_id and drive_ids[] required' }, { status: 400 });
  }
  const ids = [...new Set(drive_ids.filter((id: unknown) => typeof id === 'string' && /^[A-Za-z0-9_-]{10,}$/.test(id)))] as string[];
  if (ids.length === 0) return NextResponse.json({ error: 'No valid Drive links found.' }, { status: 400 });
  if (ids.length > 40) return NextResponse.json({ error: 'Import up to 40 Drive photos at a time.' }, { status: 400 });

  const failed: string[] = [];
  const rows: { category_id: number; drive_id: string; storage_path: string }[] = [];
  // A few at a time: each is a download and a re-encode.
  for (let i = 0; i < ids.length; i += 4) {
    await Promise.all(ids.slice(i, i + 4).map(async (drive_id) => {
      try {
        const upright = await uprightOriginal(await fetchDriveImage(drive_id));
        const storage_path = await uploadWatermarked(supabaseAdmin, { category_id }, await watermarkedVariant(upright), 'photo');
        rows.push({ category_id, drive_id, storage_path });
      } catch {
        failed.push(drive_id);
      }
    }));
  }

  if (rows.length === 0) return NextResponse.json({ error: 'None of those Drive photos could be loaded. Check they are shared as "Anyone with the link".' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('photos').insert(rows).select();
  if (error) {
    await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove(rows.map((r) => r.storage_path));
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ imported: data.length, failed: failed.length });
}
