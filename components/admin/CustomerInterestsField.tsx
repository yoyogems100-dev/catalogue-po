'use client';

import IconSelect from '@/components/IconSelect';
import { categoryIconUrl } from '@/lib/category-icons';
import { FOR_YOU_TITLE, MAX_INTERESTS } from '@/lib/customer-interests';

type Category = { id: number; name: string; slug?: string | null };

/**
 * Go-to requirements as categories: the dropdown picks them, the chips below
 * keep the order the buyer sees them in ("Curated for you" on their home
 * page) and the switch turns that shelf on or off for this buyer.
 */
export default function CustomerInterestsField({ categories, ids, show, onChange }: {
  categories: Category[];
  ids: number[];
  show: boolean;
  onChange: (next: { ids: number[]; show: boolean }) => void;
}) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const picked = ids.filter((id) => byId.has(id));
  const move = (index: number, by: number) => {
    const next = [...picked];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    onChange({ ids: next, show });
  };

  return (
    <div className="interests-field">
      <IconSelect
        options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
        multiple
        values={picked}
        onChange={(next) => onChange({ ids: next.slice(0, MAX_INTERESTS), show })}
        placeholder="Choose categories"
        searchable
        leading="photo"
      />
      {picked.length > 0 && (
        <ol className="interests-chips" aria-label="Shown in this order">
          {picked.map((id, i) => (
            <li key={id} className="interests-chip">
              <span className="interests-chip-num">{i + 1}</span>
              <span className="interests-chip-name">{byId.get(id)!.name}</span>
              <button type="button" aria-label={`Move ${byId.get(id)!.name} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label={`Move ${byId.get(id)!.name} later`} disabled={i === picked.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label={`Remove ${byId.get(id)!.name}`} onClick={() => onChange({ ids: picked.filter((v) => v !== id), show })}>×</button>
            </li>
          ))}
        </ol>
      )}
      <label className="interests-toggle">
        <input type="checkbox" checked={show} onChange={(e) => onChange({ ids: picked, show: e.target.checked })} />
        <span>Show <strong>{FOR_YOU_TITLE}</strong> on their catalogue home</span>
      </label>
      <p className="interests-hint">
        {!show ? 'Hidden — they see the regular catalogue.'
          : picked.length ? 'These open their catalogue, in this order, above every other shelf.'
          : 'Pick categories to give this buyer their own shelf.'}
      </p>
    </div>
  );
}
