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
