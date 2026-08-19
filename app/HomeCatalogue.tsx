'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import IconSelect from '@/components/IconSelect';

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null };
type Category = {
  id: number;
  num: number;
  name: string;
  slug: string;
  thumb: string | null;
  shapeIds: number[];
  colorIds: number[];
  shapeCount: number;
  colorCount: number;
  sizeCount: number;
  badgeTypes: ('shapes' | 'colors' | 'sizes')[];
};

export default function HomeCatalogue({
  categories,
  allShapes,
  allColors
}: {
  categories: Category[];
  allShapes: Ref[];
  allColors: Ref[];
}) {
  const [query, setQuery] = useState('');
  const [shapeFilter, setShapeFilter] = useState<number | 'all'>('all');
  const [colorFilter, setColorFilter] = useState<number | 'all'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (shapeFilter !== 'all' && !c.shapeIds.includes(shapeFilter)) return false;
      if (colorFilter !== 'all' && !c.colorIds.includes(colorFilter)) return false;
      return true;
    });
  }, [categories, query, shapeFilter, colorFilter]);

  const hasActiveFilter = query.trim() !== '' || shapeFilter !== 'all' || colorFilter !== 'all';

  return (
    <>
      <div className="home-search-bar">
        <div className="home-search-input">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3A3F44" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search categories..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="home-filter-row">
          <IconSelect options={allShapes} value={shapeFilter} onChange={setShapeFilter} allLabel="All shapes" leading="icon" />
          <IconSelect options={allColors} value={colorFilter} onChange={setColorFilter} allLabel="All colors" leading="swatch" />
          {hasActiveFilter && (
            <button className="btn-ghost" style={{ borderRadius: 20 }} onClick={() => { setQuery(''); setShapeFilter('all'); setColorFilter('all'); }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="section-head">
        <h2>The collection</h2>
        <span className="count mono">{filtered.length} of {categories.length} categories</span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#8a8370', border: '1px dashed var(--line)' }}>
          No categories match those filters.
        </div>
      ) : (
        <div className="grid-cats">
          {filtered.map((cat) => {
            const parts = [
              cat.shapeCount > 0 ? `${cat.shapeCount} shape${cat.shapeCount !== 1 ? 's' : ''}` : null,
              cat.sizeCount > 0 ? `${cat.sizeCount} size${cat.sizeCount !== 1 ? 's' : ''}` : null,
              cat.colorCount > 0 ? `${cat.colorCount} color${cat.colorCount !== 1 ? 's' : ''}` : null
            ].filter(Boolean);
            // Which counts show over the thumbnail, and how many, is chosen
            // per category in admin (Categories -> Tags toggles) -- defaults
            // to just shapes, but e.g. a category of loose stones in one
            // shape might make more sense badged by color count instead, or
            // by more than one count at once.
            const badges = cat.badgeTypes
              .map((type) => {
                const count = type === 'colors' ? cat.colorCount : type === 'sizes' ? cat.sizeCount : cat.shapeCount;
                const label = type === 'colors' ? 'color' : type === 'sizes' ? 'size' : 'shape';
                return count > 0 ? `${count} ${label}${count !== 1 ? 's' : ''}` : null;
              })
              .filter(Boolean) as string[];
            return (
              <Link key={cat.id} href={`/category/${cat.slug}`}>
                <div className="cat-card">
                  <div className="cat-thumb">
                    {cat.thumb ? <img src={cat.thumb} alt={cat.name} /> : null}
                    {badges.length > 0 && (
                      <div className="cat-badge-stack">
                        {badges.map((b) => <span key={b} className="cat-badge">{b}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="cat-info">
                    <h3>{cat.name}</h3>
                    {parts.length > 0 && <div className="n">{parts.join(' · ')}</div>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
