export type OptionKind = 'color' | 'shape' | 'size' | 'tag';
export type HotFlags = Record<string, boolean>;
export function hotKey(categoryId: number, kind: OptionKind, id: number) {
  return `${categoryId}:${kind}:${id}`;
}
export function isHot(flags: HotFlags, categoryId: number | undefined, kind: OptionKind | undefined, ids: number[]) {
  return !!categoryId && !!kind && ids.some(id => flags[hotKey(categoryId, kind, id)] === true);
}
export function rankOptions<T extends { id: number }>(options: T[], selected: Set<number>, hot: (option: T) => boolean): T[] {
  return [...options].sort((a,b) => Number(hot(b)) - Number(hot(a)) || Number(selected.has(b.id)) - Number(selected.has(a.id)));
}
