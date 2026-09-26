'use client';

import { useState } from 'react';
import Sortable from '@/components/admin/site/Sortable';
import RichTextEditor from '@/components/admin/site/RichTextEditor';
import EarlierVersions from '@/components/admin/site/EarlierVersions';
import s from '@/components/admin/site/site-admin.module.css';

type Grade = { id: number; code: string; name: string; summary: string; description: string; sort_order: number; is_visible: boolean };

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong -- try again.');
  return data;
}

export default function GradesClient({ initial, usedIn }: { initial: Grade[]; usedIn: Record<number, string[]> }) {
  const [grades, setGrades] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState('');
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000); };

  async function reorder(next: Grade[]) {
    const before = grades; setGrades(next);
    try { await send('/api/admin/site/grades', 'PUT', { ids: next.map((g) => g.id) }); flash('Order saved.'); } catch (e: any) { setGrades(before); flash(e.message); }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      const { id } = await send('/api/admin/site/grades', 'POST', { name: newName });
      setGrades([...grades, { id, code: '', name: newName.trim(), summary: '', description: '', sort_order: 9999, is_visible: true }]);
      setNewName(''); setEditing(id);
    } catch (err: any) { flash(err.message); }
  }
  async function remove(g: Grade) {
    const where = usedIn[g.id]?.length ? ` It is set on: ${usedIn[g.id].join(', ')}.` : '';
    if (!confirm(`Delete grade ${g.name}?${where}`)) return;
    try { await send(`/api/admin/site/grades/${g.id}`, 'DELETE'); setGrades(grades.filter((x) => x.id !== g.id)); flash(`${g.name} deleted.`); } catch (e: any) { flash(e.message); }
  }

  return (
    <>
      <Sortable
        items={grades}
        getId={(g) => g.id}
        label={(g) => g.name}
        onReorder={reorder}
        render={(g) => editing === g.id
          ? <GradeEditor grade={g} onDone={(saved) => { if (saved) setGrades(grades.map((x) => x.id === g.id ? saved : x)); setEditing(null); if (saved) flash('Saved.'); }} />
          : (
            <div className={s.catRow}>
              <strong>{g.name}</strong>
              {!g.is_visible && <span className={`${s.pill} ${s.pillHidden}`}>Hidden</span>}
              <span className={s.catRowMeta}>{g.summary || 'No summary yet'}{usedIn[g.id]?.length ? ` · ${usedIn[g.id].length} categor${usedIn[g.id].length > 1 ? 'ies' : 'y'}` : ''}</span>
              <span className={s.catRowActions}>
                <button type="button" className="btn-ghost" onClick={() => setEditing(g.id)}>Edit</button>
                <button type="button" className={s.linkBtn} onClick={() => remove(g)}>Delete</button>
              </span>
            </div>
          )}
      />
      <form className={s.addRow} onSubmit={add}>
        <input type="text" placeholder="New grade, e.g. 6A" value={newName} maxLength={40} onChange={(e) => setNewName(e.target.value)} />
        <button className="btn" type="submit">Add grade</button>
      </form>
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </>
  );
}

function GradeEditor({ grade, onDone }: { grade: Grade; onDone: (saved: Grade | null) => void }) {
  const [name, setName] = useState(grade.name);
  const [summary, setSummary] = useState(grade.summary);
  const [description, setDescription] = useState(grade.description);
  const [visible, setVisible] = useState(grade.is_visible);
  const [error, setError] = useState('');
  async function save() {
    try {
      const out = await send(`/api/admin/site/grades/${grade.id}`, 'PATCH', { name, summary, description, is_visible: visible });
      onDone({ ...grade, name: out.name ?? name, summary: out.summary ?? summary, description: out.description ?? description, is_visible: visible });
    } catch (e: any) { setError(e.message); }
  }
  return (
    <div style={{ padding: '6px 4px' }}>
      <div className={s.field}><label htmlFor={`gn-${grade.id}`}>Name</label>
        <input id={`gn-${grade.id}`} type="text" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
      <div className={s.field}><label htmlFor={`gs-${grade.id}`}>One-line summary</label>
        <input id={`gs-${grade.id}`} type="text" value={summary} maxLength={160} onChange={(e) => setSummary(e.target.value)} /></div>
      <div className={s.field}><label htmlFor={`gd-${grade.id}`}>Full explanation</label>
        <RichTextEditor id={`gd-${grade.id}`} label="Full explanation" value={description} onChange={setDescription} /></div>
      <EarlierVersions<{ summary: string; description: string }> url={`/api/admin/site/grades/${grade.id}`}
        describe={(c) => c.summary || c.description}
        onPick={(c) => { setSummary(c.summary || ''); setDescription(c.description || ''); }} />
      <div className={s.field}><label className={s.toggle}><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Show on the website</label></div>
      {error && <p className={s.note} role="alert">{error}</p>}
      <div className={s.toolbar}><button type="button" className="btn" onClick={save}>Save</button><button type="button" className="btn-ghost" onClick={() => onDone(null)}>Cancel</button></div>
    </div>
  );
}
