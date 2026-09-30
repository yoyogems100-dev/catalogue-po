export type OrderReferencePhoto = {
  id: number;
  url: string | null;
  shapeIds: number[];
  colorIds: number[];
  sizeIds: number[];
  /** Set when this photo is another angle of a grouped stone. */
  parentId?: number | null;
};

const DIMENSIONS = ['shapeIds', 'colorIds', 'sizeIds'] as const;

/** The reference strip beside the purchase composer.
 *
 *  It shows the same photos the whole time and re-orders them as options are
 *  picked: anything matching the chosen shape/colour/size comes first, best
 *  match leading. It used to *filter* to the matches instead, which meant the
 *  strip's contents changed out from under the buyer on every pick -- and a
 *  shape with no tagged photo of its own showed the entire gallery, since
 *  filtering to nothing fell back to everything.
 *
 *  Group angles are left out: this is a quick "what does it look like" strip,
 *  so it shows one tile per stone -- the group's cover -- and leaves the other
 *  angles to the Explore Photos gallery, where they can be swiped through. */
export function referencePhotos(photos: OrderReferencePhoto[], selection: { shapeIds: number[]; colorIds: number[]; sizeIds: number[] }) {
  const available = photos.filter((photo) => !!photo.url && !(photo.parentId ?? null));
  const selected = DIMENSIONS.filter((key) => selection[key].length > 0);
  if (selected.length === 0) return { photos: available, matching: false, fallback: false };

  // Score = how many of the picked dimensions this photo matches, so a photo
  // tagged with both the chosen shape and the chosen colour outranks one
  // carrying only the shape. Ties keep the admin's own gallery order.
  const ranked = available
    .map((photo, index) => ({
      photo,
      index,
      score: selected.filter((key) => selection[key].some((id) => photo[key].includes(id))).length
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const matches = ranked.filter((entry) => entry.score > 0).length;
  return { photos: ranked.map((entry) => entry.photo), matching: matches > 0, fallback: matches === 0 };
}
