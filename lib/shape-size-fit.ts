// A round stone has one diameter. Sizes such as 3x4 or 5x7 sitting under
// Round and Round Checker were oval sizes filed under the wrong shape
// (owner, 2026-11-03), so a round shape takes a single size (5) or an equal
// pair (5x5) and nothing longer one way than the other.
//
// A square stone has two equal sides, so the same holds for SQ-Octo,
// SQ-Princess and Asscher: 6x9 or 3x5 listed under Square is a rectangle
// size filed under the wrong shape (owner, 2026-11-23).

/** Round, Round Checker, Round (16 Hearts 16 Arrows)... */
export function isRoundShape(name: string | null | undefined): boolean {
  return /^round\b/i.test((name || '').trim());
}

/** SQ-Octo, SQ-Princess, Asscher, Square... -- every side the same length. */
export function isSquareShape(name: string | null | undefined): boolean {
  return /^(sq\b|sq-|square\b|asscher\b)/i.test((name || '').trim());
}

/** False only for a round or square shape given two different dimensions, such as 3x4. */
export function sizeFitsShape(shapeName: string | null | undefined, sizeMm: string | null | undefined): boolean {
  if (!isRoundShape(shapeName) && !isSquareShape(shapeName)) return true;
  const dims = (sizeMm || '').match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return dims.length < 2 || dims.every((d) => d === dims[0]);
}

export const ROUND_SIZE_MESSAGE = 'A round or square stone has one size, like 5 or 5x5. Sizes such as 5x7 belong under Oval, Emerald Cut or another long shape.';

/** The sizes that make sense for their shape; a 6x9 linked under Square is left out. */
export function fittingSizes<S extends { shape_id?: number; shapeId?: number; size_mm?: string; sizeMm?: string }>(
  sizes: S[],
  shapes: { id: number; name: string }[]
): S[] {
  const nameOf = new Map(shapes.map((s) => [s.id, s.name]));
  return sizes.filter((s) => sizeFitsShape(nameOf.get((s.shape_id ?? s.shapeId) as number), s.size_mm ?? s.sizeMm));
}
