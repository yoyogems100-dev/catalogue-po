'use client';
import { useState } from 'react';

// Compact "first name +N more" chip row for a row that touches several
// categories (an order's line items). Expands inline on click -- no
// navigation, no dropdown-in-a-dropdown (see CategoryLinkList for why that
// pattern is worth avoiding).
export default function CategoryChips({ names }: { names: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (names.length === 0) return <span style={{ color: '#756e5c' }}>—</span>;
  if (names.length === 1 || expanded) {
    return (
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {names.map((n) => (
          <span key={n} className="tag-chip" style={{ fontSize: 11, padding: '2px 7px' }}>{n}</span>
        ))}
        {expanded && (
          <button type="button" className="btn-ghost" style={{ fontSize: 10.5, padding: '2px 6px' }} onClick={() => setExpanded(false)}>
            Show less
          </button>
        )}
      </span>
    );
  }
  return (
    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      <span className="tag-chip" style={{ fontSize: 11, padding: '2px 7px' }}>{names[0]}</span>
      <button type="button" className="btn-ghost" style={{ fontSize: 10.5, padding: '2px 6px' }} onClick={() => setExpanded(true)}>
        +{names.length - 1} more
      </button>
    </span>
  );
}
