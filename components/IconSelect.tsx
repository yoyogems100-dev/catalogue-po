'use client';

import { useEffect, useRef, useState } from 'react';
import ShapeIcon from './ShapeIcon';

type Option = { id: number; name: string; hex?: string | null; iconKey?: string | null };

type CommonProps = {
  options: Option[];
  leading?: 'swatch' | 'icon' | 'none';
  /** Show a filter box inside the panel once there are more than a few options. */
  searchable?: boolean;
};

type SingleProps = CommonProps & {
  multiple?: false;
  value: number | 'all';
  onChange: (v: number | 'all') => void;
  allLabel: string;
};

type MultiProps = CommonProps & {
  multiple: true;
  values: number[];
  onChange: (v: number[]) => void;
  placeholder: string;
};

type Props = SingleProps | MultiProps;

// Dropdown with a shape icon / color swatch next to each option -- same visual
// language as the admin MultiSelect/ShapeSizeSelect pickers. Supports either a
// single-select "filter" mode (value + allLabel, used for the shape/color
// filters on category listing pages) or a checkbox multi-select mode (values +
// placeholder, used by POSelector so one order line can cover several
// shapes/colors at once).
//
// Branches on props.multiple with explicit casts rather than relying on
// automatic discriminated-union narrowing -- TS doesn't narrow reliably here
// because the discriminant (`multiple`) is optional on one side of the union.
export default function IconSelect(props: Props) {
  const { options, leading = 'none', searchable = options.length > 6 } = props;
  const isMulti = props.multiple === true;
  const single = props as SingleProps;
  const multi = props as MultiProps;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  function Leading({ o }: { o: Option | null }) {
    if (!o) return null;
    if (leading === 'swatch') return <span className="icon-select-swatch" style={{ background: o.hex || '#ccc' }} />;
    if (leading === 'icon') return <span className="icon-select-icon"><ShapeIcon iconKey={o.iconKey} size={13} /></span>;
    return null;
  }

  const filtered = search.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  let triggerLabel: string;
  let selected: Option | null = null;
  if (isMulti) {
    if (multi.values.length === 0) triggerLabel = multi.placeholder;
    else if (multi.values.length === 1) triggerLabel = options.find((o) => o.id === multi.values[0])?.name || multi.placeholder;
    else triggerLabel = `${multi.values.length} selected`;
  } else {
    selected = single.value === 'all' ? null : options.find((o) => o.id === single.value) || null;
    triggerLabel = selected ? selected.name : single.allLabel;
  }

  function toggleValue(id: number) {
    if (!isMulti) return;
    const next = multi.values.includes(id) ? multi.values.filter((v) => v !== id) : [...multi.values, id];
    multi.onChange(next);
  }

  function pickSingle(id: number) {
    single.onChange(id);
    setOpen(false);
  }

  return (
    <div className="icon-select" ref={rootRef}>
      <button type="button" className="icon-select-trigger" onClick={() => setOpen((v) => !v)}>
        <Leading o={selected} />
        <span className="icon-select-label">{triggerLabel}</span>
        <span className="icon-select-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="icon-select-panel">
          {searchable && (
            <input
              autoFocus
              type="text"
              className="icon-select-search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {!isMulti && (
            <div
              className={`icon-select-row ${single.value === 'all' ? 'active' : ''}`}
              onClick={() => { single.onChange('all'); setOpen(false); }}
            >
              {single.allLabel}
            </div>
          )}

          {filtered.map((o) => {
            const isActive = isMulti ? multi.values.includes(o.id) : single.value === o.id;
            return (
              <div
                key={o.id}
                className={`icon-select-row ${isActive ? 'active' : ''}`}
                onClick={() => (isMulti ? toggleValue(o.id) : pickSingle(o.id))}
              >
                {isMulti && (
                  <input type="checkbox" checked={isActive} readOnly className="icon-select-checkbox" />
                )}
                <Leading o={o} />
                {o.name}
              </div>
            );
          })}

          {filtered.length === 0 && <div className="icon-select-empty">No matches.</div>}
        </div>
      )}
    </div>
  );
}
