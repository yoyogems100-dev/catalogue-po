'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import IconSelect from '@/components/IconSelect';
import ColorSwatch from '@/components/ColorSwatch';
import { COLOR_FAMILIES, colorFamilyId, colorSearchText } from '@/lib/color-family';
import { QUICK_ORDER_COLOR_EVENT } from '@/components/QuickOrderButton';

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

// Names buyers use that aren't in the category name itself. Matched as extra
// words on the category, so "zircon" finds every CZ grade and "pureform" finds
// Lab Grown (the owner's trade name for it).
function categoryAliases(name: string): string {
  const n = name.toLowerCase();
  const extra: string[] = [];
  if (/\bcz\b/.test(n)) extra.push('cubic zirconia zircon');
  if (n.includes('swiz')) extra.push('swiss');
  if (n.includes('crushed ice')) extra.push('ice crush');
  if (n.includes('hole punched')) extra.push('hole punch drilled drill');
  if (n.includes('lab grown')) extra.push('pureform pure form');
  if (n.includes('corundum')) extra.push('corondum');
  if (n.includes('turkey')) extra.push('turkish');
  return extra.join(' ');
}

export default function HomeCatalogue({
  categories,
  allShapes,
  allColors,
  mostOrderedIds
}: {
  categories: Category[];
  allShapes: Ref[];
  allColors: Ref[];
  mostOrderedIds: number[];
}) {
  const [query, setQuery] = useState('');
  const [shapeFilter, setShapeFilter] = useState<number | 'all'>('all');
  const [familyFilter, setFamilyFilter] = useState<number | 'all'>('all');

  const familyByColorId = useMemo(() => {
    const map = new Map<number, number | null>();
    allColors.forEach((c) => map.set(c.id, colorFamilyId(c.name, c.hex)));
    return map;
  }, [allColors]);

  // Only offer families some category actually carries.
  const familyOptions = useMemo(() => {
    const present = new Set<number>();
    categories.forEach((c) => c.colorIds.forEach((id) => { const f = familyByColorId.get(id); if (f) present.add(f); }));
    return COLOR_FAMILIES.filter((f) => present.has(f.id));
  }, [categories, familyByColorId]);

  // Everything a buyer might type about a category, lower-cased once.
  const searchIndex = useMemo(() => {
    const shapeName = new Map(allShapes.map((s) => [s.id, s.name.toLowerCase()]));
    const colorText = new Map(allColors.map((c) => [c.id, colorSearchText(c.name, c.hex)]));
    // Words, not one long string: "red" should match "Ruby Red" but not the
    // middle of "Coloured".
    const words = (text: string) => text.split(/[^a-z0-9]+/).filter(Boolean);
    const index = new Map<number, { name: string[]; all: string[] }>();
    categories.forEach((c) => {
      const name = words(`${c.name.toLowerCase()} ${categoryAliases(c.name)}`);
      const rest = words([...c.shapeIds.map((id) => shapeName.get(id) || ''), ...c.colorIds.map((id) => colorText.get(id) || '')].join(' '));
      index.set(c.id, { name, all: [...name, ...rest] });
    });
    return index;
  }, [categories, allShapes, allColors]);

  const rank = useMemo(() => new Map(mostOrderedIds.map((id, i) => [id, i])), [mostOrderedIds]);

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const matches = categories.filter((c) => {
      if (shapeFilter !== 'all' && !c.shapeIds.includes(shapeFilter)) return false;
      if (familyFilter !== 'all' && !c.colorIds.some((id) => familyByColorId.get(id) === familyFilter)) return false;
      if (tokens.length === 0) return true;
      const { all } = searchIndex.get(c.id)!;
      return tokens.every((t) => all.some((w) => w.startsWith(t)));
    });
    // A category named for the search comes before one that only carries a
    // matching shape or colour; within each, most-ordered first, then catalogue order.
    const nameHit = (c: Category) => tokens.length > 0 && tokens.every((t) => searchIndex.get(c.id)!.name.some((w) => w.startsWith(t)));
    return matches
      .map((c, i) => ({ c, i }))
      .sort((a, b) =>
        Number(nameHit(b.c)) - Number(nameHit(a.c)) ||
        (rank.get(a.c.id) ?? 1e6) - (rank.get(b.c.id) ?? 1e6) ||
        a.i - b.i)
      .map(({ c }) => c);
  }, [categories, query, shapeFilter, familyFilter, familyByColorId, searchIndex, rank]);

  const hasActiveFilter = query.trim() !== '' || shapeFilter !== 'all' || familyFilter !== 'all';
  const clearAll = () => { setQuery(''); setShapeFilter('all'); setFamilyFilter('all'); };

  const mostOrdered = hasActiveFilter ? [] : mostOrderedIds.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c);
  const mostOrderedSet = new Set(mostOrdered.map((c) => c.id));
  const rest = hasActiveFilter ? filtered : categories.filter((c) => !mostOrderedSet.has(c.id));

  const renderGrid = (list: Category[], offset: number, tagMostOrdered: boolean) => (
    <div className="grid-cats">
      {list.map((cat, i) => (
        <CategoryCard key={cat.id} cat={cat} cardIndex={offset + i} mostOrdered={tagMostOrdered && rank.has(cat.id)} />
      ))}
    </div>
  );

  return (
    <>
      <div className="home-search-bar">
        <div className="home-search-input">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3A3F44" strokeWidth="2"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="search" enterKeyHint="search" aria-label="Search stones, shapes or colours" placeholder="Search stones, shapes, colours..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="home-filter-row">
          <IconSelect options={allShapes} value={shapeFilter} onChange={setShapeFilter} allLabel="All shapes" leading="icon" />
          <IconSelect options={familyOptions} value={familyFilter} onChange={setFamilyFilter} allLabel="All colours" leading="swatch" />
          {hasActiveFilter && (
            <button className="btn-ghost" style={{ borderRadius: 20 }} onClick={clearAll}>
              Clear
            </button>
          )}
        </div>
      </div>

      {!hasActiveFilter && familyOptions.length > 0 && (
        <div className="home-color-start">
          <span className="home-color-start-label">Order by colour</span>
          <div className="home-color-chips">
            {familyOptions.map((f) => (
              <button
                key={f.id}
                type="button"
                className="qo-family-chip"
                onClick={() => window.dispatchEvent(new CustomEvent(QUICK_ORDER_COLOR_EVENT, { detail: { familyId: f.id } }))}
              >
                <ColorSwatch hex={f.hex} refPhotoUrl={f.refPhotoUrl} size={22} />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {mostOrdered.length > 0 && (
        <>
          <div className="section-head">
            <h2>Most ordered</h2>
            <span className="count">Our buyers&rsquo; top picks</span>
          </div>
          {renderGrid(mostOrdered, 0, false)}
        </>
      )}

      <div className="section-head" style={mostOrdered.length > 0 ? { marginTop: 36 } : undefined}>
        <h2>{hasActiveFilter ? 'Results' : mostOrdered.length > 0 ? 'More categories' : 'The collection'}</h2>
        <span className="count mono">{hasActiveFilter ? `${filtered.length} of ${categories.length} categories` : `${rest.length} categories`}</span>
      </div>

      {rest.length === 0 ? (
        <div className="home-empty">
          <p>Nothing matches {query.trim() ? <>&ldquo;{query.trim()}&rdquo;</> : 'those filters'}.</p>
          <p className="home-empty-hint">Try a stone (ruby, CZ), a shape (oval, pear) or a colour (blue, pink).</p>
          <button type="button" className="btn-ghost" onClick={clearAll}>Show all categories</button>
        </div>
      ) : renderGrid(rest, mostOrdered.length, hasActiveFilter)}
    </>
  );
}

function CategoryCard({ cat, cardIndex, mostOrdered }: { cat: Category; cardIndex: number; mostOrdered: boolean }) {
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
    <Link href={`/po/category/${cat.slug}`}>
      <div className="cat-card">
        <div className="cat-thumb">
          {/* Painted under the cover, so a missing or failed photo still shows something. */}
          <span className="cat-thumb-initial" aria-hidden="true">{cat.name.charAt(0)}</span>
          {cat.thumb ? <CategoryThumb src={cat.thumb} alt={cat.name} index={cardIndex} /> : null}
          {mostOrdered && <span className="cat-most-ordered">Most ordered</span>}
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
}
