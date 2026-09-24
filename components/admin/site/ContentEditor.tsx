'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentSchema, ContentValue, Field } from '@/lib/site/schema';
import { withDefaults } from '@/lib/site/schema';
import { categorySchema } from '@/lib/site/schemas';
import { pageSchemas } from '@/lib/site/page-schemas';
import type { MediaRow } from '@/lib/site/media-url';
import RichTextEditor from './RichTextEditor';
import MediaPicker, { Thumb } from './MediaPicker';
import Sortable from './Sortable';
import s from './site-admin.module.css';

type Props = {
  entity: 'page' | 'category';
  entityKey: string;
  initialDraft: ContentValue;
  initialPublished: ContentValue | null;
  publishedAt: string | null;
  viewHref?: string;
  media: MediaRow[];
};

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

function schemaFor(entity: Props['entity'], key: string): ContentSchema {
  return entity === 'category' ? categorySchema : pageSchemas[key];
}

const stable = (v: unknown) => JSON.stringify(v);
const time = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function ContentEditor({ entity, entityKey, initialDraft, initialPublished, publishedAt: initialPublishedAt, viewHref, media: initialMedia }: Props) {
  const schema = schemaFor(entity, entityKey);
  const [value, setValue] = useState<ContentValue>(() => withDefaults(schema, initialDraft));
  const [published, setPublished] = useState<string>(() => stable(withDefaults(schema, initialPublished || {})));
  const [publishedAt, setPublishedAt] = useState(initialPublishedAt);
  const [state, setState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [media, setMedia] = useState<Record<number, MediaRow>>(() => Object.fromEntries(initialMedia.map((m) => [m.id, m])));
  const [history, setHistory] = useState<{ id: number; kind: string; created_at: string }[] | null>(null);
  const [openSection, setOpenSection] = useState<string>(schema.sections[0]?.key);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  latest.current = value;

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setState('saving');
    try {
      const res = await fetch('/api/admin/site/content', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity, key: entityKey, draft: latest.current })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save');
      setSavedAt(body.updated_at);
      setState((prev) => (stable(latest.current) === stable(body.draft) || prev === 'saving' ? 'saved' : 'dirty'));
      return true;
    } catch (e: any) {
      setState('error');
      setMessage(e.message || 'Could not save');
      return false;
    }
  }, [entity, entityKey]);

  function update(next: ContentValue) {
    setValue(next);
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1200);
  }

  // Warn before leaving with an unsaved edit; flush on tab hide.
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (state === 'dirty' || state === 'saving') { e.preventDefault(); } };
    const hide = () => { if (document.visibilityState === 'hidden' && timer.current) save(); };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', hide); };
  }, [state, save]);

  async function doPublish() {
    if (state !== 'saved' && !(await save())) return;
    setMessage('Publishing…');
    const res = await fetch('/api/admin/site/content', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, key: entityKey, action: 'publish' })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(body.error || 'Could not publish'); return; }
    setPublished(stable(latest.current));
    setPublishedAt(body.published_at);
    setMessage('Published. The live page now shows these changes.');
    setHistory(null);
  }

  async function loadHistory() {
    const res = await fetch(`/api/admin/site/content?entity=${entity}&key=${encodeURIComponent(entityKey)}`);
    const body = await res.json().catch(() => ({}));
    setHistory(body.revisions || []);
  }

  async function restore(id: number) {
    if (!confirm('Put this earlier version back into the draft? The live page will not change until you publish.')) return;
    const res = await fetch('/api/admin/site/content', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, key: entityKey, action: 'restore', revision_id: id })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setMessage(body.error || 'Could not restore'); return; }
    const restored = withDefaults(schema, body.draft);
    const missing = collectIds(restored).filter((mid) => !media[mid]);
    if (missing.length) {
      const r = await fetch(`/api/admin/site/media?ids=${missing.join(',')}`).then((x) => x.json()).catch(() => ({}));
      setMedia((prev) => ({ ...prev, ...Object.fromEntries((r.media || []).map((m: MediaRow) => [m.id, m])) }));
    }
    setValue(restored);
    setState('saved');
    setSavedAt(body.updated_at);
    setMessage('Earlier version restored to the draft.');
    loadHistory();
  }

  function collectIds(v: ContentValue): number[] {
    const out: number[] = [];
    JSON.stringify(v, (k, x) => { if (/image$/.test(k) && typeof x === 'number') out.push(x); return x; });
    return out;
  }

  const hasUnpublished = useMemo(() => stable(value) !== published, [value, published]);
  const status = state === 'saving' ? 'Saving…'
    : state === 'dirty' ? 'Unsaved changes'
    : state === 'error' ? `Not saved — ${message}`
    : savedAt ? `Draft saved ${time(savedAt)}` : 'All changes saved';

  return (
    <div className={s.editor}>
      <div className={s.publishBar}>
        <div className={s.publishStatus}>
          <span className={`${s.dot} ${state === 'error' ? s.dotError : hasUnpublished ? s.dotDraft : s.dotLive}`} aria-hidden="true" />
          <div>
            <strong>{hasUnpublished ? 'Draft has changes not yet live' : publishedAt ? 'Live page is up to date' : 'Not published yet'}</strong>
            <span>{status}{publishedAt ? ` · Last published ${time(publishedAt)}` : ''}</span>
          </div>
        </div>
        <div className={s.publishActions}>
          {viewHref && <a className="btn-ghost" href={viewHref} target="_blank" rel="noopener noreferrer">View page ↗</a>}
          <button type="button" className="btn-ghost" onClick={() => (history ? setHistory(null) : loadHistory())}>{history ? 'Hide history' : 'History'}</button>
          <button type="button" className="btn" onClick={doPublish} disabled={!hasUnpublished && !!publishedAt}>Publish</button>
        </div>
      </div>
      {message && state !== 'error' && <p className={s.note} role="status">{message}</p>}

      {history && (
        <div className={s.history}>
          <h3>Earlier versions</h3>
          {!history.length && <p className={s.note}>No earlier versions yet.</p>}
          <ul>
            {history.map((r) => (
              <li key={r.id}>
                <span>{r.kind === 'publish' ? 'Published' : 'Text as it was'} · {time(r.created_at)}</span>
                <button type="button" className="btn-ghost" onClick={() => restore(r.id)}>Restore</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {schema.sections.map((section) => (
        <section key={section.key} className={s.section}>
          <button type="button" className={s.sectionHead} aria-expanded={openSection === section.key}
            onClick={() => setOpenSection(openSection === section.key ? '' : section.key)}>
            <span>{section.title}</span><span aria-hidden="true">{openSection === section.key ? '−' : '+'}</span>
          </button>
          {openSection === section.key && (
            <div className={s.sectionBody}>
              {section.help && <p className={s.help}>{section.help}</p>}
              <Fields
                fields={section.fields}
                value={value[section.key] || {}}
                path={section.key}
                media={media}
                onMedia={(rows) => setMedia((prev) => ({ ...prev, ...Object.fromEntries(rows.map((m) => [m.id, m])) }))}
                onChange={(v) => update({ ...value, [section.key]: v })}
              />
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function Fields({ fields, value, onChange, path, media, onMedia }: {
  fields: Field[]; value: ContentValue; onChange: (v: ContentValue) => void; path: string;
  media: Record<number, MediaRow>; onMedia: (rows: MediaRow[]) => void;
}) {
  return (
    <>
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={value[f.key]} id={`${path}.${f.key}`} media={media} onMedia={onMedia}
          onChange={(v) => onChange({ ...value, [f.key]: v })} />
      ))}
    </>
  );
}

function FieldInput({ field, value, onChange, id, media, onMedia }: {
  field: Field; value: any; onChange: (v: any) => void; id: string;
  media: Record<number, MediaRow>; onMedia: (rows: MediaRow[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const help = field.help ? <p className={s.help}>{field.help}</p> : null;

  switch (field.type) {
    case 'text':
      return <div className={s.field}><label htmlFor={id}>{field.label}</label>{help}
        <input id={id} type="text" value={value || ''} maxLength={field.max ?? 300} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} /></div>;
    case 'textarea':
      return <div className={s.field}><label htmlFor={id}>{field.label}</label>{help}
        <textarea id={id} rows={3} value={value || ''} maxLength={field.max ?? 2000} onChange={(e) => onChange(e.target.value)} /></div>;
    case 'link':
      return <div className={s.field}><label htmlFor={id}>{field.label}</label>{help}
        <input id={id} type="text" inputMode="url" value={value || ''} placeholder="/request-catalogue or https://…" onChange={(e) => onChange(e.target.value)} /></div>;
    case 'rich':
      return <div className={s.field}><label htmlFor={id}>{field.label}</label>{help}
        <RichTextEditor id={id} label={field.label} value={value || ''} onChange={onChange} /></div>;
    case 'toggle':
      return <div className={s.field}><label className={s.toggle}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {field.label}</label>{help}</div>;
    case 'image': {
      const m = typeof value === 'number' ? media[value] : null;
      return <div className={s.field}><span className={s.label}>{field.label}</span>{help}
        <div className={s.imageField}>
          {m ? <Thumb media={m} size={96} /> : <div className={s.imageEmpty}>{value ? 'Image removed' : 'No image'}</div>}
          <div className={s.imageActions}>
            <button type="button" className="btn-ghost" onClick={() => setPicking(true)}>{value ? 'Change' : 'Choose image'}</button>
            {value && <button type="button" className="btn-ghost" onClick={() => onChange(null)}>Remove</button>}
          </div>
        </div>
        <MediaPicker open={picking} onClose={() => setPicking(false)} onPick={(rows) => { onMedia(rows); onChange(rows[0]?.id ?? null); }} />
      </div>;
    }
    case 'group':
      return <fieldset className={s.group}><legend>{field.label}</legend>{help}
        <Fields fields={field.fields} value={value || {}} onChange={onChange} path={id} media={media} onMedia={onMedia} /></fieldset>;
    case 'list': {
      const items: ContentValue[] = Array.isArray(value) ? value : [];
      const keyed = items.map((item, i) => ({ item, i }));
      return <fieldset className={s.group}><legend>{field.label}</legend>{help}
        <Sortable
          items={keyed}
          getId={(x) => x.i}
          label={(x) => `${field.itemLabel} ${x.i + 1}`}
          onReorder={(next) => onChange(next.map((x) => x.item))}
          render={(x, index) => (
            <div className={s.listItem}>
              <div className={s.listItemHead}>
                <span>{field.itemLabel} {index + 1}</span>
                <button type="button" className={s.linkBtn} onClick={() => onChange(items.filter((_, j) => j !== x.i))}>Remove</button>
              </div>
              <Fields fields={field.fields} value={x.item} path={`${id}.${x.i}`} media={media} onMedia={onMedia}
                onChange={(v) => onChange(items.map((it, j) => (j === x.i ? v : it)))} />
            </div>
          )}
        />
        {(field.max === undefined || items.length < field.max) && (
          <button type="button" className="btn-ghost" onClick={() => onChange([...items, Object.fromEntries(field.fields.map((f) => [f.key, f.type === 'image' ? null : f.type === 'toggle' ? false : f.type === 'list' ? [] : '']))])}>
            + Add {field.itemLabel.toLowerCase()}
          </button>
        )}
      </fieldset>;
    }
  }
}
