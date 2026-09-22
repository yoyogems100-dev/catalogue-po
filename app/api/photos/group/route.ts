import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Group photos of the same stone together, or break a group apart.
//
// A group is a lead photo plus its angles: the lead is the cover and carries
// the shape/size/colour/spec tags, and each angle stores the lead's id in
// parent_photo_id. Groups are deliberately one level deep -- grouping onto an
// angle re-points at that angle's own lead, so a group can never become a
// chain nobody can reason about.
//
// POST { photo_ids: number[], lead_id?: number }  -- group (lead defaults to the first id)
// POST { photo_ids: number[], ungroup: true }     -- detach those photos from their group
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { photo_ids, lead_id, ungroup } = await req.json();

  const ids = Array.isArray(photo_ids)
    ? Array.from(new Set(photo_ids.map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0)))
    : [];
  if (ids.length === 0) return NextResponse.json({ error: 'photo_ids required' }, { status: 400 });

  if (ungroup) {
    // Detaching a lead leaves its angles parentless too -- otherwise they'd
    // point at a photo that is no longer a lead, which is the one state the
    // one-level rule forbids.
    const { error } = await supabaseAdmin
      .from('photos')
      .update({ parent_photo_id: null })
      .or(`id.in.(${ids.join(',')}),parent_photo_id.in.(${ids.join(',')})`);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, ungrouped: ids.length });
  }

  if (ids.length < 2) {
    return NextResponse.json({ error: 'Pick at least two photos to group.' }, { status: 400 });
  }

  const { data: photos, error: readError } = await supabaseAdmin
    .from('photos')
    .select('id, category_id, parent_photo_id, is_cover_only')
    .in('id', ids);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  if (!photos || photos.length !== ids.length) {
    return NextResponse.json({ error: 'Some of those photos no longer exist.' }, { status: 400 });
  }
  // A group is one stone shown from several angles, so it belongs to one
  // category -- grouping across categories would leave angles that no category
  // page could ever show next to their lead.
  const categoryIds = new Set(photos.map((p: any) => p.category_id));
  if (categoryIds.size > 1) {
    return NextResponse.json({ error: 'All photos in a group must be in the same category.' }, { status: 400 });
  }
  if (photos.some((p: any) => p.is_cover_only)) {
    return NextResponse.json({ error: 'A category cover photo cannot be part of a product group.' }, { status: 400 });
  }

  const requestedLead = Number(lead_id);
  const leadCandidate = photos.find((p: any) => p.id === requestedLead) || photos.find((p: any) => p.id === ids[0]);
  if (!leadCandidate) return NextResponse.json({ error: 'lead_id must be one of photo_ids' }, { status: 400 });
  // If the chosen lead is itself an angle, the whole selection joins that
  // angle's existing group instead of starting a rival one.
  const leadId = (leadCandidate as any).parent_photo_id ?? leadCandidate.id;

  const angleIds = ids.filter((id) => id !== leadId);
  const { error } = await supabaseAdmin.from('photos').update({ parent_photo_id: leadId }).in('id', angleIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Anything that was an angle OF one of the new angles is re-pointed at the
  // group's lead, keeping every group exactly one level deep.
  if (angleIds.length > 0) {
    await supabaseAdmin.from('photos').update({ parent_photo_id: leadId }).in('parent_photo_id', angleIds);
  }
  // The lead must not remain someone else's angle.
  await supabaseAdmin.from('photos').update({ parent_photo_id: null }).eq('id', leadId);

  return NextResponse.json({ ok: true, leadId, angles: angleIds.length });
}
