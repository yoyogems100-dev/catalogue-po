'use client';

import { useEffect, useRef, useState } from 'react';
import { safeHref, sanitizeRichText } from '@/lib/site/rich-text';
import s from './site-admin.module.css';

// A deliberately small editor: bold, italic, bullet list, link. The owner
// never sees HTML. Whatever the browser produces (including pastes from Word
// or WhatsApp Web) is reduced to the allowed tags before it leaves this box,
// and cleaned again on the server.

export default function RichTextEditor({ value, onChange, label, id }: { value: string; onChange: (html: string) => void; label: string; id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>(value);
  const [focused, setFocused] = useState(false);

  // Only overwrite the DOM when the value changed from outside (restore,
  // initial load) -- never while typing, or the caret would jump.
  useEffect(() => {
    if (ref.current && value !== lastEmitted.current) {
      ref.current.innerHTML = value || '';
      lastEmitted.current = value;
    }
  }, [value]);
  useEffect(() => { if (ref.current) ref.current.innerHTML = value || ''; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function emit() {
    const clean = sanitizeRichText(ref.current?.innerHTML || '');
    lastEmitted.current = clean;
    onChange(clean);
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  function addLink() {
    const raw = window.prompt('Link address (for example https://wa.me/91… or /charts)');
    if (raw === null) return;
    const href = safeHref(raw.trim()) || (/^[\w.-]+\.[a-z]{2,}/i.test(raw.trim()) ? `https://${raw.trim()}` : null);
    if (!href) { window.alert('Use a full web address starting with https://, or a page on this site starting with /.'); return; }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      exec('insertHTML', `<a href="${href.replace(/"/g, '&quot;')}">${href.replace(/</g, '&lt;')}</a>`);
    } else exec('createLink', href);
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const clean = html ? sanitizeRichText(html) : text.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('');
    document.execCommand('insertHTML', false, clean);
    emit();
  }

  return (
    <div className={`${s.rte} ${focused ? s.rteFocused : ''}`}>
      <div className={s.rteToolbar} role="toolbar" aria-label={`${label} formatting`}>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} aria-label="Bold"><b>B</b></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} aria-label="Italic"><i>I</i></button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('insertUnorderedList')} aria-label="Bullet list">• List</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={addLink} aria-label="Add link">Link</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => exec('unlink')} aria-label="Remove link">Unlink</button>
      </div>
      <div
        id={id}
        ref={ref}
        className={s.rteBody}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={emit}
        onPaste={onPaste}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (ref.current) ref.current.innerHTML = lastEmitted.current; }}
      />
    </div>
  );
}
