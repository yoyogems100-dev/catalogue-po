import { redirect } from 'next/navigation';

// Categories is the working dashboard -- redirect straight there instead of
// a separate stats-tile landing page.
export default function AdminDashboard() {
  redirect('/admin/categories');
}
