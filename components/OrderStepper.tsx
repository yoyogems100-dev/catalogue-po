import { ORDER_MILESTONES, milestoneIndex, milestoneLabel } from '@/lib/order-milestones';

export { milestoneIndex, milestoneLabel };

export default function OrderStepper({ status, compact = false }: { status: string; compact?: boolean }) {
  const currentIndex = milestoneIndex(status);

  if (compact) {
    return (
      <div className="order-stepper-compact">
        {ORDER_MILESTONES.map((m, i) => (
          <span
            key={m.key}
            className={`stepper-dot ${i <= currentIndex ? 'done' : ''} ${i === currentIndex ? 'current' : ''}`}
            title={m.label}
          />
        ))}
        <span className="stepper-current-label">{milestoneLabel(status)}</span>
      </div>
    );
  }

  return (
    <div className="order-stepper">
      {ORDER_MILESTONES.map((m, i) => (
        <div key={m.key} className={`stepper-step ${i <= currentIndex ? 'done' : ''} ${i === currentIndex ? 'current' : ''}`}>
          {i < ORDER_MILESTONES.length - 1 && <span className="stepper-line" />}
          <span className="stepper-dot" />
          <span className="stepper-label">{m.label}</span>
        </div>
      ))}
    </div>
  );
}
