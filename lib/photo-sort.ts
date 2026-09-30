// Sort order for the Explore Photos grid.
//
// "featured" keeps the order the team arranged in admin (photos.sort_order).
// The other two go by when the product was uploaded: its lead photo's
// created_at, so adding another angle to an old stone doesn't make it "new".
// Photos imported together share a timestamp, so the photo id (which only
// grows) breaks ties.

export type PhotoSort = 'featured' | 'newest' | 'oldest';

export const PHOTO_SORTS: { value: PhotoSort; label: string }[] = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Recently uploaded' },
  { value: 'oldest', label: 'Oldest first' }
];

type Uploaded = { id: number; uploadedAt?: string | null };

function uploadTime(p: Uploaded) {
  const t = p.uploadedAt ? Date.parse(p.uploadedAt) : NaN;
  return Number.isNaN(t) ? 0 : t;
}

export function sortPhotoGroups<T extends { lead: Uploaded }>(groups: T[], sort: PhotoSort): T[] {
  if (sort === 'featured') return groups;
  const dir = sort === 'newest' ? -1 : 1;
  return [...groups].sort((a, b) =>
    dir * (uploadTime(a.lead) - uploadTime(b.lead)) || dir * (a.lead.id - b.lead.id));
}
