import { supabaseAdmin } from '@/lib/supabase-admin';
import PricingClient from './PricingClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const query = await searchParams;
  const { data: categories } = await supabaseAdmin.from('categories').select('id, name, slug').order('num');

  return (
    <>
      <h1>Pricing</h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
        Manage ₹ prices by category, shape, size and color group.
      </p>
      <PricingClient
        key={query.category || 'all'}
        categories={(categories || []).map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))}
        initialCategoryId={Number(query.category) || undefined}
      />
    </>
  );
}
