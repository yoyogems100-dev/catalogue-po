'use client';

import { useEffect, useState } from 'react';
import IconSelect from './IconSelect';
import { COLOR_FAMILIES } from '@/lib/color-family';
import { categoryGrades } from '@/lib/order-specs';
import type { OrderPreference } from '@/lib/customer-preferences';

type Category = { id: number; name: string };

/** Loads the category list once for screens that don't already have it. */
export function useCategoryList(initial?: Category[]): Category[] {
  const [categories, setCategories] = useState<Category[]>(initial || []);
  useEffect(() => {
    if (initial) return;
    let live = true;
    fetch('/api/app/categories')
      .then((res) => res.json())
      .then((data) => { if (live) setCategories((data.categories || []).map((c: any) => ({ id: c.id, name: c.name }))); })
      .catch(() => {});
    return () => { live = false; };
  }, [initial]);
  return categories;
}

/**
 * "When I say Red, I mean Ruby Corundum 5A." One row per colour family:
 * colour -> category -> grade (only for categories that have grades).
 */
export default function PreferencesEditor({
  categories,
  value,
  onChange
}: {
  categories: Category[];
  value: OrderPreference[];
  onChange: (next: OrderPreference[]) => void;
}) {
  const usedFamilies = new Set(value.map((p) => p.familyId));
  const nextFamily = COLOR_FAMILIES.find((f) => !usedFamilies.has(f.id));

  function update(index: number, patch: Partial<OrderPreference>) {
    onChange(value.map((p, i) => {
      if (i !== index) return p;
      const merged = { ...p, ...patch };
      // A new category may not offer the grade that was picked for the old one.
      if (merged.grade && !categoryGrades(merged.categoryId).includes(merged.grade)) delete merged.grade;
      return merged;
    }));
  }

  return (
    <div className="pref-editor">
      {value.length === 0 && <p className="pref-empty">None yet. Add a colour and the stone you usually mean by it.</p>}
      {value.map((pref, index) => {
        const grades = categoryGrades(pref.categoryId);
        const familyOptions = COLOR_FAMILIES.filter((f) => f.id === pref.familyId || !usedFamilies.has(f.id));
        return (
          <div className="pref-row" key={pref.familyId}>
            <div className="pref-row-fields">
              <div className="pref-field">
                <span className="pref-field-label">Colour</span>
                <IconSelect
                  options={familyOptions}
                  value={pref.familyId}
                  onChange={(v) => { if (v !== 'all') update(index, { familyId: v }); }}
                  allLabel="Colour"
                  leading="swatch"
                />
              </div>
              <div className="pref-field pref-field-wide">
                <span className="pref-field-label">Means</span>
                <IconSelect
                  options={categories}
                  value={pref.categoryId || 'all'}
                  onChange={(v) => { if (v !== 'all') update(index, { categoryId: v }); }}
                  allLabel="Choose stone"
                  leading="none"
                  searchable
                />
              </div>
            </div>
            {grades.length > 0 && (
              <div className="po-type-toggle pref-grade" role="group" aria-label="Quality">
                {grades.map((g) => (
                  <button key={g} type="button" aria-pressed={pref.grade === g} className={pref.grade === g ? 'active' : ''} onClick={() => update(index, { grade: g })}>
                    {g}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="pref-remove" aria-label="Remove this preference" onClick={() => onChange(value.filter((_, i) => i !== index))}>Remove</button>
          </div>
        );
      })}
      {nextFamily && categories.length > 0 && (
        <button type="button" className="btn-ghost pref-add" onClick={() => onChange([...value, { familyId: nextFamily.id, categoryId: 0 }])}>
          + Add a colour
        </button>
      )}
    </div>
  );
}

/** Rows still missing a stone aren't worth sending. */
export function completePreferences(prefs: OrderPreference[]): OrderPreference[] {
  return prefs.filter((p) => p.categoryId > 0);
}
