import { redirect } from 'next/navigation';
import { getCustomerId } from '@/lib/customer-auth';
import LoginClient from './LoginClient';

// "My Account" in the footer points here. A signed-in customer has nothing to
// do on a sign-in form, so send them straight to their orders.
export default async function CustomerLoginPage() {
  if (await getCustomerId()) redirect('/account/orders');
  return <LoginClient />;
}
