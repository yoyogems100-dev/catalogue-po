import { HotEditing, HotStatus } from '@/components/HotSelling';
import AdminNav from '@/components/admin/AdminNav';
import { isAdminAuthed } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Admin · YOYO GEMS', robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthed())) redirect('/login');
  return (
    <HotEditing><div className="admin-shell">
      <AdminNav />
      <main className="admin-main"><HotStatus />{children}</main>
    </div></HotEditing>
  );
}
