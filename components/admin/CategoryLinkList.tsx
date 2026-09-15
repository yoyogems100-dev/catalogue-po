'use client';
import Link from 'next/link';
import { useState } from 'react';

// Used by the Shapes and Colors admin lists' "N categories" expander.
// Previously that expander revealed a MultiSelect, which is itself a closed
// dropdown -- so seeing the actual category list took two clicks (expand the
// row, then open the MultiSelect). This shows the list immediately, and each
// category name is a real link straight to that category's admin workspace.
export default function CategoryLinkList({
  categories,
  linkedIds,
  onToggle,
  tab
}: {
  categories: { id: number; name: string }[];
  linkedIds: number[];
  onToggle: (id: number, currentlyLinked: boolean) => void | Promise<void>;
  tab: string;
}) {
  const [query, setQuery] = useState('');
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div style={{ maxWidth: 420 }}>
      {categories.length > 8 && (
        <input
          type="text"
          placeholder="Search categories..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ fontSize: 12.5, marginBottom: 6, width: '100%' }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
        {filtered.map((cat) => {
          const checked = linkedIds.includes(cat.id);
          return (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
              <input
                type="checkbox"
                aria-label={`Link to ${cat.name}`}
                checked={checked}
                onChange={() => onToggle(cat.id, checked)}
              />
              <Link href={`/admin/categories/${cat.id}?tab=${tab}`} style={{ color: 'var(--navy)', textDecoration: 'underline', flex: 1 }}>
                {cat.name}
              </Link>
            </div>
          );
        })}
        {filtered.length === 0 && <span style={{ fontSize: 12, color: '#756e5c' }}>No categories match.</span>}
      </div>
    </div>
  );
}
