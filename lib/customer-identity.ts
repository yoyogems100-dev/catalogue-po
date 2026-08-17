import { supabaseAdmin } from '@/lib/supabase-admin';

// Central identity lookup/creation, used everywhere a customer gets identified:
// order placement, OTP/email login verification, admin order creation.
//
// Matching rule (Phase 3 spec, Part 1):
// - phone match wins if a phone is given and matches an existing customer
// - otherwise, email match wins if an email is given and matches an existing customer
// - otherwise, create a new customer with whatever identifiers were given
//
// Known edge case (not handled -- flagged, not silently guessed at): if both phone
// and email are given and they belong to two DIFFERENT existing customer records,
// the phone match wins and the email match is ignored. There's no account-merge
// logic here; two genuinely separate records for the same person would need a
// manual admin fix, not an automatic merge.
export async function findOrCreateCustomer({
  phone,
  email
}: {
  phone?: string | null;
  email?: string | null;
}): Promise<{ id: number; name: string | null; isNew: boolean }> {
  const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
  const cleanEmail = email ? email.trim().toLowerCase() : null;

  if (cleanPhone) {
    const { data: existing } = await supabaseAdmin.from('customers').select('id, name').eq('phone', cleanPhone).maybeSingle();
    if (existing) return { id: existing.id, name: existing.name, isNew: false };
  }

  if (cleanEmail) {
    const { data: existing } = await supabaseAdmin.from('customers').select('id, name').eq('email', cleanEmail).maybeSingle();
    if (existing) return { id: existing.id, name: existing.name, isNew: false };
  }

  const { data: created, error } = await supabaseAdmin
    .from('customers')
    .insert({ phone: cleanPhone, email: cleanEmail })
    .select('id, name')
    .single();

  if (error || !created) throw new Error(error?.message || 'Failed to create customer');
  return { id: created.id, name: created.name, isNew: true };
}
