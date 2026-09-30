// The admin is two workspaces that are managed independently:
//  - Website: the public site at yoyogems.co.in (its own pages, categories and photos)
//  - PO portal: the /po ordering app for existing buyers (orders, buyers, catalogue)
// The side pane switches between them; the hub pages list the same groups.

export type NavLink = { href: string; label: string; detail?: string };
/**
 * One entry in the side pane. A group with a single link and no `list` shows
 * as that plain link; anything bigger is a drill-down: tap it and the pane
 * slides to its links. `list` adds every category to that drill-down, so the
 * whole catalogue sits behind one entry instead of crowding the pane.
 */
export type NavGroup = { title: string; links: NavLink[]; list?: 'po-categories' | 'site-categories' };
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
        title: 'Categories',
        list: 'site-categories',
        links: [
          { href: '/admin/site/categories', label: 'All categories', detail: 'The website categories and sub-categories: order, visibility, page text, photos and filters.' }
        ]
      },
      {
        title: 'Photos',
        links: [
          { href: '/admin/site/media', label: 'Photos & images', detail: 'Every website picture. The website’s own copies, separate from the /po photos.' }
        ]
      },
      {
        title: 'Pages & content',
        links: [
          { href: '/admin/site', label: 'Website home' },
          { href: '/admin/site/pages', label: 'Pages & settings', detail: 'Home, About, Quality, How to order, Contact, and site-wide contact details, footer and search settings.' },
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
        title: 'Orders',
        links: [
          { href: '/admin/orders', label: 'Orders', detail: 'Purchase orders and quotation requests: prices, status, payment, PDFs.' }
        ]
      },
      // The catalogue masters each get their own entry. Tags & specifications
      // have no page: they are added from the Overview's quick actions or the
      // tag row on each category.
      {
        title: 'Categories',
        list: 'po-categories',
        links: [
          { href: '/admin/categories', label: 'All categories', detail: 'Add or rename /po categories, arrange their order, choose covers, archive, and manage their photos and tags.' }
        ]
      },
      {
        title: 'Photos',
        links: [
          { href: '/admin/photos', label: 'Photos', detail: 'Upload photos into any category, or leave them unassigned and file them later.' }
        ]
      },
      {
        title: 'Shapes & sizes',
        links: [
          { href: '/admin/shapes', label: 'Shapes & sizes', detail: 'Shapes and sizes available in the catalogue.' }
        ]
      },
      {
        title: 'Colours',
        links: [
          { href: '/admin/colors', label: 'Colours', detail: 'Colour names, swatches and reference photos.' }
        ]
      },
      {
        title: 'Pricing & linking',
        links: [
          { href: '/admin/pricing', label: 'Pricing', detail: 'Catalogue prices and pricing settings.' },
          { href: '/admin/bulk-link', label: 'Bulk link', detail: 'Link many shapes, sizes or colours to categories at once.' }
        ]
      },
      {
        title: 'Buyers & suppliers',
        links: [
          { href: '/admin/customers', label: 'Customers', detail: 'Buyer accounts, their orders, usual picks and colour buttons.' },
          { href: '/admin/suppliers', label: 'Suppliers', detail: 'Supplier contacts and what they supply.' }
        ]
      },
      {
        title: '/po page setup',
        links: [
          { href: '/admin/content', label: '/po setup home' },
          { href: '/admin/content/home-sections', label: 'Home page sections', detail: 'Shelves like Most ordered and New in: which categories, and in what order.' },
          { href: '/admin/catalogue-map', label: 'Colour buttons & map', detail: 'Colour buttons buyers see and the stone each opens; stones by colour, size and material.' },
          { href: '/admin/brand-upload', label: 'Header logo', detail: 'The logo in the /po header.' }
        ]
      }
    ]
  }
];

/** The pages inside one /po category, in the order of its tabs (Strip counts is Rainbow Corundum only). */
export function poCategoryPages(id: number): NavLink[] {
  const base = `/admin/categories/${id}`;
  return [
    { href: `${base}?tab=photos`, label: 'Photos' },
    { href: `${base}?tab=shapes`, label: 'Shapes & sizes' },
    { href: `${base}?tab=colors`, label: 'Colours' },
    { href: `${base}?tab=pricing`, label: 'Pricing' },
    { href: `${base}?tab=suppliers`, label: 'Suppliers' },
    ...(id === 29 ? [{ href: `${base}?tab=strip-counts`, label: 'Strip counts' }] : [])
  ];
}

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
