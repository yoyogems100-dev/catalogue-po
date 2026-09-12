import { HotEditing, HotStatus } from '@/components/HotSelling';
import AdminNav from '@/components/admin/AdminNav';
import { isAdminAuthed } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdminAuthed())) redirect('/login');
  return (
    <HotEditing><div className="admin-shell">
      <AdminNav />
      <main className="admin-main"><HotStatus /><p style={{fontSize:12,color:"#756e5c"}}>Click 🔥 beside a color, shape, size or specification to feature it across the catalogue. Click again to remove.</p>{children}</main>
    </div></HotEditing>
  );
}
