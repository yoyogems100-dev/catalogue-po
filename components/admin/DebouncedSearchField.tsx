'use client';

import { useRef } from 'react';

export default function DebouncedSearchField({ name, defaultValue, placeholder }: { name: string; defaultValue: string; placeholder?: string }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <input
      name={name}
      defaultValue={defaultValue}
      placeholder={placeholder}
      onChange={(e) => {
        if (timer.current) clearTimeout(timer.current);
        const form = e.currentTarget.form;
        timer.current = setTimeout(() => form?.requestSubmit(), 500);
      }}
    />
  );
}
