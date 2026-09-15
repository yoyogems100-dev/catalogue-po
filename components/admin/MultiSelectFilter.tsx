'use client';

import { useEffect, useRef, useState } from 'react';

export default function MultiSelectFilter({ name, label, pluralLabel, options, selected }: { name: string; label: string; pluralLabel?: string; options: string[]; selected: string[] }) {
  const plural = pluralLabel || `${label}s`;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>(selected);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggle(option: string) {
    setValues((cur) => (cur.includes(option) ? cur.filter((v) => v !== option) : [...cur, option]));
  }

  function apply() {
    setOpen(false);
    hiddenRef.current?.form?.requestSubmit();
  }

  const hiddenRef = useRef<HTMLInputElement>(null);

  const buttonLabel = values.length === 0 ? `All ${plural.toLowerCase()}` : values.length === 1 ? values[0] : `${values.length} ${plural.toLowerCase()} selected`;

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: 12.5, marginBottom: 4 }}>{label}</label>
      <input ref={hiddenRef} type="hidden" name={name} value={values.join(',')} />
      <button type="button" onClick={() => setOpen((o) => !o)} style={{ border: '1px solid var(--line)', borderRadius: 5, padding: '9px 12px', fontSize: 13.5, background: '#fff', cursor: 'pointer', color: values.length ? 'var(--charcoal)' : '#8a8578', minWidth: 150, textAlign: 'left' }}>
        {buttonLabel}
      </button>
      {open && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, padding: 10, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
          {options.map((option) => (
            <label key={option} style={{ display: 'flex', flex: '0 0 auto', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 400, cursor: 'pointer' }}>
              <input type="checkbox" checked={values.includes(option)} onChange={() => toggle(option)} />
              {option}
            </label>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 6 }}>
            <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setValues([])}>Clear</button>
            <button type="button" className="btn" style={{ fontSize: 11, padding: '4px 10px' }} onClick={apply}>Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}
