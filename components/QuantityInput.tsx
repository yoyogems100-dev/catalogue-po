'use client';

import { useEffect, useState } from 'react';
import { parseQuantity } from '@/lib/quantity';

export default function QuantityInput({ value, label, onChange, onInvalid }: {
  value: number; label: string; onChange: (quantity: number) => void; onInvalid: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="text" inputMode="numeric" className="po-qty-input po-cart-qty"
      aria-label={label} value={draft}
      onChange={(event) => {
        const next = event.target.value;
        if (!/^\d*$/.test(next)) return;
        setDraft(next);
        const parsed = parseQuantity(next);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        const parsed = parseQuantity(draft);
        if (parsed === null) { setDraft(String(value)); onInvalid(); }
        else { setDraft(String(parsed)); onChange(parsed); }
      }}
    />
  );
}
