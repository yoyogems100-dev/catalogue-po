// Pages the owner can edit, in site order. A page appears here once its
// fields are defined in lib/site/page-schemas.ts.
export const PAGE_LIST: { key: string; title: string; href: string; detail: string }[] = [
  { key: 'global', title: 'Site settings', href: '/', detail: 'Contact details, WhatsApp, header button, footer links, search defaults.' },
  { key: 'home', title: 'Home', href: '/', detail: 'Hero, numbers, one-stop story, charts teaser, Why Choose Us, catalogue band.' },
  { key: 'about', title: 'About us', href: '/about', detail: 'Story, photos and numbers.' },
  { key: 'quality', title: 'Quality & QC', href: '/quality', detail: 'What is checked before dispatch.' },
  { key: 'how-to-order', title: 'How to order', href: '/how-to-order', detail: 'The five ordering steps.' },
  { key: 'charts', title: 'Charts', href: '/charts', detail: 'Chart titles and intros, colour charts and which categories feed them, the grades page text.' },
  { key: 'request-catalogue', title: 'Request catalogue', href: '/request-catalogue', detail: 'Intro, form button, thank-you message. The requests themselves are under Website → Catalogue requests.' },
  { key: 'faq', title: 'FAQ page', href: '/faq', detail: 'Page intro. The questions are managed under Website → FAQ.' },
  { key: 'contact', title: 'Contact', href: '/contact', detail: 'Intro, visiting details and map link.' }
];
