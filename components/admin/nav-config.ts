// The admin is two workspaces that are managed independently:
//  - Website: the public site at yoyogems.co.in (its own pages, categories and photos)
//  - PO portal: the /po ordering app for existing buyers (orders, buyers, catalogue)
// The side pane switches between them; the hub pages list the same groups.

export type NavLink = { href: string; label: string; detail?: string };
export type NavGroup = { title: string; links: NavLink[] };
export type Workspace = { key: 'site' | 'po'; label: string; viewHref: string; viewLabel: string; groups: NavGroup[] };

export const OVERVIEW: NavLink = { href: '/admin', label: 'Overview' };
export const BIN: NavLink = { href: '/admin/bin', label: 'Bin', detail: 'Deleted orders, buyers and suppliers. Restore or delete for good.' };

export const WORKSPACES: Workspace[] = [
  {
    key: 'site',
    label: 'Website',
    viewHref: '/',
    viewLabel: 'View website',
    groups: [
      {
        title: 'Enquiries',
        links: [
          { href: '/admin/site/leads', label: 'Catalogue requests', detail: 'People who asked for the catalogue: reply on WhatsApp, mark New / Sent / Closed, notes, CSV download.' }
        ]
      },
      {
        title: 'Content',
        links: [
          { href: '/admin/site', label: 'Website home' },
          { href: '/admin/site/pages', label: 'Pages & settings', detail: 'Home, About, Quality, How to order, Contact, and site-wide contact details, footer and search settings.' },
          { href: '/admin/site/categories', label: 'Categories', detail: 'The website categories and sub-categories: order, visibility, page text, photos and filters.' },
          { href: '/admin/site/media', label: 'Photos & images', detail: 'Every website picture. The website’s own copies, separate from the /po photos.' }
        ]
      },
      {
        title: 'Reference',
        links: [
          { href: '/admin/site/grades', label: 'Grades', detail: 'A, 3A, 5A, 7A, High Density Swiss: names, order and explanations.' },
          { href: '/admin/site/faqs', label: 'FAQ', detail: 'Questions and answers on the FAQ page: add, edit, reorder, hide or delete.' }
        ]
      }
    ]
  },
  {
    key: 'po',
    label: 'PO portal',
    viewHref: '/po',
    viewLabel: 'View /po',
    groups: [
      {
        title: 'Orders & buyers',
        links: [
          { href: '/admin/orders', label: 'Orders', detail: 'Purchase orders and quotation requests: prices, status, payment, PDFs.' },
          { href: '/admin/customers', label: 'Customers', detail: 'Buyer accounts, their orders, usual picks and colour buttons.' },
          { href: '/admin/suppliers', label: 'Suppliers', detail: 'Supplier contacts and what they supply.' }
        ]
      },
      {
        title: 'Catalogue',
        links: [
          { href: '/admin/categories', label: 'Categories & photos', detail: 'Add or rename /po categories, arrange their order, choose covers and manage their photos.' },
          { href: '/admin/photos', label: 'Upload photos', detail: 'Upload or import photos into /po categories.' },
          { href: '/admin/shapes', label: 'Shapes & sizes', detail: 'Shapes and sizes available in the catalogue.' },
          { href: '/admin/colors', label: 'Colours', detail: 'Colour names, swatches and reference photos.' },
          { href: '/admin/tags', label: 'Tags & specifications', detail: 'Labels used to describe and filter products.' },
          { href: '/admin/pricing', label: 'Pricing', detail: 'Catalogue prices and pricing settings.' },
          { href: '/admin/bulk-link', label: 'Bulk link', detail: 'Link many shapes, sizes or colours to categories at once.' },
          { href: '/admin/watermarks', label: 'Watermarks', detail: 'Watermarks applied to /po photos.' }
        ]
      },
      {
        title: '/po page setup',
        links: [
          { href: '/admin/content', label: '/po setup home' },
          { href: '/admin/content/most-ordered', label: 'Most ordered', detail: 'The categories shown first on the /po home page, in order.' },
          { href: '/admin/catalogue-map', label: 'Colour buttons & map', detail: 'Colour buttons buyers see and the stone each opens; stones by colour, size and material.' },
          { href: '/admin/brand-upload', label: 'Header logo', detail: 'The logo in the /po header.' }
        ]
      }
    ]
  }
];

const ALL: NavLink[] = [OVERVIEW, BIN, ...WORKSPACES.flatMap((w) => w.groups.flatMap((g) => g.links))];

/** The most specific link for a path, so /admin/site/leads highlights "Catalogue requests", not "Website home". */
export function currentHref(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  return ALL.map((l) => l.href)
    .filter((h) => pathname === h || (h !== '/admin' && pathname.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
}

/** Which workspace a page belongs to (the Overview and Bin belong to the PO portal). */
export function workspaceOf(pathname: string | null): Workspace['key'] {
  return pathname?.startsWith('/admin/site') ? 'site' : 'po';
}
