'use client';

import IconSelect from '@/components/IconSelect';
import ColorSwatch from '@/components/ColorSwatch';
import { COLOR_FAMILIES } from '@/lib/color-family';
import { categoryGrades } from '@/lib/order-specs';
import { categoryIconUrl } from '@/lib/category-icons';
import { preferenceForFamily, type OrderPreference } from '@/lib/customer-preferences';

type Category = { id: number; name: string; slug?: string | null };

/**
 * Every colour button on one list: tick to show it, arrows to order it, and
 * the stone (and quality) it opens. The shop version sets it for everyone;
 * the buyer version starts from the shop's and can override either part --
 * their own buttons, and their own stone per colour.
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
  const followsShop = mode === 'buyer' && buttons === null;
  const shown = buttons ?? shopButtons;
  const rows = [...shown, ...COLOR_FAMILIES.map((f) => f.id).filter((id) => !shown.includes(id))];
  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name || 'a stone';

  function setButtons(next: number[] | null) { onChange({ buttons: next, picks }); }
  function toggle(id: number, on: boolean) {
    setButtons(on ? [...shown, id] : shown.filter((x) => x !== id));
  }
  function move(id: number, delta: number) {
    const index = shown.indexOf(id), target = index + delta;
    if (index < 0 || target < 0 || target >= shown.length) return;
    const next = [...shown];
    [next[index], next[target]] = [next[target], next[index]];
    setButtons(next);
  }
  function setPick(familyId: number, categoryId: number | null, grade?: string) {
    const rest = picks.filter((p) => p.familyId !== familyId);
    if (!categoryId) return onChange({ buttons, picks: rest });
    const grades = categoryGrades(categoryId);
    const current = preferenceForFamily(picks, familyId);
    const keep = grade ?? (current?.categoryId === categoryId ? current.grade : undefined) ?? (grades.includes('5A') ? '5A' : grades[0]);
    const pick: OrderPreference = grades.length && keep ? { familyId, categoryId, grade: keep } : { familyId, categoryId };
    const order = COLOR_FAMILIES.map((f) => f.id);
    onChange({ buttons, picks: [...rest, pick].sort((a, b) => order.indexOf(a.familyId) - order.indexOf(b.familyId)) });
  }

  return (
    <div className="colour-setup">
      {mode === 'buyer' && (
        <div className="po-type-toggle colour-setup-source" role="group" aria-label="Which colour buttons this buyer sees">
          <button type="button" aria-pressed={followsShop} className={followsShop ? 'active' : ''} onClick={() => setButtons(null)}>Same as shop</button>
          <button type="button" aria-pressed={!followsShop} className={!followsShop ? 'active' : ''} onClick={() => setButtons([...shopButtons])}>Choose for this buyer</button>
        </div>
      )}
      <ol className="colour-setup-list">
        {rows.map((id) => {
          const family = COLOR_FAMILIES.find((f) => f.id === id)!;
          const on = shown.includes(id);
          const index = shown.indexOf(id);
          const own = preferenceForFamily(picks, id);
          const shop = mode === 'buyer' ? preferenceForFamily(shopPicks, id) : null;
          const grades = own ? categoryGrades(own.categoryId) : [];
          const noneLabel = shop
            ? `Shop default: ${categoryName(shop.categoryId)}${shop.grade ? ` ${shop.grade}` : ''}`
            : 'No default (buyer chooses)';
          return (
            <li key={id} className={on ? '' : 'off'}>
              <div className="colour-setup-head">
                <label className="colour-setup-show">
                  <input type="checkbox" checked={on} disabled={followsShop} onChange={(e) => toggle(id, e.target.checked)} />
                  <ColorSwatch hex={family.hex} refPhotoUrl={family.refPhotoUrl} size={24} />
                  <span>{family.name}</span>
                  {!on && <em>hidden</em>}
                </label>
                {on && !followsShop && (
                  <span className="colour-setup-move">
                    <button type="button" className="btn-ghost" aria-label={`Move ${family.name} up`} disabled={index === 0} onClick={() => move(id, -1)}>↑</button>
                    <button type="button" className="btn-ghost" aria-label={`Move ${family.name} down`} disabled={index === shown.length - 1} onClick={() => move(id, 1)}>↓</button>
                  </span>
                )}
              </div>
              <div className="colour-setup-opens">
                <span className="po-label">Opens</span>
                <IconSelect
                  options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
                  value={own?.categoryId ?? 'all'}
                  onChange={(v) => setPick(id, v === 'all' ? null : v)}
                  allLabel={noneLabel}
                  leading="photo"
                  searchable
                />
                {grades.length > 0 && (
                  <div className="po-type-toggle" role="group" aria-label={`${family.name} quality`}>
                    {grades.map((g) => (
                      <button key={g} type="button" aria-pressed={own?.grade === g} className={own?.grade === g ? 'active' : ''} onClick={() => setPick(id, own!.categoryId, g)}>{g}</button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
