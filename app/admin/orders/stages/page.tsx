import Link from 'next/link';
import { getStageSets, getCouriers } from '@/lib/order-stages-server';
import {
  DEFAULT_ORDER_STAGES, DEFAULT_JAIPUR_STAGES, JAIPUR_SKIPPED, JAIPUR_STAGES_SETTING_KEY, STAGE_PLACEHOLDERS
} from '@/lib/order-milestones';
import StagesEditor from './StagesEditor';
import CouriersEditor from './CouriersEditor';

// See app/admin/categories/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

export default async function OrderStagesPage() {
  const [{ china, jaipur }, couriers] = await Promise.all([getStageSets(), getCouriers()]);
  return (
    <>
      <p style={{ fontSize: 12.5, margin: '0 0 6px' }}><Link href="/admin/orders">&larr; Orders</Link></p>
      <h1 style={{ marginBottom: 4 }}>Order stages &amp; WhatsApp messages</h1>
      <p style={{ fontSize: 13, color: '#756e5c', margin: '0 0 16px', maxWidth: 640 }}>
        Rename each stage, hide the ones you don&rsquo;t use, and set the message that opens in WhatsApp when you press Notify on an order.
        Names show everywhere: admin, the buyer&rsquo;s order tracker and the order PDF.
      </p>
      <nav className="stage-jump" aria-label="On this page">
        <a href="#stages-china">Usual (from China)</a>
        <a href="#stages-jaipur">Dispatch from Jaipur</a>
        <a href="#couriers-heading">Couriers</a>
      </nav>
      <h2 id="stages-china" className="stage-group-title">Usual route (from China)</h2>
      <StagesEditor initial={china} defaults={DEFAULT_ORDER_STAGES} placeholders={STAGE_PLACEHOLDERS} />
      <h2 id="stages-jaipur" className="stage-group-title">Dispatch from Jaipur</h2>
      <p style={{ fontSize: 13, color: '#756e5c', margin: '0 0 12px', maxWidth: 640 }}>
        For orders you mark &ldquo;Dispatch from Jaipur&rdquo; on the order page. These skip the China stages.
      </p>
      <StagesEditor
        initial={jaipur}
        defaults={DEFAULT_JAIPUR_STAGES}
        placeholders={STAGE_PLACEHOLDERS}
        settingKey={JAIPUR_STAGES_SETTING_KEY}
        skip={[...JAIPUR_SKIPPED]}
      />
      <CouriersEditor initial={couriers} />
    </>
  );
}
