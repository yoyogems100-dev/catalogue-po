import AdminNav from '@/components/admin/AdminNav';

// Middleware (see middleware.ts) already guarantees only authenticated
// requests reach this layout, so no auth check is needed here.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <AdminNav />
      <main className="admin-main">{children}</main>
    </div>
  );
}
