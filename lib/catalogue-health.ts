export type CatalogueCoverage = {
  coverUrl: string | null; photoCount: number; shapeCount: number; sizeCount: number; colorCount: number;
};
export const COVERAGE_FILTERS = [
  { key: 'all', label: 'All categories' },
  { key: 'incomplete', label: 'Needs attention' },
  { key: 'photos', label: 'No photos' },
  { key: 'shapes', label: 'No shapes' },
  { key: 'sizes', label: 'No sizes' },
  { key: 'colors', label: 'No colors' },
  { key: 'cover', label: 'No cover' }
] as const;
export type CoverageFilter = typeof COVERAGE_FILTERS[number]['key'];

export function catalogueGaps(row: CatalogueCoverage): string[] {
  return [!row.photoCount && 'photos', !row.shapeCount && 'shapes', !row.sizeCount && 'sizes',
    !row.colorCount && 'colors', !row.coverUrl && 'cover'].filter(Boolean) as string[];
}

export function matchesCoverage(row: CatalogueCoverage, filter: CoverageFilter): boolean {
  const gaps = catalogueGaps(row);
  return filter === 'all' || (filter === 'incomplete' ? gaps.length > 0 : gaps.includes(filter));
}
