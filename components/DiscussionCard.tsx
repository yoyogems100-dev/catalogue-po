import type { ReactNode } from 'react';
import { formatDiscussionDate, formatUpdatedAt, type Discussion } from '@/lib/discussions';

// One discussion as the buyer sees it (admin shows the same card, with its
// own Edit/Delete buttons passed in as `actions`).
export default function DiscussionCard({ discussion: d, actions }: { discussion: Discussion; actions?: ReactNode }) {
  const edited = new Date(d.updated_at).getTime() - new Date(d.created_at).getTime() > 60_000;
  return (
    <article className="card discussion-card">
      <header className="discussion-card-head">
        <div>
          <strong className="discussion-date">{formatDiscussionDate(d.held_on)}</strong>
          {d.place && <span className="discussion-place">{d.place}</span>}
        </div>
        {actions && <div className="discussion-actions">{actions}</div>}
      </header>
      {d.items.length > 0 && (
        <dl className="discussion-items">
          {d.items.map((item, i) => (
            <div key={i} className="discussion-item">
              <dt>{item.label}</dt>
              {item.details && <dd>{item.details}</dd>}
            </div>
          ))}
        </dl>
      )}
      {d.notes && <p className="discussion-notes">{d.notes}</p>}
      <p className="discussion-updated">{edited ? 'Last updated' : 'Added'} {formatUpdatedAt(d.updated_at)}</p>
    </article>
  );
}
