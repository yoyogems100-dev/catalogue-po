'use client';

import { useState } from 'react';
import { richTextToPlain } from '@/lib/site/rich-text';
import s from './site-admin.module.css';

// Undo for short text items (grades, FAQs): lists the wording as it was
// before each save; choosing one puts it back into the form, ready to Save.
export default function EarlierVersions<T extends Record<string, string>>({ url, describe, onPick }: {
  url: string; describe: (content: T) => string; onPick: (content: T) => void;
}) {
  const [list, setList] = useState<{ id: number; content: T; created_at: string }[] | null>(null);
  async function load() {
    const body = await fetch(url).then((r) => r.json()).catch(() => ({}));
    setList(body.revisions || []);
  }
  if (!list) return <button type="button" className={s.linkBtn} onClick={load}>Earlier wording…</button>;
  return (
    <div className={s.history}>
      <h3>Earlier wording</h3>
      {!list.length && <p className={s.note}>Nothing earlier yet. Each save keeps the previous wording here.</p>}
      <ul>
        {list.map((r) => (
          <li key={r.id}>
            <span>{new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {richTextToPlain(describe(r.content)).slice(0, 80)}</span>
            <button type="button" className="btn-ghost" onClick={() => { onPick(r.content); setList(null); }}>Use this</button>
          </li>
        ))}
      </ul>
      <button type="button" className={s.linkBtn} onClick={() => setList(null)}>Close</button>
    </div>
  );
}
