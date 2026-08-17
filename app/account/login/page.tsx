'use client';

import { useRouter } from 'next/navigation';
import { FullLogo } from '@/components/Logo';
import LoginForm from '@/components/LoginForm';

export default function CustomerLoginPage() {
  const router = useRouter();

  return (
    <div className="login-box card">
      <div style={{ marginBottom: 20 }}><FullLogo size="md" color="#1B3A6B" /></div>
      <LoginForm
        onSuccess={() => {
          router.push('/account/orders');
          router.refresh();
        }}
      />
    </div>
  );
}
