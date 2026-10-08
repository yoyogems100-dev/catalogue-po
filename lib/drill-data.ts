// Hole Punched Stones: what's been drilled into each shape's photo, as kept in
// category_shapes.drill. A stone can be drilled with 1, 2 or 3 holes, and each
// count has its own photo -- the one a customer sees after choosing that many
// holes. (No image code here, so the order form can use it too; the drawing
// is lib/drill-hole.ts.)
//
//   { base: the clean photo every count is drilled into,
//     variants: { "1" | "2" | "3": { holes, backdrop, photoId, url } } }
//
// Saves from before counts existed held one drilling at the top level
// ({ base, holes, backdrop, photoId }); it's read as the variant for its
// number of holes, with the category's shape photo as its picture.

export const HOLE_COUNTS = [1, 2, 3] as const;
export type HoleCount = (typeof HOLE_COUNTS)[number];
export const MAX_HOLES = 3;

export type DrillHole = { x: number; y: number; r: number };
export type Backdrop = 'black' | 'white';
export type DrillVariant = { holes: DrillHole[]; backdrop: Backdrop | null; photoId: number | null; url: string | null };
export type DrillRecord = { base: string; variants: Partial<Record<`${HoleCount}`, DrillVariant>> };

export function isHoleCount(n: unknown): n is HoleCount {
  return n === 1 || n === 2 || n === 3;
}

export function readDrill(raw: unknown, shapePhotoUrl: string | null = null): DrillRecord | null {
  const d = raw as any;
  if (!d || typeof d !== 'object' || typeof d.base !== 'string') return null;
  if (d.variants && typeof d.variants === 'object') {
    const variants: DrillRecord['variants'] = {};
    for (const n of HOLE_COUNTS) {
      const v = d.variants[n];
      if (v && Array.isArray(v.holes)) variants[`${n}`] = { holes: v.holes, backdrop: v.backdrop ?? null, photoId: v.photoId ?? null, url: v.url ?? null };
    }
    return { base: d.base, variants };
  }
  const n = Array.isArray(d.holes) ? d.holes.length : 0;
  if (!isHoleCount(n)) return { base: d.base, variants: {} };
  return { base: d.base, variants: { [`${n}`]: { holes: d.holes, backdrop: d.backdrop ?? null, photoId: d.photoId ?? null, url: shapePhotoUrl } } };
}

/** The drilled photo for each hole count that has one: { 1: url, 2: url }. */
export function holePhotos(raw: unknown, shapePhotoUrl: string | null = null): Partial<Record<HoleCount, string>> {
  const drill = readDrill(raw, shapePhotoUrl);
  const out: Partial<Record<HoleCount, string>> = {};
  for (const n of HOLE_COUNTS) {
    const url = drill?.variants[`${n}`]?.url;
    if (url) out[n] = url;
  }
  return out;
}

/** The shape's photo for a chosen number of holes, else its usual photo. */
export function photoForHoles(shape: { refPhotoUrl?: string | null; holePhotos?: Partial<Record<HoleCount, string>> } | undefined, holes: number | null | undefined) {
  if (!shape) return null;
  return (isHoleCount(holes) ? shape.holePhotos?.[holes] : null) || shape.refPhotoUrl || null;
}

export function holesLabel(n: number) {
  return n === 1 ? '1 hole' : `${n} holes`;
}
