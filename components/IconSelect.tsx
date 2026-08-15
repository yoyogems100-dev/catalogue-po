'use client';

import { useState } from 'react';
import ShapeIcon from './ShapeIcon';

type Option = { id: number; name: string; hex?: string | null; iconKey?: string | null };

// Single-select dropdown with a shape icon / color swatch next to each option --
// same visual language as the admin MultiSelect/ShapeSizeSelect pickers, so
// shape and color identity looks consistent whether you're in /admin or on
// the public catalogue.
export default function IconSelect({
  options,
  value,
  onChange,
  allLabel,
  leading = 'none'
}: {
  options: Option[];
  value: number | 'all';
  onChange: (v: number | 'all') => void;
  allLabel: string;
  leading?: 'swatch' | 'icon' | 'none';
}) {
  const [open, setOpen] = useState(false);
  const selected = value === 'all' ? null : options.find((o) => o.id === value) || null;

  function Leading({ o }: { o: Option | null }) {
    if (!o) return null;
    if (leading === 'swatch') return <span className="icon-select-swatch" style={{ background: o.hex || '#ccc' }} />;
    if (leading === 'icon') return <span className="icon-select-icon"><ShapeIcon iconKey={o.iconKey} size={13} /></span>;
    return null;
  }

  return (
    <div className="icon-select">
      <button type="button" className="icon-select-trigger" onClick={() => setOpen((v) => !v)}>
        <Leading o={selected} />
        <span className="icon-select-label">{selected ? selected.name : allLabel}</span>
        <span className="icon-select-caret">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="icon-select-panel">
          <div
            className={`icon-select-row ${value === 'all' ? 'active' : ''}`}
            onClick={() => { onChange('all'); setOpen(false); }}
          >
            {allLabel}
          </div>
          {options.map((o) => (
            <div
              key={o.id}
              className={`icon-select-row ${value === o.id ? 'active' : ''}`}
              onClick={() => { onChange(o.id); setOpen(false); }}
            >
              <Leading o={o} />
              {o.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
