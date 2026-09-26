'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from './icons';
import { THEME_KEY, type SiteTheme } from './theme';
import s from './site.module.css';

// Both icons are rendered and CSS shows the one for the other theme, so the
// server markup is right before this component knows the stored choice.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<SiteTheme>('dark');
  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-site-theme') === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next: SiteTheme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-site-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: theme lasts this visit */ }
    setTheme(next);
  };

  return (
    <button type="button" className={`${s.themeToggle} ${className}`} onClick={toggle}
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
      <span className={s.themeIconSun}><Sun /></span>
      <span className={s.themeIconMoon}><Moon /></span>
    </button>
  );
}
