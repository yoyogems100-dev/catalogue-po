'use client';

import { useRouter } from 'next/navigation';
import ProfileCompletionForm from '@/components/ProfileCompletionForm';

// Safety-net hard gate: whatever path someone used to log in (header popover,
// direct /account/login, or a real email magic-link click later), landing on
// /account/orders without a name on file always shows this first.
export default function ProfileGate() {
  const router = useRouter();
  return (
    <div className="login-box card" style={{ margin: '40px auto' }}>
      <h2 style={{ fontSize: 18, marginBottom: 4, color: 'var(--ink)' }}>Welcome</h2>
      <ProfileCompletionForm onSuccess={() => router.refresh()} />
    </div>
  );
}
