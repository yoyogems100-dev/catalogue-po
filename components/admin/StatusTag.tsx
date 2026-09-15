import { milestoneLabel, milestoneColor } from '@/lib/order-milestones';

export default function StatusTag({ status }: { status: string }) {
  const { bg, fg } = milestoneColor(status);
  return (
    <span style={{ display: 'inline-block', background: bg, color: fg, fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {milestoneLabel(status)}
    </span>
  );
}
