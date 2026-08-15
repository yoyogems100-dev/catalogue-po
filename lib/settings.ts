import { supabasePublic } from './supabase-public';

export async function getSettings(): Promise<Record<string, string>> {
  const { data } = await supabasePublic.from('settings').select('key, value');
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  return map;
}
