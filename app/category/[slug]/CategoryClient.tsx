'use client';

import { useMemo, useRef, useState } from 'react';
import { useHotSelling } from '@/components/HotSelling';
import { isHot } from '@/lib/hot-selling';
import IconSelect from '@/components/IconSelect';
import { groupSizes } from '@/lib/size-options';
import { buildPhotoGroups } from '@/lib/photo-groups';
import ProductSheet, { type SheetPhoto } from '@/components/ProductSheet';
import type { CategoryPricing } from '@/lib/pricing-calc';

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null; refPhotoUrl?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };
type Photo = SheetPhoto;

export default function CategoryClient({
  categoryId,
  categoryName,
  shapes,
  colors,
  tags,
  sizes,
  photos,
  pricing,
  priceUnit,
  onRaiseOrder
}: {
  categoryId: number;
  categoryName: string;
  shapes: Ref[];
  colors: Ref[];
  tags: Ref[];
  sizes: Size[];
  photos: Photo[];
  pricing?: CategoryPricing;
  priceUnit?: string | null;
  onRaiseOrder?: () => void;
}) {
  const { flags } = useHotSelling();

  const [shapeFilter, setShapeFilter] = useState<number | 'all'>('all');
  const [colorFilter, setColorFilter] = useState<number | 'all'>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const availableSizes = useMemo(
    () => groupSizes(shapeFilter === 'all' ? sizes : sizes.filter((s) => s.shape_id === shapeFilter)),
    [sizes, shapeFilter]
  );

  // A group's angles are shown inside its own card, never as cards of their
  // own, so the grid is one card per stone. The lead carries the tags, so the
  // filters run on the lead -- an angle is never filtered away from its group.
  const groups = useMemo(() => buildPhotoGroups(photos), [photos]);

  const filtered = useMemo(() => {
    return groups.filter(({ lead }) => {
      if (shapeFilter !== 'all' && !lead.shapeIds.includes(shapeFilter)) return false;
      if (colorFilter !== 'all' && !lead.colorIds.includes(colorFilter)) return false;
      if (sizeFilter !== 'all' && !availableSizes.find((size) => size.key === sizeFilter)?.ids.some((id) => lead.sizeIds.includes(id))) return false;
      if (tagFilter !== 'all' && !lead.tag_ids.includes(tagFilter)) return false;
      return true;
    });
  }, [groups, shapeFilter, colorFilter, sizeFilter, tagFilter, availableSizes]);

  // Precompute id -> name lookups once instead of a linear .find() per id per
  // photo, and cache each lead's details string once instead of rebuilding it
  // on every render of the grid.
  const shapeNameById = useMemo(() => new Map(shapes.map((s) => [s.id, s.name])), [shapes]);
  const sizeMmById = useMemo(() => new Map(sizes.map((s) => [s.id, s.size_mm])), [sizes]);
  const colorNameById = useMemo(() => new Map(colors.map((c) => [c.id, c.name])), [colors]);
  const tagNameById = useMemo(() => new Map(tags.map((t) => [t.id, t.name])), [tags]);
  const detailsByPhotoId = useMemo(() => {
    const map = new Map<number, string>();
    for (const photo of photos) {
      const shapeNames = photo.shapeIds.map((id) => shapeNameById.get(id)).filter(Boolean);
      const sizeNames = photo.sizeIds.map((id) => sizeMmById.get(id)).filter(Boolean).map((mm) => `${mm}mm`);
      const colorNames = photo.colorIds.map((id) => colorNameById.get(id)).filter(Boolean);
      const specNames = photo.tag_ids.map((id) => tagNameById.get(id)).filter(Boolean);
      map.set(photo.id, [...shapeNames, ...sizeNames, ...colorNames, ...specNames].join(', '));
    }
    return map;
  }, [photos, shapeNameById, sizeMmById, colorNameById, tagNameById]);

  function openSheet(index: number, trigger: HTMLElement | null) {
    lastTriggerRef.current = trigger;
    setOpenIndex(index);
  }
  function closeSheet() {
    setOpenIndex(null);
    lastTriggerRef.current?.focus();
  }
  function stepSheet(delta: number) {
    setOpenIndex((current) => {
      if (current === null) return current;
      return (current + delta + filtered.length) % filtered.length;
    });
  }

  const photoCount = photos.length;

  return (
    <>
      {(shapes.length > 0 || colors.length > 0 || tags.length > 0) && (
        <div className="filter-bar">
          {shapes.length > 0 && (
            <IconSelect
              categoryId={categoryId}
              options={shapes}
              value={shapeFilter}
              onChange={(v) => { setShapeFilter(v); setSizeFilter('all'); }}
              allLabel="All shapes"
              leading="icon"
            />
          )}
          {availableSizes.length > 0 && (
            <select aria-label="Filter by size" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
              <option value="all">All sizes</option>
              {[...availableSizes].sort((a,b) => Number(isHot(flags,categoryId,'size',b.ids))-Number(isHot(flags,categoryId,'size',a.ids))).map((s) => <option key={s.key} value={s.key}>{isHot(flags,categoryId,'size',s.ids) ? '🔥 ' : ''}{s.label} mm</option>)}
            </select>
          )}
          {colors.length > 0 && (
            <IconSelect categoryId={categoryId} options={colors} value={colorFilter} onChange={setColorFilter} allLabel="All colors" leading="swatch" />
          )}
          {tags.length > 0 && (
            <select aria-label="Filter by specification" value={tagFilter} onChange={(e) => setTagFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">All specifications</option>
              {[...tags].sort((a,b) => Number(isHot(flags,categoryId,'tag',[b.id]))-Number(isHot(flags,categoryId,'tag',[a.id]))).map((t) => <option key={t.id} value={t.id}>{isHot(flags,categoryId,'tag',[t.id]) ? '🔥 ' : ''}{t.name}</option>)}
            </select>
          )}
          <span style={{ fontSize: 12, color: '#756e5c' }}>
            {filtered.length} of {groups.length} {groups.length === 1 ? 'product' : 'products'}
            {photoCount !== groups.length ? ` · ${photoCount} photos` : ''}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#756e5c', border: '1px dashed var(--line)' }}>
          No photos match these filters yet.
        </div>
      ) : (
        <div className="grid-products">
          {filtered.map((group, i) => (
            <ProductCard
              key={group.lead.id}
              group={group}
              details={detailsByPhotoId.get(group.lead.id) || ''}
              onOpen={(trigger) => openSheet(i, trigger)}
            />
          ))}
        </div>
      )}

      {openIndex !== null && filtered[openIndex] && (
        <ProductSheet
          key={filtered[openIndex].lead.id}
          categoryId={categoryId}
          categoryName={categoryName}
          group={filtered[openIndex]}
          shapes={shapes}
          colors={colors}
          tags={tags}
          sizes={sizes}
          pricing={pricing}
          priceUnit={priceUnit}
          position={{ index: openIndex, total: filtered.length }}
          onClose={closeSheet}
          onStep={stepSheet}
          onRaiseOrder={onRaiseOrder}
        />
      )}
    </>
  );
}

/** One stone in the grid: its cover, swipeable in place through the group's
 *  other angles, and a tap anywhere opens the full product sheet. */
function ProductCard({
  group,
  details,
  onOpen
}: {
  group: { lead: Photo; media: Photo[] };
  details: string;
  onOpen: (trigger: HTMLElement | null) => void;
}) {
  const { lead, media } = group;
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<{ x: number; y: number } | null>(null);

  // Swiping the card's photo strip must not be read as a tap on the card. A
  // pointer that travelled more than a few pixels was a swipe or a scroll, and
  // only a real tap opens the sheet.
  function onPointerDown(e: React.PointerEvent) {
    pressRef.current = { x: e.clientX, y: e.clientY };
  }
  function onClick(e: React.MouseEvent<HTMLElement>) {
    const press = pressRef.current;
    pressRef.current = null;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) return;
    onOpen(e.currentTarget);
  }

  function onScroll() {
    const el = trackRef.current;
    if (!el || media.length < 2) return;
    const width = el.clientWidth || 1;
    setActive(Math.max(0, Math.min(media.length - 1, Math.round(el.scrollLeft / width))));
  }

  return (
    <article
      className="product-card"
      role="button"
      tabIndex={0}
      aria-label={details ? `${details} — open product details` : 'Open product details'}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(e.currentTarget); }
      }}
    >
      <div className="product-card-media" ref={trackRef} onScroll={onScroll}>
        {media.map((photo, i) => (
          <div className="product-card-slide" key={photo.id}>
            {photo.url && <img src={photo.url} alt={i === 0 ? (details || 'Product photo') : ''} loading={i === 0 ? 'lazy' : 'lazy'} />}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          <span className="product-card-count" aria-hidden="true">{active + 1}/{media.length}</span>
          <span className="product-card-dots" aria-hidden="true">
            {media.map((photo, i) => <i key={photo.id} className={i === active ? 'on' : ''} />)}
          </span>
        </>
      )}
      {/* Always rendered, even with nothing to say: cards in a row stretch to
          a common height, so dropping the caption area on an untagged photo
          only moves the blank space above it and makes the row look ragged. */}
      <div className="product-card-foot">
        {lead.productCode?.trim() && <strong>{lead.productCode}</strong>}
        {details && <span>{details}</span>}
      </div>
    </article>
  );
}
