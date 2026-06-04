'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';
import { LandmarkTryOnEngine } from '@/lib/tryon/landmark-engine';
import { NoFaceError, MultipleFacesError } from '@/lib/tryon/engine';

const engine = new LandmarkTryOnEngine();

export function TryOnStudio({
  products,
  initialProductId,
}: {
  products: TryOnProduct[];
  initialProductId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    products.some((p) => p.id === initialProductId) ? initialProductId : undefined,
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId],
  );

  // Revoke the result blob URL when it changes or on unmount, to avoid leaks.
  useEffect(() => {
    return () => {
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, [resultUrl]);

  async function apply() {
    if (!file) {
      setStatus('Please choose a photo first.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setStatus('Please choose an image file.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setStatus('That image is too large (max 15 MB).');
      return;
    }
    if (!selected) {
      setStatus('Please pick a product to try on.');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const blob = await engine.applyLook(file, [selected.shade]);
      setResultUrl(URL.createObjectURL(blob));
    } catch (e) {
      if (e instanceof NoFaceError) {
        setStatus('No face detected — use a clear, front-facing photo.');
      } else if (e instanceof MultipleFacesError) {
        setStatus('More than one face detected — use a photo of just you.');
      } else {
        setStatus('Something went wrong loading the try-on engine. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <h1>Virtual Try-On</h1>
      <p style={{ color: '#666', fontSize: 14 }}>
        Your photo stays on your device — it is never uploaded.
      </p>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setResultUrl(null);
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            style={{
              border: selectedId === p.id ? '2px solid #208AEF' : '1px solid #ccc',
              borderRadius: 8,
              padding: 8,
            }}
          >
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: p.shade.hex, marginRight: 6, verticalAlign: 'middle' }} />
            {p.brand} {p.name}
          </button>
        ))}
      </div>

      <button onClick={apply} disabled={busy}>
        {busy ? 'Applying…' : 'Apply'}
      </button>

      {status && <p style={{ color: 'crimson' }}>{status}</p>}

      {resultUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- in-browser blob result, no next/image loader
        <img src={resultUrl} alt="Try-on result" style={{ maxWidth: '100%', borderRadius: 8 }} />
      )}
    </main>
  );
}
