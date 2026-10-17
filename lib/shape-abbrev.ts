// Short names for shapes where space is tight (the per-line quantity grid):
// the admin's own code (HS, OS...) first, else the usual trade short form,
// else one made from the name.
const COMMON: Record<string, string> = {
  Round: 'RD', Heart: 'HS', Oval: 'OS', Pear: 'PS', Marquise: 'MQ', Octagon: 'OCT', Cushion: 'CU', Square: 'SQ',
  Princess: 'PR', Trillion: 'TRL', Triangle: 'TRI', Baguette: 'BG', 'Tapered Baguette': 'TB', 'Emerald Cut': 'EM',
  Radiant: 'RAD', Star: 'ST', Asscher: 'AS', Hexagon: 'HEX', Kite: 'KT', Briolette: 'BR', Cabochon: 'CAB'
};

export function shapeAbbrev(name: string, code?: string | null): string {
  if (code?.trim()) return code.trim();
  if (COMMON[name]) return COMMON[name];
  const words = name.replace(/\(.*?\)/g, ' ').split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  return name.slice(0, 3).toUpperCase();
}

/** Short names for a set of shapes; two shapes that would share one keep their full names. */
export function shapeAbbrevs(shapes: { id: number; name: string; shortCode?: string | null }[]): Map<number, string> {
  const short = shapes.map((s) => [s.id, shapeAbbrev(s.name, s.shortCode)] as const);
  const count = new Map<string, number>();
  for (const [, c] of short) count.set(c, (count.get(c) || 0) + 1);
  return new Map(short.map(([id, c]) => [id, (count.get(c) || 0) > 1 ? shapes.find((s) => s.id === id)!.name : c]));
}
