'use client';

import { FullLogo } from '@/components/Logo';
import LoginForm from '@/components/LoginForm';

export default function LoginClient({ next, whatsappUrl }: { next: string; whatsappUrl?: string | null }) {
  return (
    <div className="login-box card">
      <div style={{ marginBottom: 14 }}><FullLogo size="md" color="#1B3A6B" /></div>
      {/* This screen is the whole site to anyone who has not signed in yet, so
          it has to say what YOYO GEMS is and why the form is in the way --
          a bare code box on an otherwise empty page reads as a broken site. */}
      <p className="login-tagline">Synthetic Gemstones. Infinite Choices. One Trusted Name.</p>
      <p className="login-intro">
        Our wholesale catalogue is for trade buyers. Verify your WhatsApp number to browse
        collections, see pricing and send a requirement.
      </p>
      <LoginForm
        onSuccess={() => {
          // Full navigation, not router.push: the client router cache can
          // still hold the logged-out redirect for the page we're returning to.
          window.location.assign(next);
        }}
      />
      {whatsappUrl && (
        <p className="login-help">
          Trouble signing in? <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">Message us on WhatsApp</a>
        </p>
      )}
    </div>
  );
}
