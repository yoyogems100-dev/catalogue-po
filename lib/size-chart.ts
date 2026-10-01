// The shape & size chart as shown on the category page (the PDF at
// /api/categories/[id]/size-chart carries the same content): Round first,
// then shapes by name; sizes small to large.

export type SizeChartRow = { size: string; dew: number | null; pcsPerCt: number | null };
export type SizeChartShape = { name: string; image: string | null; rows: SizeChartRow[] };

function compareDimensions(a: string, b: string) {
  const left = a.split('x').map(Number), right = b.split('x').map(Number);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const delta = (left[i] || 0) - (right[i] || 0);
    if (delta) return delta;
  }
  return 0;
}

export function sizeChartSections(
  shapes: { id: number; name: string; refPhotoUrl?: string | null }[],
  sizes: { id: number; shape_id: number; size_mm: string }[],
  pcsPerCt: Map<number, number>,
  dew: Map<number, number>
): SizeChartShape[] {
  return shapes
    .map((s) => ({
      name: s.name,
      image: s.refPhotoUrl || null,
      rows: sizes
        .filter((z) => z.shape_id === s.id)
        .map((z) => ({ size: z.size_mm, dew: dew.get(z.id) ?? null, pcsPerCt: pcsPerCt.get(z.id) ?? null }))
        .sort((a, b) => compareDimensions(a.size, b.size))
    }))
    .filter((s) => s.rows.length)
    .sort((a, b) => (a.name === 'Round' ? -1 : b.name === 'Round' ? 1 : a.name.localeCompare(b.name)));
}
