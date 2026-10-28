import { supabasePublic } from './supabase-public';
import { cachedCatalogue } from './catalogue-cache';

// Read on nearly every page; cached until the next admin save.
export const getSettings = cachedCatalogue(async (): Promise<Record<string, string>> => {
  const { data, error } = await supabasePublic.from('settings').select('key, value');
  // Don't cache an empty map from a failed read.
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  return map;
}, ['settings']);
