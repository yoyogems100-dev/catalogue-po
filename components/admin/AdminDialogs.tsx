'use client';

import { useEffect, useRef, useState } from 'react';

// In-page replacements for the browser's confirm() and alert() across the
// admin. The native boxes block the whole tab, look like a system warning on
// phones and can't be styled; these match the admin and never lose the page.
//
//   if (!(await confirmAction('Delete this photo?'))) return;
//   notify('Could not save. Please retry.');
//
// <AdminDialogs /> is mounted once in the admin layout. Outside it (a
// component reused elsewhere) both fall back to the native boxes.

type Ask = { message: string; label: string; danger: boolean; resolve: (ok: boolean) => void };
type Toast = { id: number; message: string; kind: 'error' | 'ok' };
type Host = { ask: (a: Ask) => void; toast: (t: Omit<Toast, 'id'>) => void };

let host: Host | null = null;

// The button says what will happen ("Delete", "Remove", "Archive") rather
// than a generic OK, and is red when it destroys something.
export function labelFor(message: string) {
  if (/^Permanently delete/i.test(message)) return { label: 'Delete for good', danger: true };
  const verb = /^(Delete|Remove|Archive|Clear)\b/i.exec(message)?.[1];
  if (verb) return { label: verb[0].toUpperCase() + verb.slice(1).toLowerCase(), danger: true };
  return { label: 'Continue', danger: false };
}

export function confirmAction(message: string, opts: { label?: string; danger?: boolean } = {}): Promise<boolean> {
  if (!host) return Promise.resolve(window.confirm(message));
  const h = host;
  const inferred = labelFor(message);
  return new Promise((resolve) => h.ask({
    message,
    label: opts.label ?? inferred.label,
    danger: opts.danger ?? inferred.danger,
    resolve
  }));
}

export function notify(message: string, kind: Toast['kind'] = 'error') {
  if (!host) { window.alert(message); return; }
  host.toast({ message, kind });
}

export default function AdminDialogs() {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    host = {
      ask: (a) => setAsk((current) => { current?.resolve(false); return a; }),
      toast: (t) => {
        const id = nextId.current++;
        setToasts((list) => [...list.slice(-2), { ...t, id }]);
        setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.kind === 'error' ? 7000 : 3500);
      }
    };
    return () => { host = null; };
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (ask && d && !d.open) d.showModal();
  }, [ask]);

  function answer(ok: boolean) {
    ask?.resolve(ok);
    setAsk(null);
    dialogRef.current?.close();
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        className="admin-confirm"
        aria-labelledby="admin-confirm-text"
        onCancel={(e) => { e.preventDefault(); answer(false); }}
        onClick={(e) => { if (e.target === e.currentTarget) answer(false); }}
      >
        {ask && <>
          <p id="admin-confirm-text">{ask.message}</p>
          <div className="admin-confirm-actions">
            <button type="button" className="btn-ghost" onClick={() => answer(false)}>Cancel</button>
            <button type="button" className={`btn${ask.danger ? ' admin-confirm-danger' : ''}`} autoFocus onClick={() => answer(true)}>{ask.label}</button>
          </div>
        </>}
      </dialog>
      <div className="admin-toasts" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`admin-toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            {t.message}
            <button type="button" aria-label="Dismiss" onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}>×</button>
          </p>
        ))}
      </div>
    </>
  );
}
