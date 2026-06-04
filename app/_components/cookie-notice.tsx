'use client';

import { useState } from 'react';

const KEY = 'cookie-notice-dismissed';

export function CookieNotice() {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(KEY) !== '1';
  });

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, background: '#111', color: '#fff',
        padding: 12, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center',
        fontSize: 13, zIndex: 40,
      }}
    >
      <span>
        We use only essential cookies needed to sign you in. We don&apos;t use tracking or analytics
        cookies.
      </span>
      <button
        onClick={() => {
          localStorage.setItem(KEY, '1');
          setShow(false);
        }}
      >
        Got it
      </button>
    </div>
  );
}
