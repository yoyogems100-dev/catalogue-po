import { isRoundShape, isSquareShape } from './shape-size-fit';

// How a size reads in the admin order builder (owner, 2026-11-23):
//   round shapes -> one diameter with two decimals: "3.00 mm"
//   square-sided shapes -> both sides: "3 x 3", never "3" next to "3x3"
//   anything longer one way -> "6 x 8"
// The stored size_mm is untouched; this is display only.

/** Old cuts that are round too, beyond the Round* names. */
const ROUND_LIKE = /^(old european|old mine|portuguese|rivoli)\b/i;
/** Shapes whose plain "3" means a 3 x 3 stone. */
const EVEN_SIDED = /^(cushion(?! elongated)|heart|cabochon heart|trillion|triangle)\b/i;

export type SizeGeometry = 'round' | 'square' | 'other';

export function sizeGeometry(shapeName: string | null | undefined): SizeGeometry {
  const name = (shapeName || '').trim();
  if (isRoundShape(name) || ROUND_LIKE.test(name)) return 'round';
  if (isSquareShape(name) || EVEN_SIDED.test(name)) return 'square';
  return 'other';
}

/** [3] for "3", "3.0", "3 mm"; [6, 8] for "6x8", "6 X 8", "6*8"; null for text. */
export function sizeDims(sizeMm: string | null | undefined): number[] | null {
  const raw = (sizeMm || '').trim().replace(/\s*mm\s*$/i, '').replace(/[×*X/]/g, 'x').replace(/\s+/g, '');
  if (!/^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)*$/.test(raw)) return null;
  return raw.split('x').map(Number);
}

const num = (n: number) => String(Number(n.toFixed(3)));
const collapse = (dims: number[]) => (dims.length > 1 && dims.every((d) => d === dims[0]) ? [dims[0]] : dims);

/** One key for every spelling of the same size: "3", "3.00" and "3x3" are all "3". */
export function sameSizeKey(sizeMm: string): string {
  const dims = sizeDims(sizeMm);
  return dims ? collapse(dims).map(num).join('x') : sizeMm.trim().toLowerCase();
}

/** "3.00 mm" under Round, "3 x 3" under Square or Cushion, "6 x 8" under Oval. */
export function shapeSizeLabel(shapeName: string | null | undefined, sizeMm: string): string {
  const dims = sizeDims(sizeMm);
  if (!dims) return sizeMm.trim();
  const even = collapse(dims);
  const geometry = sizeGeometry(shapeName);
  if (even.length === 1) {
    if (geometry === 'round') return `${even[0].toFixed(2)} mm`;
    if (geometry === 'square') return `${num(even[0])} x ${num(even[0])}`;
    return `${num(even[0])} mm`;
  }
  return dims.map(num).join(' x ');
}

/**
 * The label for a size offered across several shapes at once: their shared
 * label when they agree ("3.00 mm" for Round + Round Checker), otherwise a
 * neutral one ("3 mm") rather than either shape's way of writing it.
 */
export function groupSizeLabel(rows: { shapeName?: string | null; sizeMm: string }[]): string {
  const labels = [...new Set(rows.map((r) => shapeSizeLabel(r.shapeName, r.sizeMm)))];
  if (labels.length === 1) return labels[0];
  const dims = sizeDims(rows[0]?.sizeMm || '');
  if (!dims) return (rows[0]?.sizeMm || '').trim();
  const even = collapse(dims);
  return even.length === 1 ? `${num(even[0])} mm` : dims.map(num).join(' x ');
}
