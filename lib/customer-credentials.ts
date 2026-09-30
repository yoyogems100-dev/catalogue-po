import { supabaseAdmin } from '@/lib/supabase-admin';
import { encryptForAdmin, hashPassword } from '@/lib/customer-password';

// Reads and writes customer_credentials (service-role only). The crypto lives
// in lib/customer-password.ts so it can be tested without a database.

export async function savePassword(customerId: number, password: string, setBy: 'admin' | 'customer') {
  const { error } = await supabaseAdmin.from('customer_credentials').upsert({
    customer_id: customerId,
    password_hash: await hashPassword(password),
    password_enc: encryptForAdmin(password),
    set_at: new Date().toISOString(),
    set_by: setBy
  });
  if (error) throw new Error(error.message);
}

export async function getCredentials(customerId: number) {
  const { data } = await supabaseAdmin.from('customer_credentials')
    .select('password_hash, password_enc, set_at, set_by').eq('customer_id', customerId).maybeSingle();
  return data as { password_hash: string; password_enc: string | null; set_at: string; set_by: 'admin' | 'customer' } | null;
}
