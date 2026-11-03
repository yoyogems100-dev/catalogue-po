// Light/dark theme for the public site. Light is the default (whatever the
// device prefers); a visitor's choice is kept in localStorage. An inline script
// applies it to <html data-site-theme> before first paint, so the page never
// flashes the wrong theme.
export const THEME_KEY = 'yoyo-site-theme';
export type SiteTheme = 'dark' | 'light';

export const themeBootScript =
  `try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.setAttribute('data-site-theme',t==='dark'?'dark':'light')}catch(e){}`;
