import { redirect } from 'next/navigation';

// Quick Order setup moved into Admin > Catalogue map > Colour buttons.
export default function QuickOrderSetupPage() {
  redirect('/admin/catalogue-map?tab=buttons');
}
