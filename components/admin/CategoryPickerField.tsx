'use client';

import { useRef } from 'react';
import IconSelect from '@/components/IconSelect';
import { categoryIconUrl } from '@/lib/category-icons';

/**
 * Single-category filter for a server-rendered GET form. The value lives in a
 * hidden input so the surrounding <form> still submits it the way a native
 * <select name=...> did; picking a category submits immediately, so the
 * separate "Apply" button the native version needed is gone.
 *
 * The multi-select twin of this is CategoryFilterField.
 */
export default function CategoryPickerField({
  name,
  label,
  categories,
  defaultCategoryId,
  allLabel = 'All categories'
}: {
  name: string;
  label: string;
  categories: { id: number; name: string; slug?: string | null }[];
  defaultCategoryId: number;
  allLabel?: string;
}) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ minWidth: 200, maxWidth: 260 }}>
      <label style={{ display: 'block', fontSize: 12.5, marginBottom: 4 }}>{label}</label>
      <input ref={hiddenRef} type="hidden" name={name} defaultValue={String(defaultCategoryId || 0)} />
      <IconSelect
        options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
        value={defaultCategoryId || 'all'}
        onChange={(v) => {
          if (!hiddenRef.current) return;
          hiddenRef.current.value = v === 'all' ? '0' : String(v);
          hiddenRef.current.form?.requestSubmit();
        }}
        allLabel={allLabel}
        leading="photo"
        searchable
      />
    </div>
  );
}
