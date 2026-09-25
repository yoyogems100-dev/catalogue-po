'use client';

import { useMemo, useState } from 'react';
import IconSelect from '@/components/IconSelect';
import ColorSwatch from '@/components/ColorSwatch';
import StoneFinder from '@/components/StoneFinder';
import { categoryIconUrl } from '@/lib/category-icons';
import { COLOR_FAMILIES } from '@/lib/color-family';
import { sizeKey } from '@/lib/size-options';
import { compareSizeKeys, groupByMaterial, type CatalogueMap, type MapCategory } from '@/lib/catalogue-map';

type Tab = 'colour' | 'size' | 'materials' | 'preview';

async function send(url: string, method: 'POST' | 'DELETE' | 'PATCH', body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Could not save (${res.status}).`);
  return data;
}

/**
 * One place to see and change what goes with what. Colours, shapes and sizes
 * are linked to categories; categories sit under materials. Each tab starts
 * from a different side of the same links: pick a colour and tick the stones
 * that carry it, pick a size and tick the stones cut in it, or arrange stones
 * under materials. Every tick saves straight away.
 */
export default function CatalogueMapClient({ initialMap, materialsReady }: { initialMap: CatalogueMap; materialsReady: boolean }) {
  const [map, setMap] = useState(initialMap);
  const [tab, setTab] = useState<Tab>('colour');
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function updateCategory(id: number, patch: (c: MapCategory) => MapCategory) {
    setMap((m) => ({ ...m, categories: m.categories.map((c) => (c.id === id ? patch(c) : c)) }));
  }

  async function run(key: string, work: () => Promise<void>, done: string) {
    setBusy(key);
    setStatus(null);
    try {
      await work();
      setStatus({ tone: 'ok', text: done });
    } catch (e) {
      setStatus({ tone: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const tabs: [Tab, string][] = [['colour', 'By colour'], ['size', 'By size'], ['materials', 'Materials'], ['preview', 'Buyer preview']];

  return (
    <div className="catmap">
      <div className="cat-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`cat-tab${tab === id ? ' active' : ''}`} onClick={() => { setTab(id); setStatus(null); }}>
            {label}
          </button>
        ))}
      </div>
      {status && <p role="status" className={`catmap-status ${status.tone}`}>{status.text}</p>}
      {tab === 'colour' && <ColourTab map={map} busy={busy} run={run} updateCategory={updateCategory} />}
      {tab === 'size' && <SizeTab map={map} busy={busy} run={run} updateCategory={updateCategory} />}
      {tab === 'materials' && <MaterialsTab map={map} setMap={setMap} busy={busy} run={run} ready={materialsReady} />}
      {tab === 'preview' && <PreviewTab map={map} />}
    </div>
  );
}

type TabProps = {
  map: CatalogueMap;
  busy: string | null;
  run: (key: string, work: () => Promise<void>, done: string) => Promise<void>;
  updateCategory: (id: number, patch: (c: MapCategory) => MapCategory) => void;
};

/** Every category, grouped by material, as tickable chips. */
function StoneChecklist({ map, isOn, onToggle, busyKey, busy }: {
  map: CatalogueMap;
  isOn: (c: MapCategory) => boolean;
  onToggle: (c: MapCategory, on: boolean) => void;
  busyKey: (c: MapCategory) => string;
  busy: string | null;
}) {
  const groups = groupByMaterial(map, map.categories);
  return (
    <div className="catmap-groups">
      {groups.map((g) => {
        const onCount = g.categories.filter(isOn).length;
        return (
          <section key={g.material?.id ?? 'other'} className="catmap-group">
            <header>
              <span className="stone-finder-material">{g.material?.name ?? (map.materials.length ? 'Not under a material' : 'All stones')}</span>
              <span className="catmap-count">{onCount} of {g.categories.length}</span>
            </header>
            <div className="stone-finder-stones">
              {g.categories.map((c) => {
                const on = isOn(c);
                const icon = categoryIconUrl(c.slug);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`stone-chip toggle${on ? ' on' : ''}`}
                    aria-pressed={on}
                    disabled={busy === busyKey(c)}
                    onClick={() => onToggle(c, !on)}
                  >
                    <span className="stone-chip-tick" aria-hidden="true">{on ? '✓' : '+'}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {icon && <img src={icon} alt="" width={22} height={22} loading="lazy" />}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ColourTab({ map, busy, run, updateCategory }: TabProps) {
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [colorId, setColorId] = useState<number | null>(null);
  const colours = familyId ? map.colors.filter((c) => c.familyId === familyId) : map.colors;
  const color = map.colors.find((c) => c.id === colorId) || null;
  const carriedBy = color ? map.categories.filter((c) => c.colorIds.includes(color.id)).length : 0;

  function toggle(cat: MapCategory, on: boolean) {
    if (!color) return;
    if (!on && !window.confirm(`Remove ${color.name} from ${cat.name}? Buyers will no longer be able to pick it there. Past orders are not affected.`)) return;
    void run(`c${cat.id}`, async () => {
      await send('/api/category-links/color', on ? 'POST' : 'DELETE', { category_id: cat.id, color_id: color.id });
      updateCategory(cat.id, (c) => ({ ...c, colorIds: on ? [...c.colorIds, color.id] : c.colorIds.filter((id) => id !== color.id) }));
    }, on ? `${color.name} added to ${cat.name}.` : `${color.name} removed from ${cat.name}.`);
  }

  return (
    <>
      <p className="catmap-hint">Pick a colour, then tick every stone that comes in it. Untick to take it away.</p>
      <div className="catmap-families" role="group" aria-label="Colour family">
        <button type="button" className={`qo-family-chip${familyId === null ? ' active' : ''}`} onClick={() => setFamilyId(null)}>All colours</button>
        {COLOR_FAMILIES.map((f) => (
          <button key={f.id} type="button" className={`qo-family-chip${familyId === f.id ? ' active' : ''}`} onClick={() => { setFamilyId(f.id); setColorId(null); }}>
            <ColorSwatch hex={f.hex} refPhotoUrl={f.refPhotoUrl} size={20} />
            {f.name}
          </button>
        ))}
      </div>
      <div className="catmap-picker">
        <label className="po-label">Colour ({colours.length})</label>
        <IconSelect
          options={colours.map((c) => ({ id: c.id, name: c.name, hex: c.hex, refPhotoUrl: c.refPhotoUrl }))}
          value={colorId ?? 'all'}
          onChange={(v) => setColorId(v === 'all' ? null : v)}
          allLabel="Choose a colour"
          leading="swatch"
          searchable
        />
      </div>
      {color && (
        <>
          <div className="catmap-subject">
            <ColorSwatch hex={color.hex || '#ccc'} refPhotoUrl={color.refPhotoUrl} size={36} />
            <div>
              <strong>{color.name}</strong>
              <span>{carriedBy === 0 ? 'No stone carries it yet' : `Carried by ${carriedBy} stone${carriedBy === 1 ? '' : 's'}`}</span>
            </div>
          </div>
          <StoneChecklist map={map} busy={busy} busyKey={(c) => `c${c.id}`} isOn={(c) => c.colorIds.includes(color.id)} onToggle={toggle} />
        </>
      )}
    </>
  );
}

function SizeTab({ map, busy, run, updateCategory }: TabProps) {
  const [shapeId, setShapeId] = useState<number | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const shape = map.shapes.find((s) => s.id === shapeId) || null;

  // Every size this shape is cut in anywhere in the master list.
  const sizeGroups = useMemo(() => {
    const groups = new Map<string, number[]>();
    map.sizes.filter((s) => s.shapeId === shapeId).forEach((s) => {
      const key = sizeKey(s.sizeMm);
      groups.set(key, [...(groups.get(key) || []), s.id]);
    });
    return [...groups.entries()].sort((a, b) => compareSizeKeys(a[0], b[0])).map(([key, ids]) => ({ key, ids: ids.sort((x, y) => x - y) }));
  }, [map.sizes, shapeId]);
  const sizeIds = sizeGroups.find((g) => g.key === size)?.ids || [];
  const carriedBy = map.categories.filter((c) => c.sizeIds.some((id) => sizeIds.includes(id))).length;

  function toggle(cat: MapCategory, on: boolean) {
    if (!shape || !size || sizeIds.length === 0) return;
    const label = `${shape.name} ${size} mm`;
    if (!on && !window.confirm(`Remove ${label} from ${cat.name}? Buyers will no longer be able to pick it there. Past orders are not affected.`)) return;
    void run(`s${cat.id}`, async () => {
      if (on) {
        // A size only shows once its shape is linked too.
        if (!cat.shapeIds.includes(shape.id)) await send('/api/category-links/shape', 'POST', { category_id: cat.id, shape_id: shape.id });
        await send('/api/category-links/size', 'POST', { category_id: cat.id, shape_size_id: sizeIds[0] });
        updateCategory(cat.id, (c) => ({
          ...c,
          shapeIds: c.shapeIds.includes(shape.id) ? c.shapeIds : [...c.shapeIds, shape.id],
          sizeIds: [...c.sizeIds, sizeIds[0]]
        }));
      } else {
        for (const id of sizeIds.filter((sid) => cat.sizeIds.includes(sid))) {
          await send('/api/category-links/size', 'DELETE', { category_id: cat.id, shape_size_id: id });
        }
        updateCategory(cat.id, (c) => ({ ...c, sizeIds: c.sizeIds.filter((id) => !sizeIds.includes(id)) }));
      }
    }, on ? `${label} added to ${cat.name}.` : `${label} removed from ${cat.name}.`);
  }

  return (
    <>
      <p className="catmap-hint">Pick a shape and size, then tick every stone that is cut in it. Adding a size also adds its shape to that stone.</p>
      <div className="stone-finder-fields">
        <div>
          <label className="po-label">Shape</label>
          <IconSelect
            options={map.shapes.map((s) => ({ id: s.id, name: s.name, refPhotoUrl: s.refPhotoUrl }))}
            value={shapeId ?? 'all'}
            onChange={(v) => { setShapeId(v === 'all' ? null : v); setSize(null); }}
            allLabel="Choose a shape"
            leading="icon"
            searchable
          />
        </div>
        <div>
          <label className="po-label">Size (mm)</label>
          <IconSelect
            options={sizeGroups.map((g, i) => ({ id: i + 1, name: `${g.key} mm` }))}
            value={size ? sizeGroups.findIndex((g) => g.key === size) + 1 || 'all' : 'all'}
            onChange={(v) => setSize(v === 'all' ? null : sizeGroups[v - 1]?.key ?? null)}
            allLabel={shape ? 'Choose a size' : 'Pick a shape first'}
            leading="none"
            searchable
          />
        </div>
      </div>
      {shape && size && (
        <>
          <div className="catmap-subject">
            <div>
              <strong>{shape.name} · {size} mm</strong>
              <span>{carriedBy === 0 ? 'No stone is cut in this yet' : `Cut in ${carriedBy} stone${carriedBy === 1 ? '' : 's'}`}</span>
            </div>
          </div>
          <StoneChecklist map={map} busy={busy} busyKey={(c) => `s${c.id}`} isOn={(c) => c.sizeIds.some((id) => sizeIds.includes(id))} onToggle={toggle} />
        </>
      )}
      {shape && sizeGroups.length === 0 && <p className="catmap-hint">No sizes exist for {shape.name} yet. Add them on the Shapes page first.</p>}
    </>
  );
}

function MaterialsTab({ map, setMap, busy, run, ready }: {
  map: CatalogueMap;
  setMap: React.Dispatch<React.SetStateAction<CatalogueMap>>;
  busy: string | null;
  run: TabProps['run'];
  ready: boolean;
}) {
  const [newName, setNewName] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const materials = [...map.materials].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const underNone = map.categories.filter((c) => !map.materials.some((m) => m.categoryIds.includes(c.id)));

  if (!ready) {
    return <p className="catmap-hint">Materials need a one-time database update before they can be used. Colours and sizes above work already.</p>;
  }

  function add() {
    const name = newName.trim();
    if (!name) return;
    void run('new', async () => {
      const { material } = await send('/api/admin/materials', 'POST', { name });
      setMap((m) => ({ ...m, materials: [...m.materials, { id: material.id, name: material.name, sortOrder: material.sort_order, categoryIds: [] }] }));
      setNewName('');
      setOpenId(material.id);
    }, `${name} added. Now tick the stones that belong to it.`);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= materials.length) return;
    const order = materials.map((m) => m.id);
    [order[index], order[target]] = [order[target], order[index]];
    void run('order', async () => {
      await send('/api/admin/materials', 'PATCH', { order });
      setMap((m) => ({ ...m, materials: m.materials.map((mat) => ({ ...mat, sortOrder: order.indexOf(mat.id) + 1 })) }));
    }, 'Order saved.');
  }

  function rename(id: number, current: string) {
    const name = window.prompt('Rename material', current)?.trim();
    if (!name || name === current) return;
    void run(`m${id}`, async () => {
      await send('/api/admin/materials', 'PATCH', { id, name });
      setMap((m) => ({ ...m, materials: m.materials.map((mat) => (mat.id === id ? { ...mat, name } : mat)) }));
    }, `Renamed to ${name}.`);
  }

  function remove(id: number, name: string) {
    if (!window.confirm(`Delete the material ${name}? Its stones stay exactly as they are; they just stop being grouped under ${name}.`)) return;
    void run(`m${id}`, async () => {
      await send('/api/admin/materials', 'DELETE', { id });
      setMap((m) => ({ ...m, materials: m.materials.filter((mat) => mat.id !== id) }));
    }, `${name} deleted.`);
  }

  function toggle(materialId: number, cat: MapCategory, on: boolean) {
    void run(`mc${materialId}-${cat.id}`, async () => {
      await send('/api/admin/materials/categories', on ? 'POST' : 'DELETE', { material_id: materialId, category_id: cat.id });
      setMap((m) => ({
        ...m,
        materials: m.materials.map((mat) => (mat.id !== materialId ? mat : {
          ...mat, categoryIds: on ? [...mat.categoryIds, cat.id] : mat.categoryIds.filter((id) => id !== cat.id)
        }))
      }));
    }, on ? `${cat.name} added.` : `${cat.name} taken out.`);
  }

  return (
    <>
      <p className="catmap-hint">
        A material groups stones: Ruby → Ruby Corundum, Ruby Chatham, Ruby Foil Pota… A stone can sit under more than one material.
        Each stone keeps its own shapes, sizes, colours, photos and prices on its category page.
      </p>
      <form className="catmap-new" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New material, e.g. Ruby" aria-label="New material name" maxLength={80} />
        <button type="submit" className="btn" disabled={!newName.trim() || busy === 'new'}>Add material</button>
      </form>

      {materials.length === 0 && <p className="catmap-hint">No materials yet. Add one above.</p>}
      <div className="catmap-materials">
        {materials.map((mat, i) => {
          const cats = map.categories.filter((c) => mat.categoryIds.includes(c.id));
          const colours = new Set(cats.flatMap((c) => c.colorIds)).size;
          const sizes = new Set(cats.flatMap((c) => c.sizeIds)).size;
          const isOpen = openId === mat.id;
          return (
            <section key={mat.id} className={`catmap-material${isOpen ? ' open' : ''}`}>
              <header>
                <button type="button" className="catmap-material-title" aria-expanded={isOpen} onClick={() => setOpenId(isOpen ? null : mat.id)}>
                  <strong>{mat.name}</strong>
                  <span>{cats.length} stone{cats.length === 1 ? '' : 's'} · {colours} colours · {sizes} sizes</span>
                </button>
                <div className="catmap-material-actions">
                  <button type="button" className="btn-ghost" aria-label={`Move ${mat.name} up`} disabled={i === 0 || busy === 'order'} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="btn-ghost" aria-label={`Move ${mat.name} down`} disabled={i === materials.length - 1 || busy === 'order'} onClick={() => move(i, 1)}>↓</button>
                  <button type="button" className="btn-ghost" onClick={() => rename(mat.id, mat.name)}>Rename</button>
                  <button type="button" className="btn-ghost danger" onClick={() => remove(mat.id, mat.name)}>Delete</button>
                </div>
              </header>
              {!isOpen && cats.length > 0 && (
                <div className="catmap-material-preview">{cats.map((c) => c.name).join(' · ')}</div>
              )}
              {isOpen && (
                <div className="stone-finder-stones">
                  {map.categories.map((c) => {
                    const on = mat.categoryIds.includes(c.id);
                    return (
                      <button key={c.id} type="button" className={`stone-chip toggle${on ? ' on' : ''}`} aria-pressed={on} disabled={busy === `mc${mat.id}-${c.id}`} onClick={() => toggle(mat.id, c, !on)}>
                        <span className="stone-chip-tick" aria-hidden="true">{on ? '✓' : '+'}</span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {materials.length > 0 && underNone.length > 0 && (
        <p className="catmap-hint" style={{ marginTop: 18 }}>
          <strong>Not under any material yet ({underNone.length}):</strong> {underNone.map((c) => c.name).join(', ')}
        </p>
      )}
    </>
  );
}

function PreviewTab({ map }: { map: CatalogueMap }) {
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [colorId, setColorId] = useState<number | null>(null);
  const colours = familyId ? map.colors.filter((c) => c.familyId === familyId) : map.colors;
  return (
    <>
      <p className="catmap-hint">What a buyer sees in Quick Order: choose a colour, shape and size, and these are the stones offered.</p>
      <div className="catmap-families" role="group" aria-label="Colour family">
        {COLOR_FAMILIES.map((f) => (
          <button key={f.id} type="button" className={`qo-family-chip${familyId === f.id ? ' active' : ''}`} onClick={() => { setFamilyId(familyId === f.id ? null : f.id); setColorId(null); }}>
            <ColorSwatch hex={f.hex} refPhotoUrl={f.refPhotoUrl} size={20} />
            {f.name}
          </button>
        ))}
      </div>
      <div className="catmap-picker">
        <label className="po-label">Exact colour (optional)</label>
        <IconSelect
          options={colours.map((c) => ({ id: c.id, name: c.name, hex: c.hex, refPhotoUrl: c.refPhotoUrl }))}
          value={colorId ?? 'all'}
          onChange={(v) => setColorId(v === 'all' ? null : v)}
          allLabel={familyId ? 'Any in this family' : 'Any colour'}
          leading="swatch"
          searchable
        />
      </div>
      <StoneFinder map={map} familyId={familyId} colorId={colorId} />
    </>
  );
}
