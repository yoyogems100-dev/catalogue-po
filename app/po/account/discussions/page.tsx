import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCustomerId } from '@/lib/customer-auth';
import { getDiscussions } from '@/lib/discussions-server';
import AccountHeader from '@/components/AccountHeader';
import BreadcrumbHome from '@/components/BreadcrumbHome';
import DiscussionCard from '@/components/DiscussionCard';

export const metadata = { title: 'Recent Discussions — YOYO GEMS' };

// Read-only: notes the YOYO GEMS team saved after a call, meeting or
// exhibition with this buyer (written in Admin > Customers > Discussions).
export default async function AccountDiscussionsPage() {
  const customerId = await getCustomerId();
  if (!customerId) redirect('/po/account/login');
  const { discussions } = await getDiscussions(customerId);

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav" aria-label="Breadcrumb">
          <BreadcrumbHome />
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/po/account/orders">My Orders</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current" aria-current="page">Discussions</span>
        </nav>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 6px' }}>Recent Discussions</h1>
        <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 20 }}>What we discussed with you on calls, at our offices and at exhibitions. Price and availability are confirmed by our team when you order.</p>
        {discussions.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#756e5c', border: '1px dashed var(--line)' }}>
            No discussions saved yet. After we meet or speak, the items we talked about will appear here.
          </div>
        ) : (
          <div className="discussion-list">
            {discussions.map((d) => <DiscussionCard key={d.id} discussion={d} />)}
          </div>
        )}
      </div>
    </>
  );
}
