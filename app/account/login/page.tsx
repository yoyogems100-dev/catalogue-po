'use client';

import { FullLogo } from '@/components/Logo';
import LoginForm from '@/components/LoginForm';

export default function CustomerLoginPage() {

  return (
    <div className="login-box card">
      <div style={{ marginBottom: 20 }}><FullLogo size="md" color="#1B3A6B" /></div>
      <LoginForm
        onSuccess={() => {
          window.location.assign('/account/orders');
        }}
      />
    </div>
  );
}
