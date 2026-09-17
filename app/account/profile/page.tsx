import { redirect } from 'next/navigation';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import AccountHeader from '@/components/AccountHeader';
import BreadcrumbHome from '@/components/BreadcrumbHome';
import ProfileEditForm from '@/components/ProfileEditForm';

export const metadata = { title: 'My Info — YOYO GEMS' };

export default async function ProfilePage() {
  const customerId = await getCustomerId();
  if (!customerId) redirect('/account/login');

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('name, company, phone, email, email_verified, work_stream, go_to_requirements')
    .eq('id', customerId)
    .maybeSingle();

  if (!customer) redirect('/account/login');

  return (
    <>
      <AccountHeader />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <nav className="breadcrumb-nav" aria-label="Breadcrumb">
          <BreadcrumbHome />
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <Link href="/account/orders">My Orders</Link>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current" aria-current="page">My Info</span>
        </nav>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', margin: '0 0 6px' }}>My Info</h1>
        <p style={{ fontSize: 13, color: '#756e5c', marginBottom: 20 }}>Everything you told us when you signed up -- edit any of it except your phone number.</p>
        <ProfileEditForm customer={customer} />
      </div>
    </>
  );
}
