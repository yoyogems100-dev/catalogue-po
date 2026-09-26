import Link from 'next/link';
import { WORKSPACES } from '@/components/admin/nav-config';

// Home of the PO portal workspace: everything behind /po, grouped as in the side pane.
const po = WORKSPACES.find((w) => w.key === 'po')!;

export default function PoPortalHub() {
  return <>
    <h1>PO portal</h1>
    <p>The ordering portal at <a href="/po" target="_blank" rel="noopener noreferrer">/po</a> for existing buyers. Its categories and photos are separate from the public website — manage those under <Link href="/admin/site">Website</Link>.</p>
    {po.groups.map((g) => (
      <section key={g.title} style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#756e5c', marginBottom: 10 }}>{g.title}</h2>
        <div className="admin-work-queues">{g.links.filter((l) => l.detail).map((l) => (
          <Link key={l.href} href={l.href} className="card">
            <h2 style={{ fontSize: 18 }}>{l.label}</h2><p>{l.detail}</p><span>Manage →</span>
          </Link>
        ))}</div>
      </section>
    ))}
  </>;
}
