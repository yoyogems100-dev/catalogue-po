'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CANCELLED_STATUS, MAX_STAGE_LABEL, MAX_STAGE_MESSAGE, ORDER_STAGES_SETTING_KEY,
  orderPageUrl, renderStageMessage, type OrderStage
} from '@/lib/order-milestones';

// Sample values for the live preview only -- nothing is sent from this page.
const SAMPLE = { name: 'Rajesh', order: 1234, link: orderPageUrl(1234), login: '919876543210', pin: '4821', pdf: '', courier: 'DTDC' };

export default function StagesEditor({
  initial, defaults, placeholders, settingKey = ORDER_STAGES_SETTING_KEY, skip = []
}: {
  initial: OrderStage[];
  defaults: OrderStage[];
  placeholders: { token: string; meaning: string }[];
  /** Which saved list this edits (China route by default, or Jaipur dispatch). */
  settingKey?: string;
  /** Stages this route never uses -- not shown at all. */
  skip?: string[];
}) {
  const router = useRouter();
  const [stages, setStages] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const boxes = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const dirty = JSON.stringify(stages) !== saved;

  function update(key: string, patch: Partial<OrderStage>) {
    setStages((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
    setToast('');
  }

  // Puts the placeholder where the cursor is in that stage's message.
  function insert(key: string, token: string) {
    const box = boxes.current[key];
    const stage = stages.find((s) => s.key === key);
    if (!stage) return;
    const start = box?.selectionStart ?? stage.message.length;
    const end = box?.selectionEnd ?? stage.message.length;
    const message = (stage.message.slice(0, start) + token + stage.message.slice(end)).slice(0, MAX_STAGE_MESSAGE);
    update(key, { message });
    requestAnimationFrame(() => {
      if (!box) return;
      box.focus();
      box.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    if (stages.some((s) => !s.label.trim())) { setToast('Every stage needs a name.'); return; }
    setBusy(true);
    setToast('');
    const value = stages.map((s) => ({ ...s, label: s.label.trim() }));
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: settingKey, value: JSON.stringify(value) })
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setToast(d.error || 'Could not save.'); return; }
      setStages(value);
      setSaved(JSON.stringify(value));
      setToast('Saved.');
      router.refresh();
    } catch {
      setToast('Connection failed. Nothing was saved.');
    } finally {
      setBusy(false);
    }
  }

  let step = 0;
  return (
    <div className="stage-editor">
      {stages.filter((s) => !skip.includes(s.key)).map((s) => {
        const isCancelled = s.key === CANCELLED_STATUS.key;
        if (!isCancelled && !s.hidden) step += 1;
        const def = defaults.find((d) => d.key === s.key);
        const changed = def && (def.label !== s.label || def.message !== s.message || def.hidden !== s.hidden);
        return (
          <section key={s.key} className={`card stage-card ${s.hidden ? 'is-hidden' : ''}`} aria-labelledby={`${settingKey}-${s.key}`}>
            <header className="stage-card-head">
              <span className="stage-num" aria-hidden="true">{isCancelled ? '×' : s.hidden ? '–' : step}</span>
              <label className="stage-name">
                <span className="visually-hidden" id={`${settingKey}-${s.key}`}>Stage name</span>
                <input
                  value={s.label}
                  maxLength={MAX_STAGE_LABEL}
                  onChange={(e) => update(s.key, { label: e.target.value })}
                  aria-labelledby={`${settingKey}-${s.key}`}
                />
              </label>
              {!isCancelled && (
                <label className="stage-show">
                  <input type="checkbox" checked={!s.hidden} onChange={(e) => update(s.key, { hidden: !e.target.checked })} />
                  <span>Use</span>
                </label>
              )}
            </header>
            {s.hidden ? (
              <p className="stage-hidden-note">Not offered when changing an order&rsquo;s status, and left off the buyer&rsquo;s tracker. Orders already at this stage keep it.</p>
            ) : (
              <div className="stage-body">
                <label className="stage-message">
                  <span className="section-label">WhatsApp message</span>
                  <textarea
                    ref={(el) => { boxes.current[s.key] = el; }}
                    value={s.message}
                    maxLength={MAX_STAGE_MESSAGE}
                    // Rough fit for wrapped lines on a phone, so the whole message shows.
                    rows={Math.min(16, Math.max(3, s.message.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 34)), 0)))}
                    onChange={(e) => update(s.key, { message: e.target.value })}
                  />
                </label>
                <div className="stage-tokens" aria-label="Insert">
                  {placeholders.map((p) => (
                    <button key={p.token} type="button" className="stage-token" title={p.meaning} onClick={() => insert(s.key, p.token)}>{p.token}</button>
                  ))}
                </div>
                <details className="stage-preview">
                  <summary>Preview</summary>
                  <pre>{renderStageMessage(stages, s.key, SAMPLE)}</pre>
                </details>
              </div>
            )}
            {changed && (
              <button type="button" className="stage-reset" onClick={() => def && update(s.key, { label: def.label, message: def.message, hidden: def.hidden })}>
                Reset to default
              </button>
            )}
          </section>
        );
      })}

      <details className="card stage-help">
        <summary>What the {'{placeholders}'} fill in</summary>
        <ul>
          {placeholders.map((p) => <li key={p.token}><code>{p.token}</code> {p.meaning}</li>)}
        </ul>
        <p>A line is left out when what it needs is missing &mdash; for example the PIN line, if the buyer has no PIN yet.</p>
        <p>Put words in <code>[square brackets]</code> to drop just that part when a placeholder is empty: <code>placed[ and dispatched from {'{courier}'}].</code> reads &ldquo;placed.&rdquo; until a courier is chosen.</p>
      </details>

      <div className="stage-save-bar">
        {toast && <span role="status" aria-live="polite">{toast}</span>}
        <button type="button" className="btn" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</button>
      </div>
    </div>
  );
}
