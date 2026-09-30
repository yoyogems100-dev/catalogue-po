'use client';

import { useEffect, useState } from 'react';
import ProfileCompletionForm, { DEALS_IN_OPTIONS } from './ProfileCompletionForm';

type Tab = 'login' | 'signup';
type Step = 'enter' | 'verify' | 'profile' | 'forgot' | 'reset';
type Method = 'password' | 'otp';

// Log in takes the WhatsApp number with either a password or a one-time code
// sent on WhatsApp; "Forgot password" proves the number with a code and sets a
// new one. Sign up verifies the number with a code (so nobody can claim
// someone else's number) and can set a password at the same time. Sign up collects every detail (name/company, what
// they deal in, go-to requirements, email) on the same screen as the phone
// number, like an ordinary sign-up form; the code is just the last step that
// activates it. The server still decides who is actually new: a new number
// on "Log in" falls back to a short details step after verifying, and an
// existing number on "Sign up" is simply logged in (its collected details
// are dropped since the account already has its own).
export default function LoginForm({ onSuccess, initialTab = 'login', autoFocus = true }: {
  onSuccess: () => void;
  initialTab?: Tab;
  /** Off where the form sits below other content (the cart): focusing it
   *  jumped the page to the bottom and opened the phone keyboard over the list. */
  autoFocus?: boolean;
  /** @deprecated email login isn't offered; kept so existing callers compile. */
  phoneOnly?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [step, setStep] = useState<Step>('enter');
  const [method, setMethod] = useState<Method>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [devDisplay, setDevDisplay] = useState<string | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);
  // Seconds until "Resend code" is offered again.
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Signup-only profile fields, collected up front alongside the phone number.
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [dealsIn, setDealsIn] = useState<string[]>([]);
  const [goToRequirements, setGoToRequirements] = useState('');
  const [email, setEmail] = useState('');

  function toggleDealsIn(option: string) {
    setDealsIn((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
  }

  function reset(nextTab: Tab = tab, nextMethod: Method = method) {
    setTab(nextTab);
    setMethod(nextMethod);
    setStep('enter');
    setCode('');
    setPassword('');
    setNewPassword('');
    setDevDisplay(null);
    setError('');
    setNotice('');
  }

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    if (tab === 'signup' && !name.trim() && !company.trim()) {
      setError('Enter your name or your company name.');
      return;
    }
    await sendCode();
  }

  async function passwordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await fetch('/api/account/password/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password })
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data.error || 'Could not sign in. Please try again.');
    onSuccess();
  }

  async function forgotSend(e: React.FormEvent) {
    e.preventDefault();
    if (await sendCode(false)) setStep('reset');
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await fetch('/api/account/password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, password: newPassword })
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return setError(data.error || 'Could not save your new password. Please try again.');
    onSuccess();
  }

  async function sendCode(goToVerify = true): Promise<boolean> {
    if (tab === 'signup' && newPassword && newPassword.length < 4) {
      setError('Use at least 4 characters for your password, or leave it empty.');
      return false;
    }
    setError('');
    setSending(true);
    const res = await fetch('/api/account/otp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error || 'Failed to send code. Please try again.');
      return false;
    }
    // data.code is only present when real WhatsApp delivery didn't happen in a
    // local test setup. Never auto-fill it.
    setDevDisplay(data.code || null);
    setNeedsProfile(!!data.needsName);
    if (tab === 'signup' && !data.needsName) setNotice('This number already has an account — verify the code to log in.');
    else if (tab === 'login' && data.needsName) setNotice("Looks like you're new here — verify the code, then add a few details.");
    else setNotice('');
    setResendIn(30);
    if (goToVerify) setStep('verify');
    return true;
  }

  // Sign up's optional password, saved once the code has signed them in.
  async function saveSignupPassword() {
    if (tab !== 'signup' || !newPassword) return;
    await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword })
    }).catch(() => {});
  }

  async function verifyPhone(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSending(true);
    const res = await fetch('/api/account/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code })
    });
    if (!res.ok) {
      setSending(false);
      const data = await res.json().catch(() => ({}));
      return setError(data.error || 'Invalid code. Please try again.');
    }
    await saveSignupPassword();
    // Signup already collected the profile fields -- save them now that the
    // number is verified and the account exists, instead of asking again.
    if (tab === 'signup' && needsProfile) {
      const saveRes = await fetch('/api/account/profile/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, company, dealsIn, goToRequirements, email })
      });
      setSending(false);
      if (!saveRes.ok) {
        // Verified and logged in already -- fall back to the standalone
        // details step instead of losing the session on a save failure.
        setStep('profile');
        return;
      }
      return onSuccess();
    }
    setSending(false);
    if (needsProfile) setStep('profile');
    else onSuccess();
  }

  const signup = tab === 'signup';

  return (
    <div>
      {(step === 'enter' || step === 'verify') && (
        <div className="login-mode-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={!signup} onClick={() => reset('login')} className={`login-mode-tab${!signup ? ' active' : ''}`}>Log in</button>
          <button type="button" role="tab" aria-selected={signup} onClick={() => reset('signup')} className={`login-mode-tab${signup ? ' active' : ''}`}>Sign up</button>
        </div>
      )}

      {step === 'enter' && !signup && method === 'password' && (
        <form onSubmit={passwordLogin}>
          <p className="login-hint">Sign in with your WhatsApp number and password.</p>
          <label className="po-label" htmlFor="login-phone" style={{ marginBottom: 6, display: 'block' }}>WhatsApp number</label>
          <input id="login-phone" name="username" type="tel" inputMode="tel" autoComplete="username" placeholder="e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus={autoFocus} style={{ marginBottom: 12 }} required />
          <label className="po-label" htmlFor="login-password" style={{ marginBottom: 6, display: 'block' }}>Password</label>
          <div className="login-password-field" style={{ marginBottom: 8 }}>
            <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="login-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          <p className="login-links" style={{ marginBottom: 14 }}>
            <button type="button" className="login-link" onClick={() => { setError(''); setCode(''); setNewPassword(''); setStep('forgot'); }}>Forgot password?</button>
          </p>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>{sending ? 'Signing in…' : 'Log in'}</button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => reset('login', 'otp')}>Log in with a WhatsApp code instead</button>
        </form>
      )}

      {step === 'enter' && (signup || method === 'otp') && (
        <form onSubmit={requestCode}>
          <p className="login-hint">
            {signup ? 'Just the essentials -- name or company, and a WhatsApp number to send your one-time code.' : 'Enter your WhatsApp number. We’ll send a one-time code.'}
          </p>

          {signup && (
            <>
              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your name</label>
              <input type="text" placeholder="e.g. Rajesh Kumar" value={name} onChange={(e) => setName(e.target.value)} autoFocus={autoFocus} style={{ marginBottom: 12 }} />

              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Company name</label>
              <input type="text" placeholder="e.g. Kumar Gems Pvt Ltd" value={company} onChange={(e) => setCompany(e.target.value)} style={{ marginBottom: 12 }} />
            </>
          )}

          <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>WhatsApp number</label>
          <input type="tel" name="username" inputMode="tel" autoComplete={signup ? 'username' : 'tel'} placeholder="WhatsApp number, e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus={autoFocus && !signup} style={{ marginBottom: signup ? 12 : 14 }} />

          {signup && (
            <>
              <label className="po-label" htmlFor="signup-password" style={{ marginBottom: 6, display: 'block' }}>Create a password <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <div className="login-password-field" style={{ marginBottom: 12 }}>
                <input id="signup-password" name="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 4 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                <button type="button" className="login-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
              </div>
            </>
          )}

          {signup && (
            <>
              {/* Optional, so folded away: on a phone these six checkboxes, a
                  text box and email made sign-up a long scroll before the one
                  button that matters. */}
              <details className="login-more" style={{ marginBottom: 14 }}>
              <summary>Add more details (optional)</summary>
              <label className="po-label" style={{ marginBottom: 6, marginTop: 10, display: 'block' }}>What do you deal in?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {DEALS_IN_OPTIONS.map((option) => (
                  <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, color: 'var(--ink)', cursor: 'pointer' }}>
                    <input type="checkbox" className="icon-select-checkbox" checked={dealsIn.includes(option)} onChange={() => toggleDealsIn(option)} style={{ pointerEvents: 'auto' }} />
                    {option}
                  </label>
                ))}
              </div>

              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Your go-to requirements</label>
              <textarea rows={2} placeholder="e.g. Round white CZ 1-3mm, regular monthly" value={goToRequirements} onChange={(e) => setGoToRequirements(e.target.value)} style={{ marginBottom: 12 }} />

              <label className="po-label" style={{ marginBottom: 6, display: 'block' }}>Email</label>
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </details>
            </>
          )}

          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>
            {sending ? 'Sending…' : 'Get code on WhatsApp'}
          </button>
          {!signup && (
            <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => reset('login', 'password')}>Log in with a password instead</button>
          )}
        </form>
      )}

      {step === 'forgot' && (
        <form onSubmit={forgotSend}>
          <p className="login-hint"><strong>Reset your password.</strong> We&rsquo;ll send a code to your WhatsApp; enter it with a new password.</p>
          <label className="po-label" htmlFor="forgot-phone" style={{ marginBottom: 6, display: 'block' }}>WhatsApp number</label>
          <input id="forgot-phone" name="username" type="tel" inputMode="tel" autoComplete="username" placeholder="e.g. 9XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus style={{ marginBottom: 14 }} required />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending}>{sending ? 'Sending…' : 'Get code on WhatsApp'}</button>
          <p className="login-hint" style={{ marginTop: 12 }}>No WhatsApp code arriving? Ask us to reset it for you.</p>
          <button type="button" className="btn-ghost" style={{ width: '100%' }} onClick={() => reset('login', 'password')}>&larr; Back to log in</button>
        </form>
      )}

      {step === 'reset' && (
        <form onSubmit={resetPassword}>
          <p className="login-hint">Code sent on WhatsApp to <strong>{phone.trim()}</strong>.</p>
          {devDisplay && (
            <p style={{ fontSize: 12.5, background: '#f4e6d0', color: '#8a5a1f', padding: '8px 10px', marginBottom: 14, borderRadius: 4 }}>
              WhatsApp delivery didn't go through this time. Your code: <strong>{devDisplay}</strong> — enter it below.
            </p>
          )}
          <input type="hidden" name="username" autoComplete="username" value={phone} />
          <label className="po-label" htmlFor="reset-code" style={{ marginBottom: 6, display: 'block' }}>6-digit code</label>
          <input id="reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} style={{ marginBottom: 12, letterSpacing: 4, textAlign: 'center', fontSize: 18 }} />
          <label className="po-label" htmlFor="reset-password" style={{ marginBottom: 6, display: 'block' }}>New password</label>
          <div className="login-password-field" style={{ marginBottom: 14 }}>
            <input id="reset-password" name="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="At least 4 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <button type="button" className="login-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending || code.length !== 6 || newPassword.length < 4}>{sending ? 'Saving…' : 'Save password & log in'}</button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} disabled={sending || resendIn > 0} onClick={() => { setCode(''); sendCode(false); }}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => reset('login', 'password')}>&larr; Back to log in</button>
        </form>
      )}

      {step === 'verify' && (
        <form onSubmit={verifyPhone}>
          <p className="login-hint">Code sent on WhatsApp to <strong>{phone.trim()}</strong>.</p>
          {notice && <p className="login-hint">{notice}</p>}
          {devDisplay && (
            <p style={{ fontSize: 12.5, background: '#f4e6d0', color: '#8a5a1f', padding: '8px 10px', marginBottom: 14, borderRadius: 4 }}>
              WhatsApp delivery didn't go through this time. Your code: <strong>{devDisplay}</strong> — enter it below.
            </p>
          )}
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ marginBottom: 14, letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }} disabled={sending || code.length !== 6}>
            {sending ? 'Verifying…' : needsProfile ? 'Verify & continue' : 'Verify & log in'}
          </button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} disabled={sending || resendIn > 0} onClick={() => { setCode(''); sendCode(); }}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          </button>
          <button type="button" className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => reset()}>
            &larr; Use a different number
          </button>
        </form>
      )}

      {step === 'profile' && (
        <>
          <p className="login-hint"><strong>Just a couple more details</strong></p>
          <ProfileCompletionForm onSuccess={onSuccess} needsPhone={false} showEmail />
        </>
      )}
    </div>
  );
}
