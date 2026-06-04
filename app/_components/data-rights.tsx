'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DataRights() {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Could not delete: ${j.error ?? res.statusText}`);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error while deleting your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: 12, marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
      <h2 style={{ fontSize: 18 }}>Your data</h2>

      <a href="/api/account/export" download>
        Export my data (JSON)
      </a>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ margin: 0 }}>
          Delete your account and all saved looks. This cannot be undone. Type{' '}
          <strong>DELETE</strong> to confirm.
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          aria-label="Type DELETE to confirm account deletion"
        />
        <button onClick={deleteAccount} disabled={busy || confirm !== 'DELETE'}>
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </div>
    </section>
  );
}
