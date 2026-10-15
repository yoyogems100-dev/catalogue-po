// Group display-equivalent dimensions without merging catalogue/database IDs.
export function sizeKey(value: string): string {
  const raw = value.trim().replace(/\s*mm\s*$/i, '').replace(/[×*X]/g, 'x').replace(/\s+/g, '');
  return /^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?)*$/.test(raw)
    ? raw.split('x').map(Number).join('x') : raw.toLowerCase();
}
export function groupSizes<T extends { id: number; size_mm: string }>(sizes: T[]) {
  const groups = new Map<string, { key: string; label: string; ids: number[] }>();
  for (const size of sizes) {
    const key = sizeKey(size.size_mm);
    const group = groups.get(key) || { key, label: key, ids: [] };
    group.ids.push(size.id);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => {
    const left = a.key.split('x').map(Number), right = b.key.split('x').map(Number);
    if (left.every(Number.isFinite) && right.every(Number.isFinite)) {
      for (let i = 0; i < Math.min(left.length, right.length); i++) {
        if (left[i] !== right[i]) return left[i] - right[i];
      }
      return left.length - right.length;
    }
    return a.key.localeCompare(b.key, 'en', { numeric: true });
  });
}

// "5mm", "5 mm", "5.0", "5.00", "5x5", "5/5", "5*5", "5 X 5" all name the same
// size; a buyer shouldn't have to guess how the list spells it.
function sizeTokens(value: string): string[] {
  return value.toLowerCase().replace(/mm/g, '').replace(/[×*/\\]/g, 'x').replace(/\s+/g, '').split('x');
}
const squareOf = (dims: number[]) => (dims.length > 1 && dims.every((d) => d === dims[0]) ? [dims[0]] : dims);
const sameDims = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

/**
 * How well a typed size matches a size label: 2 the same size ("5mm" and
 * "5.0 mm", "5/5" and "5x5", "5x5" and a 5 mm round), 1 a start of it ("5"
 * for 5.5 or 5x7, "4x" for 4x6), 0 not at all.
 */
export function sizeSearchScore(query: string, label: string): number {
  const q = sizeTokens(query.trim());
  if (q.length === 1 && !q[0]) return 1;
  const l = sizeTokens(label);
  const qn = q.map(Number), ln = l.map(Number);
  if (q.every((t) => t !== '' && Number.isFinite(Number(t))) && ln.every(Number.isFinite)) {
    if (sameDims(qn, ln) || sameDims(squareOf(qn), squareOf(ln))) return 2;
  }
  if (q.length <= l.length && q.every((t, i) => l[i].startsWith(t) || (t !== '' && Number(t) === Number(l[i])))) return 1;
  return 0;
}
