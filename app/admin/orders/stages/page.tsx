import Link from 'next/link';
import { getOrderStages } from '@/lib/order-stages-server';
import { DEFAULT_ORDER_STAGES, STAGE_PLACEHOLDERS } from '@/lib/order-milestones';
import StagesEditor from './StagesEditor';

// See app/admin/categories/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function OrderStagesPage() {
  const stages = await getOrderStages();
  return (
    <>
      <p style={{ fontSize: 12.5, margin: '0 0 6px' }}><Link href="/admin/orders">&larr; Orders</Link></p>
      <h1 style={{ marginBottom: 4 }}>Order stages &amp; WhatsApp messages</h1>
      <p style={{ fontSize: 13, color: '#756e5c', margin: '0 0 16px', maxWidth: 640 }}>
        Rename each stage, hide the ones you don&rsquo;t use, and set the message that opens in WhatsApp when you press Notify on an order.
        Names show everywhere: admin, the buyer&rsquo;s order tracker and the order PDF.
      </p>
      <StagesEditor initial={stages} defaults={DEFAULT_ORDER_STAGES} placeholders={STAGE_PLACEHOLDERS} />
    </>
  );
}
