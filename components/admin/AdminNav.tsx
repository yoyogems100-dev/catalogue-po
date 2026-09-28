'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { WordMark } from '@/components/Logo';
import NotificationBell from '@/components/admin/NotificationBell';
import { BIN, OVERVIEW, WORKSPACES, currentHref, poCategoryPages, workspaceOf, type NavGroup, type NavLink } from '@/components/admin/nav-config';

export type NavCategory = { id: number; name: string; parent?: string };

const MenuIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const CloseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" />
  </svg>
);

const ChevronIcon = ({ back = false }: { back?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={back ? { transform: 'rotate(180deg)' } : undefined}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    <path d="M15 3h6v6M10 14 21 3" />
  </svg>
);

// The full link list is always tucked in a slide-out drawer (opened via the
// hamburger), on desktop as well as mobile -- a permanently-visible sidebar
// crowded the page on desktop too. The drawer switches between the two
// independent workspaces, Website and PO portal (see nav-config.ts), and
// shows only a handful of entries: bigger groups are drill-downs that slide
// to their own links, and "Categories" drills into every category (then, on
// the PO side, into that category's pages). Home, the current workspace's
// public view, and notifications stay on the persistent top bar.
export default function AdminNav({ poCategories, siteCategories }: { poCategories: NavCategory[]; siteCategories: NavCategory[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [ws, setWs] = useState(workspaceOf(pathname));
  // Drill-down position: the open group (by title) and, inside the PO
  // categories list, the category whose pages are shown.
  const [panel, setPanel] = useState<string | null>(null);
  const [category, setCategory] = useState<NavCategory | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => { setWs(workspaceOf(pathname)); }, [pathname]);

  const current = currentHref(pathname);
  const here = WORKSPACES.find((w) => w.key === workspaceOf(pathname))!;
  const shown = WORKSPACES.find((w) => w.key === ws)!;
  const group = shown.groups.find((g) => g.title === panel) || null;

  // The category page being viewed, if any, so its row and tab can be marked.
  const catMatch = pathname?.match(/^\/admin\/(site\/)?categories\/(\d+)/);
  const currentCat = catMatch ? { site: !!catMatch[1], id: Number(catMatch[2]) } : null;
  const currentTab = searchParams.get('tab') || 'photos';

  function close() {
    setOpen(false);
    setPanel(null);
    setCategory(null);
    setQuery('');
  }
  function openGroup(title: string) {
    setPanel(title);
    setCategory(null);
    setQuery('');
  }
  function back() {
    if (category) setCategory(null);
    else { setPanel(null); setQuery(''); }
  }

  const link = (l: NavLink, current_ = l.href === current) => (
    <Link key={l.href} href={l.href} onClick={close} aria-current={current_ ? 'page' : undefined}>
      {l.label}
    </Link>
  );
  const holdsCurrent = (g: NavGroup) =>
    g.links.some((l) => l.href === current) || (!!currentCat && g.list === (currentCat.site ? 'site-categories' : 'po-categories'));

  // Root: one row per group. A single-link group is just that link.
  function rootPanel() {
    return <>
      {link(OVERVIEW)}
      <div className="admin-nav-switch" role="tablist" aria-label="Workspace">
        {WORKSPACES.map((w) => (
          <button key={w.key} type="button" role="tab" aria-selected={w.key === ws} onClick={() => setWs(w.key)}>{w.label}</button>
        ))}
      </div>
      <div className="admin-nav-group">
        {shown.groups.map((g) => {
          if (g.links.length === 1 && !g.list) return link(g.links[0]);
          const count = g.list === 'po-categories' ? poCategories.length : g.list === 'site-categories' ? siteCategories.length : g.links.length;
          return (
            <button key={g.title} type="button" className={`admin-nav-drill ${holdsCurrent(g) ? 'admin-nav-drill-here' : ''}`} onClick={() => openGroup(g.title)} aria-label={`${g.title} (${count})`}>
              <span>{g.title}</span>
              <span className="admin-nav-count">{count}</span>
              <ChevronIcon />
            </button>
          );
        })}
      </div>
      <a href={shown.viewHref} target="_blank" rel="noopener noreferrer" onClick={close}>{shown.viewLabel} &rarr;</a>
      <div className="admin-nav-group">
        {link(BIN)}
      </div>
      <form action="/api/admin-logout" method="post" style={{ marginTop: 12 }}>
        <button type="submit" style={{ background: 'none', border: 'none', color: '#cbd3e0', padding: '10px 24px', fontSize: 13.5, cursor: 'pointer' }}>
          Log out
        </button>
      </form>
    </>;
  }

  function backButton(label: string) {
    return (
      <button type="button" className="admin-nav-back" onClick={back}>
        <ChevronIcon back /> {label}
      </button>
    );
  }

  // A group's own links, then (for Categories) every category, searchable.
  function groupPanel(g: NavGroup) {
    const cats = g.list === 'po-categories' ? poCategories : g.list === 'site-categories' ? siteCategories : [];
    const q = query.trim().toLowerCase();
    const matches = q ? cats.filter((c) => c.name.toLowerCase().includes(q) || c.parent?.toLowerCase().includes(q)) : cats;
    return <>
      {backButton(shown.label)}
      <p className="admin-nav-title">{g.title}</p>
      {g.links.map((l) => link(l, l.href === current && !currentCat))}
      {g.list && <>
        {/* Inline colours: the global input rule would otherwise out-rank a class here. */}
        <div className="admin-nav-search">
          <input
            type="search" placeholder={`Search ${cats.length} categories`}
            value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search categories"
            style={{ color: '#fff', background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.14)', padding: '8px 10px' }}
          />
        </div>
        <div role="list" aria-label="Categories">
          {matches.map((c) => {
            const isHere = currentCat?.id === c.id && currentCat.site === (g.list === 'site-categories');
            const cls = c.parent && !q ? 'admin-nav-sub' : undefined;
            const label = <>{c.name}{c.parent && q ? <small> · {c.parent}</small> : null}</>;
            // Website categories are one page each; a PO category drills on to its tabs.
            return g.list === 'site-categories'
              ? <Link key={c.id} role="listitem" href={`/admin/site/categories/${c.id}`} onClick={close} className={cls} aria-current={isHere ? 'page' : undefined}>{label}</Link>
              : (
                <button key={c.id} role="listitem" type="button" className={`admin-nav-drill ${isHere ? 'admin-nav-drill-here' : ''}`} onClick={() => setCategory(c)} aria-label={c.name}>
                  <span>{c.name}</span><ChevronIcon />
                </button>
              );
          })}
          {!matches.length && <p className="admin-nav-empty">No category matches “{query}”.</p>}
        </div>
      </>}
    </>;
  }

  // The pages of one PO category: its workspace tabs.
  function categoryPanel(c: NavCategory) {
    const viewing = currentCat && !currentCat.site && currentCat.id === c.id;
    return <>
      {backButton('Categories')}
      <p className="admin-nav-title">{c.name}</p>
      {poCategoryPages(c.id).map((l) => link(l, !!viewing && l.href.endsWith(`tab=${currentTab}`)))}
    </>;
  }

  return (
    <>
      <div className="admin-mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
          <button type="button" className="admin-hamburger" onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <span className="admin-topbar-ws">{here.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Link href="/admin" className="admin-mobile-home" aria-label="Admin overview">
            <HomeIcon />
          </Link>
          <a href={here.viewHref} target="_blank" rel="noopener noreferrer" className="admin-mobile-home" aria-label={here.viewLabel} title={here.viewLabel}>
            <ExternalIcon />
          </a>
          <NotificationBell />
        </div>
      </div>

      {open && <div className="admin-nav-backdrop" onClick={close} />}

      <nav className={`admin-nav ${open ? 'admin-nav-open' : ''}`} aria-label="Admin">
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} className="admin-nav-logo">
          <WordMark height={20} color="#FAF8F3" />
          <button type="button" className="admin-nav-close" onClick={close} aria-label="Close menu">
            <CloseIcon />
          </button>
        </div>
        {category ? categoryPanel(category) : group ? groupPanel(group) : rootPanel()}
      </nav>
    </>
  );
}
