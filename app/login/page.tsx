'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizeEmail, isValidEmail } from '@/lib/auth/email';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const clean = normalizeEmail(email);
    if (!isValidEmail(clean)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: clean });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStage('code');
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/account');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: '64px auto', display: 'grid', gap: 12 }}>
      <h1>Log in to Beauty AI</h1>
      {stage === 'email' ? (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button onClick={sendCode} disabled={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <p>Enter the 6-digit code sent to {normalizeEmail(email)}</p>
          <input
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button onClick={verifyCode} disabled={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </main>
  );
}
