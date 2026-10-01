'use client';

import { useId } from 'react';

// Type to search the city list, or type any other place -- it's saved as
// typed (tidied) and suggested from then on.
export default function PlaceInput({ value, onChange, suggestions, placeholder = 'Type a city, e.g. Jodhpur' }: {
  value: string;
  onChange: (value: string) => void;
  suggestions: readonly string[];
  placeholder?: string;
}) {
  const listId = useId();
  return <>
    <input type="text" list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" maxLength={60} />
    <datalist id={listId}>{suggestions.map((p) => <option key={p} value={p} />)}</datalist>
  </>;
}
