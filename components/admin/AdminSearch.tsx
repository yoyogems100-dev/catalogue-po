'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KIND_LABEL, QUICK_ACTIONS, rankItems, staticSearchItems, type SearchItem } from '@/lib/admin-search';
import type { NavCategory } from '@/components/admin/AdminNav';

const OPEN_EVENT = 'admin-search:open';

export const SearchIcon = ({ size = 19 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

/** The big search field on the Overview. It opens the same search window as the top bar's icon. */
export function AdminSearchBar() {
  return (
    <button type="button" className="admin-search-bar" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      <SearchIcon size={18} />
      <span>Search categories, customers, suppliers, shapes, sizes, pages…</span>
      <kbd>/</kbd>
    </button>
  );
}

/**
 * The search icon on the admin top bar and the search window it opens. Press
 * "/" or Ctrl/⌘ K anywhere in the admin to open it. Pages, quick actions and
 * categories match instantly; customers, suppliers, shapes, sizes, colours and
 * orders are looked up as you type.
 */
export default function AdminSearch({ poCategories, siteCategories }: { poCategories: NavCategory[]; siteCategories: NavCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<{ q: string; items: SearchItem[] }>({ q: '', items: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const local = useMemo(() => staticSearchItems(poCategories, siteCategories), [poCategories, siteCategories]);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(OPEN_EVENT, show); window.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);

  // Ask the server a moment after typing stops.
  useEffect(() => {
    const q = query.trim();
    if (!open || (q.length < 2 && !/^#?\d+$/.test(q))) { setRemote({ q, items: [] }); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => { setRemote({ q, items: data.items || [] }); setLoading(false); })
        .catch(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, open]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return QUICK_ACTIONS;
    const seen = new Set<string>();
    return [...rankItems(local, q, 12), ...(remote.q === q ? remote.items : [])]
      .filter((r) => !seen.has(r.href) && seen.add(r.href));
  }, [query, local, remote]);

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function close() {
    setOpen(false);
    setQuery('');
  }
  function go(item: SearchItem | undefined) {
    if (!item) return;
    close();
    router.push(item.href);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  const q = query.trim();
  return (
    <>
      <button type="button" className="admin-mobile-home" onClick={() => setOpen(true)} aria-label="Search the admin" title="Search (/)">
        <SearchIcon />
      </button>
      {open && (
        <div className="admin-search-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="admin-search" role="dialog" aria-modal="true" aria-label="Search the admin">
            <div className="admin-search-field">
              <SearchIcon size={18} />
              <input
                ref={inputRef}
                type="search"
                placeholder="Search categories, customers, suppliers, shapes, sizes…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded="true"
                aria-controls="admin-search-results"
                aria-activedescendant={results[active] ? `admin-search-${active}` : undefined}
                autoComplete="off"
                enterKeyHint="go"
              />
              <button type="button" className="admin-search-close" onClick={close} aria-label="Close search">Esc</button>
            </div>
            {!q && <p className="admin-search-hint">Quick actions</p>}
            <ul id="admin-search-results" ref={listRef} role="listbox" className="admin-search-results">
              {results.map((item, i) => (
                <li
                  key={`${item.kind}-${item.href}`}
                  id={`admin-search-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  <span className={`admin-search-kind admin-search-kind-${item.kind}`}>{KIND_LABEL[item.kind]}</span>
                  <span className="admin-search-text">
                    <span className="admin-search-label">{item.label}</span>
                    {item.detail && <span className="admin-search-detail">{item.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {q && !results.length && !loading && <p className="admin-search-empty">Nothing matches “{q}”.</p>}
            {q && loading && <p className="admin-search-hint">Searching customers, suppliers, shapes and sizes…</p>}
          </div>
        </div>
      )}
    </>
  );
}
