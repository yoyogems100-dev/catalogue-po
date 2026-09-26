'use client';

import { useMemo, useState } from 'react';
import { displayWhatsapp, LEAD_STATUSES, replyHref, STATUS_LABEL, type Lead, type LeadStatus, type ReplySettings } from '@/lib/site/leads';
import s from '@/components/admin/site/site-admin.module.css';

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong -- try again.');
  return data;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function LeadsClient({ initial, reply: initialReply }: { initial: Lead[]; reply: ReplySettings }) {
  const [leads, setLeads] = useState(initial);
  const [reply, setReply] = useState(initialReply);
  const [filter, setFilter] = useState<LeadStatus | 'all'>(initial.some((l) => l.status === 'new') ? 'new' : 'all');
  const [query, setQuery] = useState('');
  // A request whose status was just changed stays in view (so a note can
  // still be added) until the owner switches tab.
  const [kept, setKept] = useState<number[]>([]);
  const showTab = (st: LeadStatus | 'all') => { setFilter(st); setKept([]); };
  const [toast, setToast] = useState('');
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000); };

  const counts = useMemo(() => Object.fromEntries(LEAD_STATUSES.map((st) => [st, leads.filter((l) => l.status === st).length])), [leads]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return leads.filter((l) => (filter === 'all' || l.status === filter || kept.includes(l.id)) && (!q
      || `${l.name} ${l.business_city} ${l.category_names.join(' ')} ${l.monthly_requirement} ${l.notes}`.toLowerCase().includes(q)
      || (digits.length >= 3 && l.whatsapp.includes(digits))));
  }, [leads, filter, query, kept]);

  const update = (id: number, patch: Partial<Lead>) => setLeads((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  async function setStatus(l: Lead, status: LeadStatus) {
    if (l.status === status) return;
    const before = l.status; update(l.id, { status }); setKept((k) => [...k, l.id]);
    try { await send(`/api/admin/site/leads/${l.id}`, 'PATCH', { status }); flash(`Marked ${STATUS_LABEL[status]}.`); } catch (e: any) { update(l.id, { status: before }); flash(e.message); }
  }
  async function saveNotes(l: Lead, notes: string) {
    if (notes === l.notes) return;
    try { await send(`/api/admin/site/leads/${l.id}`, 'PATCH', { notes }); update(l.id, { notes }); flash('Note saved.'); } catch (e: any) { flash(e.message); }
  }
  async function remove(l: Lead) {
    if (!confirm(`Delete the request from ${l.name} (${displayWhatsapp(l.whatsapp)})?\n\nUse this for spam or tests. It cannot be undone.`)) return;
    try { await send(`/api/admin/site/leads/${l.id}`, 'DELETE'); setLeads((cur) => cur.filter((x) => x.id !== l.id)); flash('Request deleted.'); } catch (e: any) { flash(e.message); }
  }

  return (
    <>
      <ReplySettingsPanel reply={reply} onSaved={(r) => { setReply(r); flash('Reply message saved.'); }} />

      <div className={s.tabs} role="tablist" aria-label="Filter by status">
        {(['new', 'sent', 'closed', 'all'] as const).map((st) => (
          <button key={st} type="button" role="tab" aria-selected={filter === st} onClick={() => showTab(st)}>
            {st === 'all' ? `All (${leads.length})` : `${STATUS_LABEL[st]} (${counts[st]})`}
          </button>
        ))}
      </div>
      <div className={s.toolbar}>
        <input type="search" placeholder="Search name, city, number, category…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search requests" />
        <a className="btn-ghost" href={`/api/admin/site/leads/export${filter === 'all' ? '' : `?status=${filter}`}`} download>
          Download CSV{filter === 'all' ? '' : ` (${STATUS_LABEL[filter]})`}
        </a>
      </div>

      {!shown.length && (
        <p className={s.note}>{leads.length ? 'No requests match.' : 'No catalogue requests yet. They appear here as soon as someone sends the form.'}</p>
      )}
      <ul className={s.leadList}>
        {shown.map((l) => (
          <li key={l.id} className={`${s.leadCard} ${l.status === 'new' ? s.leadNew : ''}`}>
            <div className={s.leadHead}>
              <div className={s.leadWho}>
                <strong>{l.name}</strong>
                <span>{l.business_city}</span>
              </div>
              <time dateTime={l.created_at} className={s.leadTime}>{when(l.created_at)}</time>
            </div>
            <dl className={s.leadFacts}>
              <div><dt>WhatsApp</dt><dd><a href={`tel:+${displayWhatsapp(l.whatsapp).replace(/\D/g, '')}`}>{displayWhatsapp(l.whatsapp)}</a></dd></div>
              <div><dt>Categories</dt><dd>{l.category_names.length ? l.category_names.join(', ') : <span className={s.muted}>Not specified</span>}</dd></div>
              <div><dt>Monthly requirement</dt><dd>{l.monthly_requirement || <span className={s.muted}>Not given</span>}</dd></div>
              {l.source_path && <div><dt>Sent from</dt><dd><a href={l.source_path} target="_blank" rel="noopener noreferrer">{l.source_path}</a></dd></div>}
            </dl>
            <div className={s.leadActions}>
              <a className="btn" href={replyHref(reply.message, l, reply.catalogue_link)} target="_blank" rel="noopener noreferrer"
                title={reply.catalogue_link ? undefined : 'Add your catalogue link under “Reply message” first'}>
                Reply on WhatsApp
              </a>
              <div className={s.segmented} role="group" aria-label={`Status for ${l.name}`}>
                {LEAD_STATUSES.map((st) => (
                  <button key={st} type="button" aria-pressed={l.status === st} onClick={() => setStatus(l, st)}>{STATUS_LABEL[st]}</button>
                ))}
              </div>
            </div>
            <label className={s.leadNotes}>
              <span className={s.label}>Internal notes</span>
              <textarea rows={2} defaultValue={l.notes} maxLength={2000} placeholder="Only you see this." onBlur={(e) => saveNotes(l, e.target.value)} />
            </label>
            <button type="button" className={s.linkBtn} onClick={() => remove(l)}>Delete</button>
          </li>
        ))}
      </ul>
      {toast && <p className="po-toast" role="status" aria-live="polite">{toast}</p>}
    </>
  );
}

function ReplySettingsPanel({ reply, onSaved }: { reply: ReplySettings; onSaved: (r: ReplySettings) => void }) {
  const [draft, setDraft] = useState(reply);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try { const { reply: saved } = await send('/api/admin/site/leads/reply', 'PUT', draft); setDraft(saved); onSaved(saved); }
    catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  }
  return (
    <details className={s.group} open={!reply.catalogue_link}>
      <summary className={s.label} style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}>
        Reply message {!reply.catalogue_link && <span className={`${s.pill} ${s.pillDraft}`}>Add your catalogue link</span>}
      </summary>
      <form onSubmit={save} style={{ marginTop: 8 }}>
        <div className={s.field}>
          <label htmlFor="reply-link">Catalogue link</label>
          <p className={s.help}>The private link to your digital catalogue (Google Drive, PDF, etc.). It is only put into your WhatsApp reply, never shown on the website.</p>
          <input id="reply-link" type="text" inputMode="url" placeholder="https://…" value={draft.catalogue_link} onChange={(e) => setDraft({ ...draft, catalogue_link: e.target.value })} />
        </div>
        <div className={s.field}>
          <label htmlFor="reply-msg">Message</label>
          <p className={s.help}>{'{first_name}'}, {'{name}'}, {'{business}'}, {'{categories}'} and {'{link}'} are filled in for each request.</p>
          <textarea id="reply-msg" rows={6} maxLength={1000} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} />
        </div>
        {error && <p role="alert" className={s.help} style={{ color: '#a3341f' }}>{error}</p>}
        <button type="submit" className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save reply message'}</button>
      </form>
    </details>
  );
}
