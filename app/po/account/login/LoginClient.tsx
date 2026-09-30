'use client';

import { FullLogo } from '@/components/Logo';
import LoginForm from '@/components/LoginForm';

export default function LoginClient({ next }: { next: string; whatsappUrl?: string | null }) {
  return (
    <div className="login-box card">
      <div style={{ marginBottom: 14 }}><FullLogo size="md" color="#1B3A6B" /></div>
      {/* Trial phase: the owner explains access to each buyer directly, so
          this screen is just the brand and the form. */}
      <p className="login-tagline">Synthetic Gemstones. Infinite Choices. One Trusted Name.</p>
      <LoginForm
        onSuccess={() => {
          // Full navigation, not router.push: the client router cache can
          // still hold the logged-out redirect for the page we're returning to.
          window.location.assign(next);
        }}
      />
    </div>
  );
}
