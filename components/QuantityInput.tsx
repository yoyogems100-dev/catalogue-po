'use client';

import { useEffect, useState } from 'react';
import { parseQuantity } from '@/lib/quantity';

export default function QuantityInput({ value, label, onChange, onInvalid, placeholder, allowEmpty = false }: {
  value: number; label: string; onChange: (quantity: number) => void; onInvalid: () => void;
  /** Shown when the field is blank -- only meaningful with allowEmpty. */
  placeholder?: string;
  /**
   * Treat a blank field as a real, valid answer meaning "not specified", and
   * report it as 0. Used for quotation lines, where the buyer is asking what
   * something would cost and does not have to commit to a quantity yet.
   */
  allowEmpty?: boolean;
}) {
  const asDraft = (n: number) => (allowEmpty && n === 0 ? '' : String(n));
  const [draft, setDraft] = useState(asDraft(value));
  useEffect(() => setDraft(asDraft(value)), [value, allowEmpty]);
  return (
    <input
      type="text" inputMode="numeric" className="po-qty-input po-cart-qty"
      aria-label={label} value={draft} placeholder={placeholder}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*$/.test(next)) return;
        setDraft(next);
        if (allowEmpty && next.trim() === '') { onChange(0); return; }
        const parsed = parseQuantity(next);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        if (allowEmpty && draft.trim() === '') { onChange(0); return; }
        const parsed = parseQuantity(draft);
        if (parsed === null) { setDraft(asDraft(value)); onInvalid(); }
        else { setDraft(String(parsed)); onChange(parsed); }
      }}
    />
  );
}
