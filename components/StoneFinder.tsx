'use client';

import { useMemo, useState } from 'react';
import IconSelect from './IconSelect';
import { categoryIconUrl } from '@/lib/category-icons';
import { groupByMaterial, matchCategories, sizesFor, type CatalogueMap, type MapQuery } from '@/lib/catalogue-map';

/**
 * "Which stones come in this colour and size?" Shape and size pickers over
 * the whole catalogue (narrowed to the colour already chosen), then every
 * matching stone grouped under its material. Quick Order uses it before a
 * category is chosen; the admin Catalogue map uses it as a buyer preview.
 */
export default function StoneFinder({
  map,
  colorId = null,
  familyId = null,
  onChoose
}: {
  map: CatalogueMap;
  colorId?: number | null;
  familyId?: number | null;
  /** Called with the stone and the shape/size the buyer had narrowed to. */
  onChoose?: (categoryId: number, picked: { shapeId: number | null; size: string | null }) => void;
}) {
  const [shapeId, setShapeId] = useState<number | null>(null);
  const [size, setSize] = useState<string | null>(null);

  const byColor = useMemo(() => matchCategories(map, { colorId, familyId }), [map, colorId, familyId]);
  const shapeOptions = useMemo(() => {
    const carried = new Set(byColor.flatMap((c) => c.shapeIds));
    return map.shapes.filter((s) => carried.has(s.id));
  }, [map, byColor]);
  const byShape = useMemo(() => (shapeId ? matchCategories(map, { colorId, familyId, shapeId }) : byColor), [map, byColor, colorId, familyId, shapeId]);
  const sizeOptions = useMemo(() => (shapeId ? sizesFor(map, byShape, shapeId) : []), [map, byShape, shapeId]);
  const query: MapQuery = { colorId, familyId, shapeId, size };
  const groups = useMemo(() => groupByMaterial(map, matchCategories(map, query)), [map, colorId, familyId, shapeId, size]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = groups.reduce((n, g) => n + g.categories.length, 0);

  return (
    <div className="stone-finder">
      <div className="stone-finder-fields">
        <div>
          <label className="po-label">Shape</label>
          <IconSelect
            options={shapeOptions.map((s) => ({ id: s.id, name: s.name, refPhotoUrl: s.refPhotoUrl }))}
            value={shapeId ?? 'all'}
            onChange={(v) => { setShapeId(v === 'all' ? null : v); setSize(null); }}
            allLabel="Any shape"
            leading="icon"
            searchable
          />
        </div>
        <div>
          <label className="po-label">Size (mm)</label>
          <IconSelect
            options={sizeOptions.map((s, i) => ({ id: i + 1, name: s.label }))}
            value={size ? sizeOptions.findIndex((s) => s.key === size) + 1 || 'all' : 'all'}
            onChange={(v) => setSize(v === 'all' ? null : sizeOptions[v - 1]?.key ?? null)}
            allLabel={shapeId ? 'Any size' : 'Pick a shape first'}
            leading="none"
            searchable
          />
        </div>
      </div>
      <p className="stone-finder-count">
        {total === 0 ? 'No stone carries this combination yet.' : `${total} stone${total === 1 ? '' : 's'} come${total === 1 ? 's' : ''} in this`}
      </p>
      {groups.map((g) => (
        <div className="stone-finder-group" key={g.material?.id ?? 'other'}>
          <span className="stone-finder-material">{g.material?.name ?? (map.materials.length ? 'Other stones' : 'Stones')}</span>
          <div className="stone-finder-stones">
            {g.categories.map((c) => {
              const icon = categoryIconUrl(c.slug);
              return (
                <button key={c.id} type="button" className="stone-chip" disabled={!onChoose} onClick={() => onChoose?.(c.id, { shapeId, size })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {icon && <img src={icon} alt="" width={22} height={22} loading="lazy" />}
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
