export type OptionKind = 'color' | 'shape' | 'size' | 'tag';
export type HotFlags = Record<string, boolean>;
export function isHot(flags: HotFlags, kind: OptionKind | undefined, ids: number[]) {
  return !!kind && ids.some(id => flags[`${kind}:${id}`] === true);
}
export function rankOptions<T extends { id: number }>(options: T[], selected: Set<number>, hot: (option: T) => boolean): T[] {
  return [...options].sort((a,b) => Number(hot(b)) - Number(hot(a)) || Number(selected.has(b.id)) - Number(selected.has(a.id)));
}
