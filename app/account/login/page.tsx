import { redirect } from 'next/navigation';
import { getCustomerId } from '@/lib/customer-auth';
import { getSettings } from '@/lib/settings';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { safeNext } from '@/lib/safe-next';
import LoginClient from './LoginClient';

// This is what a browser tab, a bookmark and a shared link all show now that
// the catalogue itself is private -- the root layout's "Collection Catalogue"
// would promise a catalogue the visitor cannot actually see yet.
export const metadata = {
  title: 'YOYO GEMS — Trade Sign In',
  description: 'Sign in to the YOYO GEMS wholesale gemstone catalogue.'
};

// The site's front door. Nothing in the catalogue is readable without a
// session, so every signed-out visitor arrives here first and middleware
// appends ?next= with wherever they were actually headed.
export default async function CustomerLoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeNext((await searchParams).next);

  // "My Account" in the footer points here. A signed-in customer has nothing
  // to do on a sign-in form, so send them where they were going -- or to their
  // orders, which is what that footer link has always meant.
  if (await getCustomerId()) redirect(next || '/account/orders');

  // The footer is behind the gate now, so this screen carries the only way to
  // reach YOYO GEMS for a buyer who cannot get past it.
  const settings = await getSettings();
  const waUrl = settings.whatsapp_number
    ? buildWhatsAppUrl(settings.whatsapp_number, `Hi YOYO GEMS, I'd like access to your catalogue.`)
    : null;

  return <LoginClient next={next || '/'} whatsappUrl={waUrl} />;
}
