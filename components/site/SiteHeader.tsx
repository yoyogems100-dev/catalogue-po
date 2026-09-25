'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { thumb } from '@/lib/site/optimize';
import type { NavCategory } from '@/lib/site/public';
import { Chevron, Close, Menu } from './icons';
import s from './site.module.css';

type Props = { categories: NavCategory[]; ctaLabel: string; showTradeLogin: boolean; whatsappHref: string | null };

// Desktop: one mega-menu panel with every category and its sub-categories
// visible at once (no cascading fly-outs, which fail on touch). Mobile: a
// full-screen accordion.
export default function SiteHeader({ categories, ctaLabel, showTradeLogin, whatsappHref }: Props) {
  const pathname = usePathname();
  const [megaOpen, setMegaOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMegaOpen(false); setSheetOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMegaOpen(false); setSheetOpen(false); } };
    const onClick = (e: MouseEvent) => { if (!headerRef.current?.contains(e.target as Node)) setMegaOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick); };
  }, []);
  useEffect(() => {
    document.documentElement.style.overflow = sheetOpen ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [sheetOpen]);

  const hoverOpen = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setMegaOpen(true); };
  const hoverClose = () => { closeTimer.current = setTimeout(() => setMegaOpen(false), 180); };
  const current = (href: string) => (pathname === href || pathname.startsWith(`${href}/`) ? ('page' as const) : undefined);

  return (
    <>
    <header className={s.header} ref={headerRef}>
      <div className={`${s.wrap} ${s.headerInner}`}>
        <Link href="/" className={s.logo} aria-label="YOYO GEMS home">
          <img {...thumb('/brand/yoyo-logo-white.png', 128)} alt="" width={128} height={35} className={s.logoImg} fetchPriority="high" />
        </Link>

        <nav className={s.nav} aria-label="Main">
          <div onMouseEnter={hoverOpen} onMouseLeave={hoverClose}>
            <button type="button" className={s.navButton} aria-expanded={megaOpen} aria-controls="mega-menu"
              onClick={() => setMegaOpen((v) => !v)}>
              Products <Chevron />
            </button>
            {megaOpen && (
              <div id="mega-menu" className={s.mega}>
                <div className={s.megaGrid}>
                  {categories.map((c) => (
                    <div key={c.id} className={s.megaCol}>
                      <h3><Link href={c.href}>{c.name}</Link></h3>
                      {c.children.length > 0 && (
                        <ul>{c.children.map((sub) => <li key={sub.id}><Link href={sub.href}>{sub.name}</Link></li>)}</ul>
                      )}
                    </div>
                  ))}
                </div>
                <div className={s.megaFoot}>
                  <div className={s.megaFootInner}>
                    <span>Prices and stock are confirmed on request.</span>
                    <Link href="/products">All categories →</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Link href="/charts" className={s.navLink} aria-current={current('/charts')}>Charts</Link>
          <Link href="/about" className={s.navLink} aria-current={current('/about')}>About</Link>
          {showTradeLogin && <a href="/po" className={s.tradeLink}>Trade login</a>}
        </nav>
        <Link href="/request-catalogue" className={`${s.btn} ${s.btnSm} ${s.headerCta}`}>{ctaLabel}</Link>

        <button type="button" className={s.menuToggle} aria-label="Open menu" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)}>
          <Menu />
        </button>
      </div>
    </header>

      {/* Outside <header>: its backdrop-filter would make it the containing
          block for this fixed layer and clip the menu to the header's height. */}
      {sheetOpen && (
        <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Menu">
          <div className={s.sheetHead}>
            <Link href="/" className={s.logo} aria-label="YOYO GEMS home" onClick={() => setSheetOpen(false)}>
              <img {...thumb('/brand/yoyo-logo-white.png', 118)} alt="" width={118} height={32} className={s.logoImg} />
            </Link>
            <button type="button" className={s.menuToggle} style={{ marginLeft: 0 }} aria-label="Close menu" onClick={() => setSheetOpen(false)}><Close /></button>
          </div>
          <div className={s.sheetBody}>
            {categories.map((c) => (
              <div key={c.id} className={s.acc}>
                <div className={s.accHead}>
                  <Link href={c.href} onClick={() => setSheetOpen(false)}>{c.name}</Link>
                  {c.children.length > 0 && (
                    <button type="button" className={s.accToggle} aria-expanded={expanded === c.id} aria-controls={`acc-${c.id}`}
                      aria-label={`${expanded === c.id ? 'Hide' : 'Show'} ${c.name} types`} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                      <Chevron size={20} />
                    </button>
                  )}
                </div>
                {expanded === c.id && (
                  <ul id={`acc-${c.id}`} className={s.accList}>
                    {c.children.map((sub) => <li key={sub.id}><Link href={sub.href} onClick={() => setSheetOpen(false)}>{sub.name}</Link></li>)}
                  </ul>
                )}
              </div>
            ))}
            <div className={s.sheetLinks}>
              <Link href="/charts" onClick={() => setSheetOpen(false)}>Charts</Link>
              <Link href="/about" onClick={() => setSheetOpen(false)}>About us</Link>
              <Link href="/quality" onClick={() => setSheetOpen(false)}>Quality &amp; QC</Link>
              <Link href="/how-to-order" onClick={() => setSheetOpen(false)}>How to order</Link>
              <Link href="/faq" onClick={() => setSheetOpen(false)}>FAQ</Link>
              <Link href="/contact" onClick={() => setSheetOpen(false)}>Contact</Link>
              {showTradeLogin && <a href="/po">Trade login</a>}
            </div>
          </div>
          <div className={s.sheetFoot}>
            <Link href="/request-catalogue" className={s.btn} onClick={() => setSheetOpen(false)}>{ctaLabel}</Link>
            {whatsappHref && <a href={whatsappHref} className={s.btnGhost} target="_blank" rel="noopener noreferrer">WhatsApp us</a>}
          </div>
        </div>
      )}
    </>
  );
}
