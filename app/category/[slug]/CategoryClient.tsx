'use client';

import { useMemo, useState } from 'react';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import IconSelect from '@/components/IconSelect';

type Ref = { id: number; name: string; iconKey?: string | null; hex?: string | null };
type Size = { id: number; shape_id: number; size_mm: string };
type Photo = {
  id: number;
  url: string | null;
  shape_id: number | null;
  shape_size_id: number | null;
  color_id: number | null;
  tag_ids: number[];
};

export default function CategoryClient({
  categoryName,
  whatsappNumber,
  shapes,
  colors,
  tags,
  sizes,
  photos
}: {
  categoryName: string;
  whatsappNumber?: string;
  shapes: Ref[];
  colors: Ref[];
  tags: Ref[];
  sizes: Size[];
  photos: Photo[];
}) {
  const [shapeFilter, setShapeFilter] = useState<number | 'all'>('all');
  const [colorFilter, setColorFilter] = useState<number | 'all'>('all');
  const [sizeFilter, setSizeFilter] = useState<number | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<number | 'all'>('all');
  const [lightbox, setLightbox] = useState<number | null>(null);

  const availableSizes = useMemo(
    () => (shapeFilter === 'all' ? sizes : sizes.filter((s) => s.shape_id === shapeFilter)),
    [sizes, shapeFilter]
  );

  const filtered = useMemo(() => {
    return photos.filter((p) => {
      if (shapeFilter !== 'all' && p.shape_id !== shapeFilter) return false;
      if (colorFilter !== 'all' && p.color_id !== colorFilter) return false;
      if (sizeFilter !== 'all' && p.shape_size_id !== sizeFilter) return false;
      if (tagFilter !== 'all' && !p.tag_ids.includes(tagFilter)) return false;
      return true;
    });
  }, [photos, shapeFilter, colorFilter, sizeFilter, tagFilter]);

  function enquiryUrl(photo: Photo) {
    if (!whatsappNumber) return null;
    const shape = shapes.find((s) => s.id === photo.shape_id);
    const size = sizes.find((s) => s.id === photo.shape_size_id);
    const color = colors.find((c) => c.id === photo.color_id);
    const details = [shape?.name, size ? `${size.size_mm}mm` : null, color?.name].filter(Boolean);
    const message = `Hi YOYO GEMS, I'm interested in this stone from ${categoryName}${details.length ? ` (${details.join(', ')})` : ''}.`;
    return buildWhatsAppUrl(whatsappNumber, message);
  }

  return (
    <>
      {(shapes.length > 0 || colors.length > 0 || tags.length > 0) && (
        <div className="filter-bar">
          {shapes.length > 0 && (
            <IconSelect
              options={shapes}
              value={shapeFilter}
              onChange={(v) => { setShapeFilter(v); setSizeFilter('all'); }}
              allLabel="All shapes"
              leading="icon"
            />
          )}
          {availableSizes.length > 0 && (
            <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">All sizes</option>
              {availableSizes.map((s) => <option key={s.id} value={s.id}>{s.size_mm} mm</option>)}
            </select>
          )}
          {colors.length > 0 && (
            <IconSelect options={colors} value={colorFilter} onChange={setColorFilter} allLabel="All colors" leading="swatch" />
          )}
          {tags.length > 0 && (
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
              <option value="all">All tags</option>
              {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <span style={{ fontSize: 12, color: '#8a8370' }}>{filtered.length} of {photos.length} photos</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#8a8370', border: '1px dashed var(--line)' }}>
          No photos match these filters yet.
        </div>
      ) : (
        <div className="grid-photos">
          {filtered.map((p, i) => {
            const waUrl = enquiryUrl(p);
            return (
              <div key={p.id} className="photo-card" onClick={() => setLightbox(i)} style={{ cursor: 'zoom-in' }}>
                {p.url && <img src={p.url} alt="" loading="lazy" />}
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="wa-enquire" onClick={(e) => e.stopPropagation()}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.87 9.87 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.55-3.7 8.21-8.25 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.7-.81-.23-.08-.4-.12-.56.13-.17.25-.65.81-.79.97-.15.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.87.86-.87 2.09 0 1.23.9 2.42 1.02 2.59.12.17 1.77 2.7 4.28 3.79.6.26 1.06.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.16-.48-.28Z"/></svg>
                    <span>Enquire</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightbox !== null && filtered[lightbox] && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,28,0.94)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightbox(null)}
        >
          <img src={filtered[lightbox].url || ''} style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }} />
          <button
            style={{ position: 'fixed', top: 20, right: 26, background: 'none', border: 'none', color: '#fff', fontSize: 30 }}
            onClick={() => setLightbox(null)}
          >
            &times;
          </button>
        </div>
      )}
    </>
  );
}
