// Turning a flat list of photos into the groups the catalogue shows.
//
// A group is a lead photo plus its extra angles (`parentId` points at the
// lead). The lead is what a grid card shows and what carries the group's
// shape/size/colour/spec tags; the angles are the other views a buyer swipes
// through. One photo with no angles is a group of one, so callers never need
// to special-case an ungrouped photo.

export type GroupablePhoto = { id: number; parentId?: number | null };

export type PhotoGroup<T> = {
  /** The cover: first photo added to the group. */
  lead: T;
  /** Lead first, then its angles in list order -- what the gallery pages through. */
  media: T[];
};

export function buildPhotoGroups<T extends GroupablePhoto>(photos: T[]): PhotoGroup<T>[] {
  const present = new Set(photos.map((p) => p.id));
  const anglesByLead = new Map<number, T[]>();

  for (const photo of photos) {
    const parentId = photo.parentId ?? null;
    // An angle whose lead isn't in this list -- filtered out by the shape/colour
    // filters, or left behind in another category by a partial move -- stands on
    // its own rather than vanishing from the grid with its missing parent.
    if (parentId === null || !present.has(parentId)) continue;
    const angles = anglesByLead.get(parentId) || [];
    angles.push(photo);
    anglesByLead.set(parentId, angles);
  }

  const groups: PhotoGroup<T>[] = [];
  for (const photo of photos) {
    const parentId = photo.parentId ?? null;
    if (parentId !== null && present.has(parentId)) continue; // an angle, already counted
    groups.push({ lead: photo, media: [photo, ...(anglesByLead.get(photo.id) || [])] });
  }
  return groups;
}

/** Every photo id in the same group as `id` -- used by the admin bulk actions,
 *  which must keep a group together when it moves, is watermarked or is deleted. */
export function groupMemberIds<T extends GroupablePhoto>(photos: T[], id: number): number[] {
  const photo = photos.find((p) => p.id === id);
  if (!photo) return [];
  const leadId = photo.parentId ?? photo.id;
  return photos.filter((p) => p.id === leadId || (p.parentId ?? null) === leadId).map((p) => p.id);
}
