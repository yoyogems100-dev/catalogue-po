'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import IconSelect from '@/components/IconSelect';

// Covers hosted on Google Drive (photos.drive_id) are hotlinked from
// lh3.googleusercontent.com, which starts returning 429 when a page asks for
// too many at once. Asking for all 42 covers on load reliably tripped that
// limit and left ~17 cards showing a broken-image icon.
//
// Only the first row or two is on screen at 390px, so those load eagerly and
// the rest wait until they are scrolled to -- same split the reference
// carousel uses. That keeps the opening burst small enough to stay under the
// limit without making the visible cards wait for an observer to fire.
//
// A cover that fails anyway unmounts rather than rendering torn alt text:
// .cat-thumb already paints a neutral grey box and the category name sits
// directly below it.
const EAGER_COVERS = 6;

function CategoryThumb({ src, alt, index }: { src: string; alt: string; index: number }) {
  const [failed, setFailed] = useState(false);
  const img = useRef<HTMLImageElement>(null);

  // onError alone misses the fastest failures: a 429 can come back while the
  // browser is still parsing the server-rendered HTML, which is before React
  // hydrates and attaches the handler, so the event is simply never seen. An
  // <img> in that state reports complete with a naturalWidth of 0 -- check for
  // it once on mount so those covers fall back too.
  useEffect(() => {
    const el = img.current;
    if (el?.complete && el.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;
  return (
    <img
      ref={img}
      src={src}
      alt={alt}
      loading={index < EAGER_COVERS ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null; refPhotoUrl?: string | null };
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
        <div style={{ padding: 60, textAlign: 'center', color: '#756e5c', border: '1px dashed var(--line)' }}>
          No categories match those filters.
        </div>
      ) : (
        <div className="grid-cats">
          {filtered.map((cat, cardIndex) => {
            // One tag, not the same counts twice. The card used to badge
            // counts over the thumbnail AND repeat all three as text under the
            // name. Worse, a count of 1 tells a buyer nothing -- "1 shape" on a
            // round-only category is noise where "24 colours" is the reason to
            // open it.
            //
            // Admin's explicit choice wins where it says something (count > 1);
            // otherwise the card shows whichever dimension this category has
            // most of.
            const dimensions = [
              { type: 'shapes' as const, count: cat.shapeCount, one: 'shape', many: 'shapes' },
              { type: 'sizes' as const, count: cat.sizeCount, one: 'size', many: 'sizes' },
              { type: 'colors' as const, count: cat.colorCount, one: 'colour', many: 'colours' }
            ];
            const informative = dimensions.filter((d) => d.count > 1);
            const chosen = informative.filter((d) => cat.badgeTypes.includes(d.type));
            const best = (chosen.length ? chosen : informative)
              .slice()
              .sort((a, b) => b.count - a.count)
              .slice(0, chosen.length ? chosen.length : 1);
            const badges = best.map((d) => `${d.count} ${d.count === 1 ? d.one : d.many}`);
            return (
              <Link key={cat.id} href={`/category/${cat.slug}`}>
                <div className="cat-card">
                  <div className="cat-thumb">
                    {cat.thumb ? <CategoryThumb src={cat.thumb} alt={cat.name} index={cardIndex} /> : null}
                    {badges.length > 0 && (
                      <div className="cat-badge-stack">
                        {badges.map((b) => <span key={b} className="cat-badge">{b}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="cat-info">
                    <h3>{cat.name}</h3>
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
