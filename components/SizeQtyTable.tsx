'use client';

import { useRef, type KeyboardEvent } from 'react';
import type { QuickSize } from '@/lib/quick-order';
import { expandQtyShorthand } from '@/lib/quantity';
import type { TableEntries, TableGroup } from '@/lib/size-table';

/**
 * Every size of the picked shape(s), each with a quantity box. Empty boxes
 * are skipped; Enter (or the phone keyboard's Next) moves to the next box.
 */
export default function SizeQtyTable<S extends QuickSize>({
  groups,
  shapeName,
  sizeName,
  entries,
  onEntries,
  unitLabel = 'pcs',
}: {
  groups: TableGroup<S>[];
  shapeName: (shapeId: number) => string;
  sizeName: (size: S) => string;
  entries: TableEntries;
  onEntries: (next: TableEntries) => void;
  unitLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function next(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const boxes = Array.from(ref.current?.querySelectorAll<HTMLInputElement>('input') || []);
    const at = boxes.indexOf(e.currentTarget);
    if (at >= 0 && at < boxes.length - 1) boxes[at + 1].focus();
    else e.currentTarget.blur();
  }

  return (
    <div className="po-size-table" ref={ref}>
      {groups.map((g) => (
        <div key={g.shapeId} className="po-line-qty-group">
          {groups.length > 1 && <p className="po-line-qty-colour">{shapeName(g.shapeId)}</p>}
          <div className="po-line-qty-grid">
            {g.sizes.map((s) => {
              const v = entries[s.id] ?? '';
              const bad = !/^\d*$/.test(v.trim());
              return (
                <label key={s.id} className={`po-line-qty-row${v.trim() && !bad ? ' po-line-qty-row--filled' : ''}`}>
                  <span className="po-line-qty-name">{sizeName(s)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    enterKeyHint="next"
                    className="po-qty-input"
                    aria-label={`${unitLabel} of ${shapeName(g.shapeId)} ${s.size_mm} mm`}
                    aria-invalid={bad || undefined}
                    placeholder="0"
                    value={v}
                    onKeyDown={next}
                    onChange={(e) => onEntries({ ...entries, [s.id]: expandQtyShorthand(e.target.value) })}
                  />
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
