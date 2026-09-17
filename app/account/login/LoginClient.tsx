'use client';

import { FullLogo } from '@/components/Logo';
import LoginForm from '@/components/LoginForm';

export default function LoginClient() {
  return (
    <div className="login-box card">
      <div style={{ marginBottom: 20 }}><FullLogo size="md" color="#1B3A6B" /></div>
      <LoginForm
        onSuccess={() => {
          // Full navigation, not router.push: the client router cache can
          // still hold the logged-out redirect for /account/orders.
          window.location.assign('/account/orders');
        }}
      />
    </div>
  );
}
