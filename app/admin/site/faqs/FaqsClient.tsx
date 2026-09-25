'use client';

import { useState } from 'react';
import Sortable from '@/components/admin/site/Sortable';
import RichTextEditor from '@/components/admin/site/RichTextEditor';
import EarlierVersions from '@/components/admin/site/EarlierVersions';
import { richTextToPlain } from '@/lib/site/rich-text';
import s from '@/components/admin/site/site-admin.module.css';

type Faq = { id: number; question: string; answer: string; sort_order: number; is_visible: boolean };

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong -- try again.');
  return data;
}

export default function FaqsClient({ initial }: { initial: Faq[] }) {
  const [faqs, setFaqs] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState('');
  const [toast, setToast] = useState('');
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000); };

  async function reorder(next: Faq[]) {
    const before = faqs; setFaqs(next);
    try { await send('/api/admin/site/faqs', 'PUT', { ids: next.map((f) => f.id) }); flash('Order saved.'); } catch (e: any) { setFaqs(before); flash(e.message); }
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestion.trim()) return;
    try {
      const { id } = await send('/api/admin/site/faqs', 'POST', { question: newQuestion });
      setFaqs([...faqs, { id, question: newQuestion.trim(), answer: '', sort_order: 99999, is_visible: true }]);
      setNewQuestion(''); setEditing(id);
    } catch (err: any) { flash(err.message); }
  }
  async function remove(f: Faq) {
    if (!confirm(`Delete this question?\n\n“${f.question}”\n\nTo take it off the site but keep it, use Edit → untick “Show on the website” instead.`)) return;
    try { await send(`/api/admin/site/faqs/${f.id}`, 'DELETE'); setFaqs(faqs.filter((x) => x.id !== f.id)); flash('Question deleted.'); } catch (e: any) { flash(e.message); }
  }

  return (
    <>
      {!faqs.length && <p className={s.note}>No questions yet. Add the first one below.</p>}
      <Sortable
        items={faqs}
        getId={(f) => f.id}
        label={(f) => f.question}
        onReorder={reorder}
        render={(f) => editing === f.id
          ? <FaqEditor faq={f} onDone={(saved) => { if (saved) setFaqs(faqs.map((x) => x.id === f.id ? saved : x)); setEditing(null); if (saved) flash('Saved. The FAQ page is updated.'); }} />
          : (
            <div className={s.catRow}>
              <strong>{f.question}</strong>
              {!f.is_visible && <span className={`${s.pill} ${s.pillHidden}`}>Hidden</span>}
              <span className={s.catRowMeta}>{richTextToPlain(f.answer).slice(0, 110) || 'No answer yet'}</span>
              <span className={s.catRowActions}>
                <button type="button" className="btn-ghost" onClick={() => setEditing(f.id)}>Edit</button>
                <button type="button" className={s.linkBtn} onClick={() => remove(f)}>Delete</button>
              </span>
            </div>
          )}
      />
      <form className={s.addRow} onSubmit={add}>
        <input type="text" placeholder="New question, e.g. Do you ship outside India?" value={newQuestion} maxLength={200} onChange={(e) => setNewQuestion(e.target.value)} aria-label="New question" />
        <button className="btn" type="submit">Add question</button>
      </form>
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </>
  );
}

function FaqEditor({ faq, onDone }: { faq: Faq; onDone: (saved: Faq | null) => void }) {
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);
  const [visible, setVisible] = useState(faq.is_visible);
  const [error, setError] = useState('');
  async function save() {
    try {
      const out = await send(`/api/admin/site/faqs/${faq.id}`, 'PATCH', { question, answer, is_visible: visible });
      onDone({ ...faq, question: out.question ?? question, answer: out.answer ?? answer, is_visible: visible });
    } catch (e: any) { setError(e.message); }
  }
  return (
    <div style={{ padding: '6px 4px' }}>
      <div className={s.field}><label htmlFor={`fq-${faq.id}`}>Question</label>
        <input id={`fq-${faq.id}`} type="text" value={question} maxLength={200} onChange={(e) => setQuestion(e.target.value)} /></div>
      <div className={s.field}><label htmlFor={`fa-${faq.id}`}>Answer</label>
        <RichTextEditor id={`fa-${faq.id}`} label="Answer" value={answer} onChange={setAnswer} /></div>
      <div className={s.field}><label className={s.toggle}><input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Show on the website</label></div>
      <EarlierVersions<{ question: string; answer: string }> url={`/api/admin/site/faqs/${faq.id}`}
        describe={(c) => c.question} onPick={(c) => { setQuestion(c.question || ''); setAnswer(c.answer || ''); }} />
      {error && <p className={s.note} role="alert">{error}</p>}
      <div className={s.toolbar}><button type="button" className="btn" onClick={save}>Save</button><button type="button" className="btn-ghost" onClick={() => onDone(null)}>Cancel</button></div>
    </div>
  );
}
