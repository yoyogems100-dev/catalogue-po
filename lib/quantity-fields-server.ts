import { supabasePublic } from './supabase-public';
import { parseQuantityFields, quantityFieldFor, QUANTITY_FIELDS_SETTING_KEY, type QuantityField } from './quantity-field';

/** Every category's quantity field, for pages and documents that show orders
 *  spanning several categories. Settings are publicly readable. */
export async function getQuantityFields(): Promise<(categoryId: number) => QuantityField> {
  const { data } = await supabasePublic.from('settings').select('value').eq('key', QUANTITY_FIELDS_SETTING_KEY).maybeSingle();
  const saved = parseQuantityFields(data?.value);
  return (categoryId: number) => quantityFieldFor(saved, categoryId);
}
