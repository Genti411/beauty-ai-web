'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';
import { LandmarkTryOnEngine } from '@/lib/tryon/landmark-engine';
import { NoFaceError, MultipleFacesError } from '@/lib/tryon/engine';
import { pickTopShades } from '@/lib/tryon/pick';

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
  const [lookSeed, setLookSeed] = useState(0);
  const [picks, setPicks] = useState<TryOnProduct[] | null>(null);

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

  function validateFile(): string | null {
    if (!file) return 'Please choose a photo first.';
    if (!file.type.startsWith('image/')) return 'Please choose an image file.';
    if (file.size > 15 * 1024 * 1024) return 'That image is too large (max 15 MB).';
    return null;
  }

  function handleEngineError(e: unknown) {
    if (e instanceof NoFaceError) {
      setStatus('No face detected — use a clear, front-facing photo.');
    } else if (e instanceof MultipleFacesError) {
      setStatus('More than one face detected — use a photo of just you.');
    } else {
      setStatus('Something went wrong loading the try-on engine. Please try again.');
    }
  }

  async function apply() {
    const fileError = validateFile();
    if (fileError) {
      setStatus(fileError);
      return;
    }
    if (!selected) {
      setStatus('Please pick a product to try on.');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const blob = await engine.applyLook(file!, [selected.shade]);
      setResultUrl(URL.createObjectURL(blob));
      setPicks(null);
    } catch (e) {
      handleEngineError(e);
    } finally {
      setBusy(false);
    }
  }

  async function generateLook(seed: number) {
    const fileError = validateFile();
    if (fileError) {
      setStatus(fileError);
      return;
    }
    const nextPicks = pickTopShades(products, seed);
    if (nextPicks.length === 0) {
      setStatus('No try-on products are available right now.');
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const blob = await engine.applyLook(file!, nextPicks.map((p) => p.shade));
      // Only advance the seed on success — otherwise an engine error would
      // permanently skip a rank on the next Regenerate.
      setLookSeed(seed);
      setResultUrl(URL.createObjectURL(blob));
      setPicks(nextPicks);
    } catch (e) {
      handleEngineError(e);
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
          setPicks(null);
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={apply} disabled={busy}>
          {busy ? 'Applying…' : 'Apply'}
        </button>
        {file && (
          <button
            onClick={() => generateLook(0)}
            disabled={busy}
          >
            {busy ? 'Generating…' : 'Generate a look'}
          </button>
        )}
        {picks && file && (
          <button
            onClick={() => generateLook(lookSeed + 1)}
            disabled={busy}
          >
            Regenerate
          </button>
        )}
      </div>

      {status && <p style={{ color: 'crimson' }}>{status}</p>}

      {resultUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- in-browser blob result, no next/image loader
        <img src={resultUrl} alt="Try-on result" style={{ maxWidth: '100%', borderRadius: 8 }} />
      )}

      {picks && picks.length > 0 && (
        <section style={{ display: 'grid', gap: 8 }}>
          <h2 style={{ fontSize: 16 }}>In this look</h2>
          <p style={{ fontSize: 12, color: '#666' }}>
            Beauty AI may earn a commission from purchases made through these links.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 6 }}>
            {picks.map((p) => (
              <li
                key={p.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    background: p.shade.hex,
                  }}
                />
                <span>
                  <strong>{p.brand}</strong> {p.name} — {p.category}
                </span>
                <a
                  href={p.buyUrl}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  style={{ marginLeft: 'auto' }}
                >
                  Shop
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
