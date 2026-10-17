'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import ColorSwatch from './ColorSwatch';
import { useCatalogueMap } from './useCatalogueMap';
import { searchStones, type StoneHit } from '@/lib/stone-search';

/** The colour the next stone's form should open on, set by the stone search. */
export const PICK_COLOR_KEY = 'yoyo-pick-color';

/**
 * "Next stone" search at the top of the order form. Typing "yellow cz" or
 * "ruby 5" lists matching stones with their colour; picking one opens that
 * stone's form with the colour already chosen (or, for this stone, just picks
 * the colour). The requirement is kept throughout, so a list spanning Nano,
 * CZ and Ruby is entered without going back to the catalogue.
 */
export default function StoneSwitch({ categoryId, onPickColor }: { categoryId: number; onPickColor: (colorId: number) => void }) {
  // Rendered outside the app router (the composer's server-render tests),
  // there is no router; a plain page load does the same job there.
  let router: ReturnType<typeof useRouter> | null = null;
  try { router = useRouter(); } catch { router = null; } // eslint-disable-line react-hooks/rules-of-hooks
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const map = useCatalogueMap(touched);
  const hits = useMemo(() => (map ? searchStones(map, text) : []), [map, text]);
  const box = useRef<HTMLInputElement>(null);
  const open = focused && text.trim().length > 0;

  function pick(hit: StoneHit) {
    setText('');
    setFocused(false);
    box.current?.blur();
    if (hit.categoryId === categoryId) {
      if (hit.colorId) onPickColor(hit.colorId);
      return;
    }
    // Handed over in this tab as well as the address: on a client-side
    // move the next page can read it before the address has changed.
    if (hit.colorId) {
      try { sessionStorage.setItem(PICK_COLOR_KEY, JSON.stringify({ categoryId: hit.categoryId, colorId: hit.colorId })); } catch { /* the address still carries it */ }
    }
    const href = `/po/category/${hit.slug}${hit.colorId ? `?color=${hit.colorId}` : ''}`;
    if (router) router.push(href); else window.location.assign(href);
  }

  function keys(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || !hits.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % hits.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + hits.length) % hits.length); }
    if (e.key === 'Enter') { e.preventDefault(); pick(hits[Math.min(active, hits.length - 1)]); }
    if (e.key === 'Escape') { setText(''); }
  }

  return (
    <div className="po-stone-switch">
      <input
        ref={box}
        type="search"
        className="po-stone-switch-input"
        placeholder="Next stone? e.g. Yellow CZ, Ruby #5"
        aria-label="Find another stone or colour"
        aria-expanded={open}
        aria-controls="po-stone-switch-list"
        role="combobox"
        aria-autocomplete="list"
        value={text}
        enterKeyHint="go"
        onFocus={() => { setFocused(true); setTouched(true); }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={(e) => { setText(e.target.value); setActive(0); setTouched(true); }}
        onKeyDown={keys}
      />
      {open && (
        <ul className="po-stone-switch-list" id="po-stone-switch-list" role="listbox">
          {!map && <li className="po-stone-switch-empty">Loading…</li>}
          {map && !hits.length && <li className="po-stone-switch-empty">No stone or colour called “{text.trim()}”</li>}
          {hits.map((hit, i) => (
            <li key={`${hit.categoryId}-${hit.colorId ?? 0}`} role="option" aria-selected={i === active}>
              <button type="button" className={i === active ? 'active' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(hit)}>
                {hit.colorId ? <ColorSwatch hex={hit.hex || '#ccc'} refPhotoUrl={hit.refPhotoUrl} name={hit.colorName || ''} size={18} /> : <span className="po-stone-switch-dot" aria-hidden="true" />}
                <span><strong>{hit.colorName || hit.categoryName}</strong>{hit.colorName && <small>{hit.categoryName}</small>}</span>
                {hit.categoryId === categoryId && <em>this stone</em>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
