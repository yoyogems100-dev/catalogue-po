import { milestoneLabel, milestoneColor, type OrderStage } from '@/lib/order-milestones';

/** `stages` carries the admin-edited names; without it the default names show. */
export default function StatusTag({ status, stages }: { status: string; stages?: OrderStage[] }) {
  const { bg, fg } = milestoneColor(status);
  return (
    <span style={{ display: 'inline-block', background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {milestoneLabel(status, stages)}
    </span>
  );
}
