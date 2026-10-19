import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { MAX_INTERESTS, sanitizeInterestIds, toggleInterest } from '@/lib/customer-interests';

// The star on a /po home category card: the signed-in buyer adds a category to
// (or takes it off) their own "Curated for you" shelf -- the same list the
// team sets on the admin customer page. Starring also turns the shelf on, so
// what the buyer just starred actually shows.
export async function POST(req: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Sign in to save favourites' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.categoryId);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) return NextResponse.json({ error: 'Choose a category' }, { status: 400 });
  const starred = body?.starred === true;

  if (starred) {
    const { data: category } = await supabaseAdmin.from('categories').select('id').eq('id', categoryId).maybeSingle();
    if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const { data: row, error: readError } = await supabaseAdmin.from('customers').select('interest_category_ids').eq('id', customerId).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const ids = toggleInterest(sanitizeInterestIds(row.interest_category_ids), categoryId, starred);
  if (!ids) return NextResponse.json({ error: `You can star up to ${MAX_INTERESTS} categories` }, { status: 400 });

  const update: Record<string, unknown> = { interest_category_ids: ids };
  if (starred) update.show_interests = true;
  const { error } = await supabaseAdmin.from('customers').update(update).eq('id', customerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ids });
}
