'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ColorSwatch from '@/components/ColorSwatch';
import { FIELD_LABEL_MAX, type FieldKey, type FormFields, type HideableField } from '@/lib/form-fields';
import { QUANTITY_LABEL_MAX, type QuantityField } from '@/lib/quantity-field';

type Shape = { id: number; name: string; refPhotoUrl: string | null };
type Colour = { id: number; name: string; hex: string | null; refPhotoUrl: string | null };
type Key = FieldKey | 'qty';

const USUAL: Record<Key, string> = { quality: 'Quality', shape: 'Shape/Cut', color: 'Color', size: 'Size', qty: 'Qty (pcs)' };

/**
 * The category's order form as a buyer sees it, editable in place. Double-tap
 * a field's name (or ✎) to rename it; × hides a field, + Add field brings one
 * back or adds Quality. Each change saves straight away and shows on the
 * category page.
 *
 * Every order line needs a shape, colour and size, so those hide only while
 * there's a single option (then it's picked for the buyer); quantity always
 * stays.
 */
export default function OrderFormDesigner({
  categoryId, categoryName, slug, special, optionLabel, shapes, colours, sizes, fields, qualities, knownQualities, quantityField
}: {
  categoryId: number;
  categoryName: string;
  slug: string | null;
  /** Rainbow Corundum and Hole Punched order on their own forms. */
  special: string | null;
  optionLabel: string | null;
  shapes: Shape[];
  colours: Colour[];
  /** Distinct sizes, as a buyer sees them. */
  sizes: string[];
  fields: FormFields;
  qualities: string[];
  knownQualities: string[];
  quantityField: QuantityField;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Key | null>(null);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [pickQualities, setPickQualities] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const usual = (key: Key) => (key === 'color' ? optionLabel || USUAL.color : USUAL[key]);
  const labelOf = (key: Key) => (key === 'qty' ? quantityField.label : fields.labels[key]) || usual(key);
  const count: Record<HideableField, number> = { shape: shapes.length, color: colours.length, size: sizes.length };
  const isHidden = (key: HideableField) => fields.hidden.includes(key) && count[key] === 1;

  async function post(url: string, body: unknown, done: string) {
    setBusy(true);
    setStatus(null);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setStatus({ tone: 'error', text: data.error || 'Could not save -- try again.' }); return false; }
    setStatus({ tone: 'ok', text: done });
    router.refresh();
    return true;
  }
  const saveFields = (next: FormFields, done: string) => post(`/api/admin/categories/${categoryId}/form-fields`, next, done);
  const saveQualities = (next: string[], done: string) => post(`/api/admin/categories/${categoryId}/qualities`, { qualities: next }, done);

  function startRename(key: Key) { setEditing(key); setDraft(labelOf(key)); setStatus(null); }
  async function rename(key: Key) {
    const name = draft.replace(/\s+/g, ' ').trim();
    setEditing(null);
    if (name === labelOf(key)) return;
    const value = name === usual(key) ? '' : name;
    if (key === 'qty') {
      await post(`/api/admin/categories/${categoryId}/quantity-field`, { ...quantityField, label: value || null }, `Quantity field is now “${name || usual(key)}”.`);
    } else {
      const labels = { ...fields.labels, [key]: value || undefined };
      await saveFields({ ...fields, labels }, `${usual(key)} field is now “${name || usual(key)}”.`);
    }
  }

  async function hide(key: HideableField) {
    await saveFields({ ...fields, hidden: [...fields.hidden.filter((k) => k !== key), key] }, `${labelOf(key)} is hidden; buyers get the only option.`);
  }
  async function show(key: HideableField) {
    await saveFields({ ...fields, hidden: fields.hidden.filter((k) => k !== key) }, `${labelOf(key)} is shown again.`);
  }
  async function removeQuality() {
    if (!confirm(`Remove the ${labelOf('quality')} field? Buyers will no longer choose ${qualities.join(' / ')}. Past orders keep theirs.`)) return;
    await saveQualities([], `${labelOf('quality')} field removed.`);
  }

  function label(k: Key) {
    if (editing === k) {
      return (
        <form className="fd-rename" onSubmit={(e) => { e.preventDefault(); void rename(k); }}>
          <input autoFocus value={draft} maxLength={k === 'qty' ? QUANTITY_LABEL_MAX : FIELD_LABEL_MAX} aria-label={`Name for the ${usual(k)} field`}
            onChange={(e) => setDraft(e.target.value)} onBlur={() => void rename(k)} onKeyDown={(e) => { if (e.key === 'Escape') setEditing(null); }} />
        </form>
      );
    }
    return (
      <span className="fd-label-row">
        <span className="po-label fd-label" onDoubleClick={() => startRename(k)} title="Double-tap to rename">{labelOf(k)}</span>
        <button type="button" className="fd-icon" aria-label={`Rename ${labelOf(k)}`} disabled={busy} onClick={() => startRename(k)}>✎</button>
      </span>
    );
  }

  function remove(k: HideableField) {
    if (count[k] === 1) return <button type="button" className="fd-icon fd-remove" aria-label={`Hide ${labelOf(k)}`} title="Hide from buyers" disabled={busy} onClick={() => void hide(k)}>×</button>;
    return <span className="fd-lock" title={`Buyers choose from ${count[k]} — every order needs one, so this field stays.`} aria-label="Always shown">🔒</span>;
  }

  if (special) {
    return (
      <section className="card fd-wrap">
        <h2>Order form</h2>
        <p className="fd-note">{categoryName} uses its own order form ({special === 'rainbow' ? 'strips and colours' : 'number of holes'}), so its fields can’t be changed here. <a href={`/po/category/${slug}`} target="_blank" rel="noreferrer">See it as a buyer ↗</a></p>
      </section>
    );
  }

  const hiddenKeys = (['shape', 'color', 'size'] as HideableField[]).filter(isHidden);
  const addable = qualities.length === 0 || hiddenKeys.length > 0;
  const preview = <T,>(list: T[], n = 4) => list.slice(0, n);

  return (
    <section className="card fd-wrap">
      <div className="fd-head">
        <div>
          <h2>Order form</h2>
          <p className="fd-note">What a buyer sees on {categoryName}. Double-tap a field name to rename it, × to hide it, + to add one. Changes show on the site straight away.</p>
        </div>
        {slug && <a className="btn-ghost" href={`/po/category/${slug}`} target="_blank" rel="noreferrer">Open as buyer ↗</a>}
      </div>
      {status && <p role="status" className={`catmap-status ${status.tone}`}>{status.text}</p>}

      <div className="po-card fd-form">
        <h3 className="po-heading">Add to Order</h3>
        <div className="fd-fields">
          {qualities.length > 0 && (
            <div className="fd-field">
              <div className="fd-field-head">{label('quality')}<button type="button" className="fd-icon fd-remove" aria-label={`Remove ${labelOf('quality')}`} disabled={busy} onClick={() => void removeQuality()}>×</button></div>
              <div className="po-type-toggle fd-mock">{qualities.map((q) => <span key={q} className="fd-chip">{q}</span>)}</div>
              <small className="fd-hint">Edit the list in the Quality row above.</small>
            </div>
          )}
          {!isHidden('color') && (
            <div className="fd-field">
              <div className="fd-field-head">{label('color')}{remove('color')}</div>
              <div className="fd-mock fd-select">
                {preview(colours).map((c) => <ColorSwatch key={c.id} hex={c.hex || '#ccc'} refPhotoUrl={c.refPhotoUrl} size={18} />)}
                <span>{colours.length === 1 ? colours[0].name : `Choose ${labelOf('color').toLowerCase()} · ${colours.length}`}</span>
              </div>
            </div>
          )}
          {!isHidden('shape') && (
            <div className="fd-field">
              <div className="fd-field-head">{label('shape')}{remove('shape')}</div>
              <div className="fd-mock fd-select">
                {preview(shapes).map((s) => s.refPhotoUrl ? <img key={s.id} src={s.refPhotoUrl} alt="" width={18} height={18} /> : null)}
                <span>{shapes.length === 1 ? shapes[0].name : `Choose ${labelOf('shape').toLowerCase()} · ${shapes.length}`}</span>
              </div>
            </div>
          )}
          {!isHidden('size') && (
            <div className="fd-field">
              <div className="fd-field-head">{label('size')}{remove('size')}</div>
              <div className="fd-mock fd-select"><span>{sizes.length === 1 ? `${sizes[0]} mm` : `Choose ${labelOf('size').toLowerCase()} · ${sizes.length}`}</span></div>
            </div>
          )}
          <div className="fd-field">
            <div className="fd-field-head">{label('qty')}<span className="fd-lock" title="Every order needs a quantity, so this field stays." aria-label="Always shown">🔒</span></div>
            <div className="fd-mock fd-select fd-qty"><span>{quantityField.defaultQty ? `e.g. ${quantityField.defaultQty}` : 'e.g. 5000'}</span></div>
          </div>
        </div>

        {hiddenKeys.length > 0 && (
          <p className="fd-hidden-note">Hidden: {hiddenKeys.map((k) => {
            const only = k === 'color' ? colours[0]?.name : k === 'shape' ? shapes[0]?.name : `${sizes[0]} mm`;
            return <span key={k}>{labelOf(k)} (always {only})</span>;
          }).reduce<React.ReactNode[]>((all, el, i) => (i ? [...all, ', ', el] : [el]), [])}</p>
        )}

        {addable && (adding ? (
          <div className="fd-add">
            {hiddenKeys.map((k) => <button key={k} type="button" className="tag-chip fd-add-option" disabled={busy} onClick={() => { void show(k); setAdding(false); }}>+ {labelOf(k)}</button>)}
            {qualities.length === 0 && !pickQualities && <button type="button" className="tag-chip fd-add-option" onClick={() => setPickQualities(true)}>+ {labelOf('quality')}</button>}
            {pickQualities && (
              <QualityPicker known={knownQualities} busy={busy} onSave={async (list) => { if (await saveQualities(list, `${labelOf('quality')} field added: ${list.join(' / ')}.`)) { setPickQualities(false); setAdding(false); } }} />
            )}
            <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setPickQualities(false); }}>Done</button>
          </div>
        ) : (
          <button type="button" className="btn-ghost fd-add-btn" onClick={() => setAdding(true)}>+ Add field</button>
        ))}
      </div>
    </section>
  );
}

function QualityPicker({ known, busy, onSave }: { known: string[]; busy: boolean; onSave: (list: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (q: string) => setPicked((cur) => (cur.includes(q) ? cur.filter((x) => x !== q) : [...cur, q]));
  return (
    <div className="fd-quality-pick">
      <span className="fd-hint">Tap the qualities buyers choose from:</span>
      <div className="po-type-toggle">
        {known.map((q) => <button key={q} type="button" aria-pressed={picked.includes(q)} className={picked.includes(q) ? 'active' : ''} onClick={() => toggle(q)}>{q}</button>)}
      </div>
      <button type="button" className="btn" disabled={busy || picked.length === 0} onClick={() => onSave(known.filter((q) => picked.includes(q)))}>{busy ? 'Saving…' : 'Add field'}</button>
    </div>
  );
}
