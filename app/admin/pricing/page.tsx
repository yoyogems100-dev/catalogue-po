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
        Manage per-piece prices by category, shape, size and color group. Choose a currency view below; exported PDFs show INR prices only.
      </p>
      <PricingClient
        categories={(categories || []).map((c: any) => ({ id: c.id, name: c.name }))}
        initialMultiplier={settings.rmb_inr_multiplier || ''}
      />
    </>
  );
}
