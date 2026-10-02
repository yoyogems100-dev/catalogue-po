import { revalidatePath } from 'next/cache';
import { refreshPublicSite } from '@/lib/site/api';

/**
 * After a change to the catalogue's order (categories, shapes, colours,
 * photos): rebuild /po and the website straight away. Without this the
 * website kept its hour-long cache and the new order only showed up later.
 */
export function refreshCatalogue() {
  revalidatePath('/po', 'layout');
  refreshPublicSite();
}
