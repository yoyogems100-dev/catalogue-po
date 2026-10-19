'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { categoryIconUrl } from '@/lib/category-icons';
import type { MenuGroup } from '@/lib/home-sections';

type MenuCategory = { id: number; name: string; slug: string };

function Icon({ slug, name, size }: { slug: string | null; name: string; size: number }) {
  const src = categoryIconUrl(slug);
  return (
    <span className="cm-icon" style={{ width: size, height: size }} aria-hidden="true">
      {src ? <img src={src} alt="" width={size} height={size} loading="lazy" /> : <span>{name.charAt(0)}</span>}
    </span>
  );
}

function Chevron() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

/**
 * The "Categories" button in the /po search bar and the menu it opens: the
 * sections the team marks for the menu (Admin > Home page sections), each
 * opening to its categories, then every category. Same accordion as the main
 * website's menu; full screen on a phone, a panel on a wider screen.
 */
export default function CategoryMenu({ groups, all }: { groups: MenuGroup<MenuCategory>[]; all: MenuCategory[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const list: { key: string; title: string; icon: MenuCategory | null; categories: MenuCategory[] }[] = [
    ...groups,
    { key: '__all', title: 'All categories', icon: null, categories: all }
  ];

  return (
    <>
      <button type="button" className="cm-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
        Categories
      </button>
      {open && (
        <div className="cm-backdrop" onClick={() => setOpen(false)}>
          <div className="cm-sheet" role="dialog" aria-modal="true" aria-label="Categories" onClick={(e) => e.stopPropagation()}>
            <div className="cm-head">
              <h2>Categories</h2>
              <button type="button" className="cm-close" aria-label="Close categories" onClick={() => setOpen(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>
            <div className="cm-body">
              {list.map((g) => {
                const isOpen = expanded === g.key;
                return (
                  <div key={g.key} className="cm-group">
                    <button type="button" className="cm-group-head" aria-expanded={isOpen} aria-controls={`cm-${g.key}`} onClick={() => setExpanded(isOpen ? null : g.key)}>
                      {g.key === '__all'
                        ? <span className="cm-icon cm-icon-all" style={{ width: 34, height: 34 }} aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>
                          </span>
                        : <Icon slug={g.icon?.slug ?? null} name={g.title} size={34} />}
                      <span className="cm-group-title">{g.title}</span>
                      <span className="cm-group-count">{g.categories.length}</span>
                      <Chevron />
                    </button>
                    {isOpen && (
                      <ul id={`cm-${g.key}`} className="cm-list">
                        {g.categories.map((c) => (
                          <li key={c.id}>
                            <Link href={`/po/category/${c.slug}`} onClick={() => setOpen(false)}>
                              <Icon slug={c.slug} name={c.name} size={26} />
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
