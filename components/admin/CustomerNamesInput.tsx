'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import { CUSTOMER_NAME_MAX, tidyCustomerName } from '@/lib/price-list-options';

/**
 * One or more customers, as chips: pick a buyer account from the suggestions
 * or type any name, then Enter (or comma) to add it. The same prices are
 * saved for every customer listed.
 */
export default function CustomerNamesInput({ names, onChange, suggestions, autoFocus = false, disabled = false }: {
  names: string[];
  onChange: (names: string[]) => void;
  suggestions: string[];
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const listId = useId();
  const [text, setText] = useState('');
  const has = (n: string) => names.some((x) => x.toLowerCase() === n.toLowerCase());

  function add(raw: string) {
    const name = tidyCustomerName(raw).slice(0, CUSTOMER_NAME_MAX);
    if (name && !has(name)) onChange([...names, name]);
    setText('');
  }

  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && text.trim()) { e.preventDefault(); add(text); }
    if (e.key === 'Backspace' && !text && names.length) onChange(names.slice(0, -1));
  }

  return (
    <div className="cn-input">
      {names.map((n) => (
        <button key={n} type="button" className="cn-chip" disabled={disabled} onClick={() => onChange(names.filter((x) => x !== n))} aria-label={`Remove ${n}`}>
          {n} <span aria-hidden="true">×</span>
        </button>
      ))}
      <input
        value={text}
        list={listId}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={CUSTOMER_NAME_MAX}
        placeholder={names.length ? 'Add another customer' : 'Choose a buyer or type a name'}
        aria-label="Customers"
        autoComplete="off"
        onChange={(e) => {
          const v = e.target.value;
          // Picking a suggestion fills the box with exactly that name: add it.
          if (suggestions.some((s) => s === v)) add(v); else setText(v);
        }}
        onKeyDown={keys}
        onBlur={() => { if (text.trim()) add(text); }}
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !has(s)).map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
