'use client';

import { useState } from 'react';
import IconSelect from '@/components/IconSelect';
import ColorSwatch from '@/components/ColorSwatch';
import { COLOR_FAMILIES } from '@/lib/color-family';
import { categoryGrades } from '@/lib/order-specs';
import { categoryIconUrl } from '@/lib/category-icons';
import { sizesFor } from '@/lib/catalogue-map';
import { MAX_PICK_QTY, preferenceForFamily, type OrderPreference } from '@/lib/customer-preferences';
import { useCatalogueMap } from '@/components/useCatalogueMap';

type Category = { id: number; name: string; slug?: string | null };

/**
 * Colour buttons in two compact parts: every colour as a chip (tap to show or
 * hide; the number is its place on the row), then one line per shown colour
 * that opens to the stone, quality, shape, size and quantity it starts on.
 * The shop version sets it for everyone; the buyer version starts from the
 * shop's and can override either part.
 */
export default function ColourSetupEditor({
  mode,
  categories,
  buttons,
  picks,
  onChange,
  shopButtons = [],
  shopPicks = []
}: {
  mode: 'shop' | 'buyer';
  categories: Category[];
  /** Buyer mode: null means "same buttons as the shop". */
  buttons: number[] | null;
  picks: OrderPreference[];
  onChange: (next: { buttons: number[] | null; picks: OrderPreference[] }) => void;
  shopButtons?: number[];
  shopPicks?: OrderPreference[];
}) {
  const map = useCatalogueMap(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const followsShop = mode === 'buyer' && buttons === null;
  const shown = buttons ?? shopButtons;
  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name || 'a stone';
  const shapeName = (id: number) => map?.shapes.find((s) => s.id === id)?.name || 'Shape';

  function setButtons(next: number[] | null) { onChange({ buttons: next, picks }); }
  // Tapping a chip while following the shop starts this buyer's own list.
  function toggle(id: number) {
    setButtons(shown.includes(id) ? shown.filter((x) => x !== id) : [...shown, id]);
  }
  function move(id: number, delta: number) {
    const index = shown.indexOf(id), target = index + delta;
    if (index < 0 || target < 0 || target >= shown.length) return;
    const next = [...shown];
    [next[index], next[target]] = [next[target], next[index]];
    setButtons(next);
  }

  const order = COLOR_FAMILIES.map((f) => f.id);
  function putPick(familyId: number, pick: OrderPreference | null) {
    const rest = picks.filter((p) => p.familyId !== familyId);
    const next = pick ? [...rest, pick] : rest;
    onChange({ buttons, picks: next.sort((a, b) => order.indexOf(a.familyId) - order.indexOf(b.familyId)) });
  }
  function chooseStone(familyId: number, categoryId: number | null) {
    if (!categoryId) return putPick(familyId, null);
    const current = preferenceForFamily(picks, familyId) ?? (mode === 'buyer' ? preferenceForFamily(shopPicks, familyId) : null);
    const grades = categoryGrades(categoryId);
    const sameStone = current?.categoryId === categoryId;
    const grade = (sameStone ? current?.grade : undefined) ?? (grades.includes('5A') ? '5A' : grades[0]);
    const pick: OrderPreference = { familyId, categoryId };
    if (grades.length && grade) pick.grade = grade;
    if (sameStone && current?.shapeId) pick.shapeId = current.shapeId;
    if (sameStone && current?.size) pick.size = current.size;
    if (current?.qty) pick.qty = current.qty;
    putPick(familyId, pick);
  }
  /** Edits on a colour still on the shop's stone copy that pick first. */
  function patchPick(familyId: number, patch: Partial<OrderPreference>) {
    const base = preferenceForFamily(picks, familyId) ?? (mode === 'buyer' ? preferenceForFamily(shopPicks, familyId) : null);
    if (!base) return;
    const next: OrderPreference = { ...base, ...patch, familyId };
    for (const key of ['grade', 'shapeId', 'size', 'qty'] as const) if (next[key] == null || next[key] === '') delete next[key];
    putPick(familyId, next);
  }

  function summary(pick: OrderPreference | null) {
    if (!pick) return null;
    const parts = [`${categoryName(pick.categoryId)}${pick.grade ? ` ${pick.grade}` : ''}`];
    if (pick.shapeId) parts.push(shapeName(pick.shapeId));
    if (pick.size) parts.push(`${pick.size} mm`);
    if (pick.qty) parts.push(`${pick.qty.toLocaleString('en-IN')} pcs`);
    return parts.join(' · ');
  }

  return (
    <div className="colour-setup">
      {mode === 'buyer' && (
        <div className="po-type-toggle colour-setup-source" role="group" aria-label="Which colour buttons this buyer sees">
          <button type="button" aria-pressed={followsShop} className={followsShop ? 'active' : ''} onClick={() => setButtons(null)}>Same as shop</button>
          <button type="button" aria-pressed={!followsShop} className={!followsShop ? 'active' : ''} onClick={() => setButtons([...shopButtons])}>Choose for this buyer</button>
        </div>
      )}

      <h3 className="colour-setup-label">Buttons shown <small>{shown.length} of {COLOR_FAMILIES.length} · tap to show or hide</small></h3>
      <div className="colour-chip-grid" role="group" aria-label="Colour buttons shown">
        {COLOR_FAMILIES.map((f) => {
          const index = shown.indexOf(f.id);
          return (
            <button key={f.id} type="button" className={`colour-chip${index >= 0 ? ' on' : ''}`} aria-pressed={index >= 0} onClick={() => toggle(f.id)}>
              <ColorSwatch hex={f.hex} refPhotoUrl={f.refPhotoUrl} size={22} />
              <span className="colour-chip-name">{f.name}</span>
              {index >= 0 && <b className="colour-chip-num" aria-label={`position ${index + 1}`}>{index + 1}</b>}
            </button>
          );
        })}
      </div>

      <h3 className="colour-setup-label">What each button opens <small>tap a colour to set its stone, shape, size and quantity</small></h3>
      {shown.length === 0 && <p className="colour-setup-empty">No colour buttons are shown. Tap a colour above to add one.</p>}
      <ol className="colour-pick-list">
        {shown.map((id, index) => {
          const family = COLOR_FAMILIES.find((f) => f.id === id)!;
          const own = preferenceForFamily(picks, id);
          const shop = mode === 'buyer' ? preferenceForFamily(shopPicks, id) : null;
          const pick = own ?? shop;
          const open = openId === id;
          const category = pick ? map?.categories.find((c) => c.id === pick.categoryId) : null;
          const grades = pick ? categoryGrades(pick.categoryId) : [];
          const shapes = category ? (map?.shapes || []).filter((s) => category.shapeIds.includes(s.id)) : [];
          const sizes = map && category ? sizesFor(map, [category], pick?.shapeId ?? null) : [];
          const sizeIndex = pick?.size ? sizes.findIndex((s) => s.key === pick.size) : -1;
          const noneLabel = shop ? `Shop default: ${summary(shop)}` : 'No stone (buyer chooses)';
          return (
            <li key={id} className={open ? 'open' : ''}>
              <div className="colour-pick-row">
                <button type="button" className="colour-pick-summary" aria-expanded={open} onClick={() => setOpenId(open ? null : id)}>
                  <ColorSwatch hex={family.hex} refPhotoUrl={family.refPhotoUrl} size={28} />
                  <span className="colour-pick-text">
                    <strong>{family.name}</strong>
                    <small className={pick ? '' : 'none'}>
                      {pick ? summary(pick) : 'No stone set (buyer chooses)'}
                      {!own && shop && <em>shop default</em>}
                    </small>
                  </span>
                  <span className="colour-pick-chevron" aria-hidden>▾</span>
                </button>
                {!followsShop && (
                  <span className="colour-pick-move">
                    <button type="button" aria-label={`Move ${family.name} up`} disabled={index === 0} onClick={() => move(id, -1)}>↑</button>
                    <button type="button" aria-label={`Move ${family.name} down`} disabled={index === shown.length - 1} onClick={() => move(id, 1)}>↓</button>
                  </span>
                )}
              </div>
              {open && (
                <div className="colour-pick-editor">
                  <div className="colour-pick-stone">
                    <span className="po-label">Stone</span>
                    <IconSelect
                      options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
                      value={own?.categoryId ?? 'all'}
                      onChange={(v) => chooseStone(id, v === 'all' ? null : v)}
                      allLabel={noneLabel}
                      leading="photo"
                      searchable
                    />
                  </div>
                  {grades.length > 0 && (
                    <div className="colour-pick-grade">
                      <span className="po-label">Quality</span>
                      <div className="po-type-toggle" role="group" aria-label={`${family.name} quality`}>
                        {grades.map((g) => (
                          <button key={g} type="button" aria-pressed={pick?.grade === g} className={pick?.grade === g ? 'active' : ''} onClick={() => patchPick(id, { grade: g })}>{g}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {pick && (
                    <>
                      <div>
                        <span className="po-label">Shape</span>
                        <IconSelect
                          options={shapes.map((s) => ({ id: s.id, name: s.name, refPhotoUrl: s.refPhotoUrl }))}
                          value={pick.shapeId ?? 'all'}
                          onChange={(v) => {
                            const shapeId = v === 'all' ? null : v;
                            const keepSize = !!pick.size && !!map && !!category && sizesFor(map, [category], shapeId).some((s) => s.key === pick.size);
                            patchPick(id, { shapeId, size: keepSize ? pick.size : null });
                          }}
                          allLabel={map ? 'Any shape' : 'Loading…'}
                          leading="photo"
                          searchable
                        />
                      </div>
                      <div>
                        <span className="po-label">Size</span>
                        <IconSelect
                          optionKind="size"
                          options={sizes.map((s, i) => ({ id: i, name: s.label }))}
                          value={sizeIndex >= 0 ? sizeIndex : 'all'}
                          onChange={(v) => patchPick(id, { size: v === 'all' ? null : sizes[v]?.key ?? null })}
                          allLabel={map ? 'Any size' : 'Loading…'}
                          leading="none"
                          searchable
                        />
                      </div>
                      <div className="colour-pick-qty">
                        <label className="po-label" htmlFor={`colour-qty-${id}`}>Qty (pcs)</label>
                        <input
                          id={`colour-qty-${id}`}
                          inputMode="numeric"
                          placeholder="Buyer enters"
                          value={pick.qty ?? ''}
                          onChange={(e) => {
                            const qty = Math.min(Number(e.target.value.replace(/\D/g, '')) || 0, MAX_PICK_QTY);
                            patchPick(id, { qty: qty || null });
                          }}
                        />
                      </div>
                    </>
                  )}
                  {own && (
                    <button type="button" className="colour-pick-reset" onClick={() => putPick(id, null)}>
                      {shop ? 'Use shop default' : 'Clear'}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
