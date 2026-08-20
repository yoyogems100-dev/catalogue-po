import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSettings } from '@/lib/settings';
import PricingClient from './PricingClient';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const [{ data: categories }, settings] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name').order('num'),
    getSettings()
  ]);

  return (
    <>
      <h1>Pricing</h1>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 18 }}>
        Set per-piece prices in RMB by shape, size, and color group -- matches the supplier
        price sheet's own layout. Customers see the RMB price converted to INR using the
        multiplier below.
      </p>
      <PricingClient
        categories={(categories || []).map((c: any) => ({ id: c.id, name: c.name }))}
        initialMultiplier={settings.rmb_inr_multiplier || '12'}
      />
    </>
  );
}
