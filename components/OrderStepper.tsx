import { DEFAULT_ORDER_STAGES, milestoneIndex, milestoneLabel, milestoneColor, visibleMilestones, type OrderStage } from '@/lib/order-milestones';

export { milestoneIndex, milestoneLabel };

// `stages` carries the names set in admin (Orders > Stages & messages). Hidden
// stages are left off the tracker unless the order is sitting on one.
export default function OrderStepper({ status, stages = DEFAULT_ORDER_STAGES, compact = false }: { status: string; stages?: OrderStage[]; compact?: boolean }) {
  if (status === 'cancelled') {
    const { bg, fg } = milestoneColor('cancelled');
    return <span style={{ display: 'inline-block', background: bg, color: fg, fontSize: compact ? 11 : 13, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{milestoneLabel('cancelled', stages)}</span>;
  }

  const steps = visibleMilestones(stages, status);
  // Position by the fixed order, so a hidden earlier step still counts as passed.
  const currentOrder = milestoneIndex(status);
  const done = (key: string) => milestoneIndex(key) <= currentOrder;

  if (compact) {
    return (
      <div className="order-stepper-compact">
        {steps.map((m) => (
          <span
            key={m.key}
            className={`stepper-dot ${done(m.key) ? 'done' : ''} ${m.key === status ? 'current' : ''}`}
            title={m.label}
          />
        ))}
        <span className="stepper-current-label">{milestoneLabel(status, stages)}</span>
      </div>
    );
  }

  return (
    <div className="order-stepper">
      {steps.map((m, i) => (
        <div key={m.key} className={`stepper-step ${done(m.key) ? 'done' : ''} ${m.key === status ? 'current' : ''}`}>
          {i < steps.length - 1 && <span className="stepper-line" />}
          <span className="stepper-dot" />
          <span className="stepper-label">{m.label}</span>
        </div>
      ))}
    </div>
  );
}
