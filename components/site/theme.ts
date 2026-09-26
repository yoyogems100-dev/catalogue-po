// Light/dark theme for the public site. Dark is the default; a visitor's
// choice is kept in localStorage and applied to <html data-site-theme> by an
// inline script before first paint, so the page never flashes the wrong theme.
export const THEME_KEY = 'yoyo-site-theme';
export type SiteTheme = 'dark' | 'light';

export const themeBootScript =
  `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-site-theme',t)}catch(e){}`;
