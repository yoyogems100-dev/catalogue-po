'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_DESCRIPTION_MAX } from '@/lib/category-description';

// The one line buyers see under the category's name -- on its homepage card
// and at the top of its page. Saved on Enter or when the box loses focus.
export default function CategoryDescriptionField({ id, initial }: { id: number; initial: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial || '');
  const [saved, setSaved] = useState(initial || '');
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('');
  const [error, setError] = useState('');

  async function save() {
    const line = value.replace(/\s+/g, ' ').trim();
    if (line === saved || state === 'saving') return;
    setState('saving'); setError('');
    const res = await fetch('/api/categories', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, description: line })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setState('error'); setError(data.error || 'Could not save the description.'); return; }
    setValue(line); setSaved(line); setState('saved');
    router.refresh();
  }

  return (
    <div className="admin-cat-description">
      <label htmlFor={`cat-desc-${id}`}>Line under the name</label>
      <input
        id={`cat-desc-${id}`}
        type="text"
        value={value}
        maxLength={CATEGORY_DESCRIPTION_MAX}
        placeholder="e.g. Flat on both sides like a coin, perfect for chains"
        onChange={(e) => { setValue(e.target.value); setState(''); }}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } }}
      />
      <span className="admin-cat-description-state" role={state === 'error' ? 'alert' : 'status'}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? (saved ? 'Saved — buyers see it on the card and category page.' : 'Removed.') : state === 'error' ? error : 'Shown to buyers on the homepage card and category page. Leave blank for none.'}
      </span>
    </div>
  );
}
