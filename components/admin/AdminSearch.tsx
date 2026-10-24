'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KIND_LABEL, QUICK_ACTIONS, mergeResults, rankItems, staticSearchItems, type SearchItem } from '@/lib/admin-search';
import type { NavCategory } from '@/components/admin/AdminNav';

const OPEN_EVENT = 'admin-search:open';

export const SearchIcon = ({ size = 19 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

/**
 * Pages, quick actions and categories are ranked in the browser; customers,
 * suppliers, shapes, sizes, colours and orders are asked from the server a
 * moment after typing stops. Shared by the top-bar window and the Overview box.
 */
function useSearchResults(query: string, local: SearchItem[], enabled: boolean, empty: SearchItem[]) {
  const [remote, setRemote] = useState<{ q: string; items: SearchItem[] }>({ q: '', items: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || (q.length < 2 && !/^#?\d+$/.test(q))) { setRemote({ q, items: [] }); setLoading(false); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((data) => { setRemote({ q, items: data.items || [] }); setLoading(false); })
        .catch(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, enabled]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return empty;
    return mergeResults(q, rankItems(local, q, 12), remote.q === q ? remote.items : []);
  }, [query, local, remote, empty]);

  return { results, loading };
}

/** Arrow keys, Enter and Escape over a result list. */
function useListKeys(results: SearchItem[], go: (item: SearchItem | undefined) => void, onEscape: () => void) {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => { setActive(0); }, [results]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(results.length - 1, active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, active - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onEscape(); }
  }
  return { active, setActive, listRef, onKeyDown };
}

function ResultList({ id, results, active, setActive, go, listRef }: {
  id: string;
  results: SearchItem[];
  active: number;
  setActive: (i: number) => void;
  go: (item: SearchItem) => void;
  listRef: React.RefObject<HTMLUListElement | null>;
}) {
  return (
    <ul id={id} ref={listRef} role="listbox" className="admin-search-results">
      {results.map((item, i) => (
        <li
          key={`${item.kind}-${item.href}`}
          id={`${id}-${i}`}
          data-index={i}
          role="option"
          aria-selected={i === active}
          onMouseEnter={() => setActive(i)}
          // mousedown, not click: the Overview box closes its list on blur.
          onMouseDown={(e) => { e.preventDefault(); go(item); }}
        >
          <span className={`admin-search-kind admin-search-kind-${item.kind}`}>{KIND_LABEL[item.kind]}</span>
          <span className="admin-search-text">
            <span className="admin-search-label">{item.label}</span>
            {item.detail && <span className="admin-search-detail">{item.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const NO_ITEMS: SearchItem[] = [];

/**
 * The search box on the Overview: type, and the matches drop down right under
 * it -- an order number, a buyer's name, company or phone, a supplier, a
 * category, a shape or size, or any admin page. Enter opens the top match.
 */
export function AdminSearchBar({ poCategories, siteCategories }: { poCategories: NavCategory[]; siteCategories: NavCategory[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const local = useMemo(() => staticSearchItems(poCategories, siteCategories), [poCategories, siteCategories]);
  const { results, loading } = useSearchResults(query, local, true, NO_ITEMS);
  const shown = useMemo(() => results.slice(0, 10), [results]);

  function go(item: SearchItem | undefined) {
    if (!item) return;
    setQuery('');
    inputRef.current?.blur();
    router.push(item.href);
  }
  const keys = useListKeys(shown, go, () => { setQuery(''); inputRef.current?.blur(); });

  // Ready to type on a computer; on a phone the keyboard would cover the page.
  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true });
  }, []);

  const q = query.trim();
  const open = focused && !!q;
  return (
    <div className="admin-search-inline">
      <div className="admin-search-bar">
        <SearchIcon size={18} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={keys.onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Order #, buyer, phone, supplier, category, shape, size…"
          aria-label="Search the admin"
          role="combobox"
          aria-expanded={open}
          aria-controls="admin-search-inline-results"
          aria-activedescendant={open && shown[keys.active] ? `admin-search-inline-results-${keys.active}` : undefined}
          autoComplete="off"
          enterKeyHint="go"
          data-admin-search-inline=""
        />
        {q
          ? <button type="button" className="admin-search-close" onMouseDown={(e) => { e.preventDefault(); setQuery(''); }} aria-label="Clear search">Clear</button>
          : <kbd>/</kbd>}
      </div>
      {open && (
        <div className="admin-search-inline-pop">
          <ResultList id="admin-search-inline-results" results={shown} active={keys.active} setActive={keys.setActive} go={go} listRef={keys.listRef} />
          {!shown.length && !loading && <p className="admin-search-empty">Nothing matches “{q}”.</p>}
          {loading && <p className="admin-search-hint">Searching orders, buyers, suppliers, shapes and sizes…</p>}
        </div>
      )}
    </div>
  );
}

/**
 * The search icon on the admin top bar and the search window it opens. Press
 * "/" or Ctrl/⌘ K anywhere in the admin to open it (on the Overview, "/" jumps
 * to the box on the page instead). Pages, quick actions and categories match
 * instantly; customers, suppliers, shapes, sizes, colours and orders are
 * looked up as you type.
 */
export default function AdminSearch({ poCategories, siteCategories }: { poCategories: NavCategory[]; siteCategories: NavCategory[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const local = useMemo(() => staticSearchItems(poCategories, siteCategories), [poCategories, siteCategories]);
  const { results, loading } = useSearchResults(query, local, open, QUICK_ACTIONS);

  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        const inline = e.key === '/' ? document.querySelector<HTMLInputElement>('[data-admin-search-inline]') : null;
        if (inline) inline.focus(); else setOpen(true);
      }
    };
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(OPEN_EVENT, show); window.removeEventListener('keydown', onKey); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);

  function close() {
    setOpen(false);
    setQuery('');
  }
  function go(item: SearchItem | undefined) {
    if (!item) return;
    close();
    router.push(item.href);
  }
  const keys = useListKeys(results, go, close);

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
                placeholder="Order #, buyer, phone, supplier, category, shape, size…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={keys.onKeyDown}
                role="combobox"
                aria-expanded="true"
                aria-controls="admin-search-results"
                aria-activedescendant={results[keys.active] ? `admin-search-results-${keys.active}` : undefined}
                autoComplete="off"
                enterKeyHint="go"
              />
              <button type="button" className="admin-search-close" onClick={close} aria-label="Close search">Esc</button>
            </div>
            {!q && <p className="admin-search-hint">Quick actions</p>}
            <ResultList id="admin-search-results" results={results} active={keys.active} setActive={keys.setActive} go={go} listRef={keys.listRef} />
            {q && !results.length && !loading && <p className="admin-search-empty">Nothing matches “{q}”.</p>}
            {q && loading && <p className="admin-search-hint">Searching orders, buyers, suppliers, shapes and sizes…</p>}
          </div>
        </div>
      )}
    </>
  );
}
