'use client';

import { useRef } from 'react';
import IconSelect from '@/components/IconSelect';
import { categoryIconUrl } from '@/lib/category-icons';

export default function CategoryFilterField({ categories, defaultCategoryIds }: { categories: { id: number; name: string; slug?: string | null }[]; defaultCategoryIds: number[] }) {
  const hiddenRef = useRef<HTMLInputElement>(null);

  function onChange(v: number[]) {
    if (hiddenRef.current) {
      hiddenRef.current.value = v.join(',');
      hiddenRef.current.form?.requestSubmit();
    }
  }

  return (
    <div style={{ minWidth: 200 }}>
      <label style={{ display: 'block', fontSize: 12.5, marginBottom: 4 }}>Category</label>
      <input ref={hiddenRef} type="hidden" name="category" defaultValue={defaultCategoryIds.join(',')} />
      <IconSelect
        options={categories.map((c) => ({ id: c.id, name: c.name, refPhotoUrl: categoryIconUrl(c.slug) }))}
        multiple
        values={defaultCategoryIds}
        onChange={onChange}
        placeholder="All categories"
        searchable
        leading="photo"
      />
    </div>
  );
}
