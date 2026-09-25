import { mediaSrc, type MediaRow } from './media-url';

// Share images for WhatsApp previews and search results. Pure, so tested.

/** Shared Open Graph fields. A page that sets openGraph replaces the layout's
 *  whole object, so every page spreads these back in. */
export const OG_BASE = { siteName: 'YOYO GEMS®', type: 'website', locale: 'en_IN' } as const;

/** The branded share card for a page with no photo of its own. */
export function shareCard(title?: string) {
  return { url: `/api/site/og${title ? `?title=${encodeURIComponent(title)}` : ''}`, width: 1200, height: 630, alt: title ? `${title} · YOYO GEMS` : 'YOYO GEMS' };
}

/** The owner's chosen image, else a real photo, else the branded card. */
export function shareImages(img: MediaRow | null | undefined, title: string, photoSrc?: string | null) {
  if (img) return [{ url: mediaSrc(img, 1600), alt: img.alt || title }];
  if (photoSrc) return [{ url: photoSrc, alt: title }];
  return [shareCard(title)];
}
