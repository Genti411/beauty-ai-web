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
  currentUserId,
  initialHasConsent,
}: {
  products: TryOnProduct[];
  initialProductId?: string;
  currentUserId: string | null;
  initialHasConsent: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    products.some((p) => p.id === initialProductId) ? initialProductId : undefined,
  );
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookSeed, setLookSeed] = useState(0);
  const [picks, setPicks] = useState<TryOnProduct[] | null>(null);
  const [hasConsent, setHasConsent] = useState(initialHasConsent);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId),
    [products, selectedId],
  );

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
    if (e instanceof NoFaceError) setStatus('No face detected — use a clear, front-facing photo.');
    else if (e instanceof MultipleFacesError) setStatus('More than one face detected — use a photo of just you.');
    else setStatus('Something went wrong loading the try-on engine. Please try again.');
  }

  async function apply() {
    const err = validateFile();
    if (err) { setStatus(err); return; }
    if (!selected) { setStatus('Please pick a product to try on.'); return; }
    setBusy(true); setStatus(null); setSavedNotice(null);
    try {
      const blob = await engine.applyLook(file!, [selected.shade]);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setPicks(null);
    } catch (e) { handleEngineError(e); } finally { setBusy(false); }
  }

  async function generateLook(seed: number) {
    const err = validateFile();
    if (err) { setStatus(err); return; }
    const nextPicks = pickTopShades(products, seed);
    if (nextPicks.length === 0) { setStatus('No try-on products are available right now.'); return; }
    setBusy(true); setStatus(null); setSavedNotice(null);
    try {
      const blob = await engine.applyLook(file!, nextPicks.map((p) => p.shade));
      setLookSeed(seed);
      setResultBlob(blob);
      setResultUrl(URL.createObjectURL(blob));
      setPicks(nextPicks);
    } catch (e) { handleEngineError(e); } finally { setBusy(false); }
  }

  async function postSave() {
    if (!resultBlob || !picks) return;
    setBusy(true); setStatus(null); setSavedNotice(null);
    try {
      const fd = new FormData();
      fd.append('blob', resultBlob, 'look.png');
      fd.append('picksJson', JSON.stringify(picks));
      const res = await fetch('/api/looks', { method: 'POST', body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus(`Could not save: ${j.error ?? res.statusText}`);
        return;
      }
      setSavedNotice('Saved! View it on Your looks.');
    } catch {
      setStatus('Network error while saving.');
    } finally { setBusy(false); }
  }

  async function onSaveClick() {
    if (!resultBlob || !picks) return;
    if (!hasConsent) { setConsentChecked(false); setConsentOpen(true); return; }
    await postSave();
  }

  async function confirmConsent() {
    if (!consentChecked) return;
    setBusy(true); setStatus(null);
    try {
      const res = await fetch('/api/looks/consent', { method: 'POST' });
      if (!res.ok) { setStatus('Could not record consent.'); return; }
      setHasConsent(true);
      setConsentOpen(false);
      await postSave();
    } catch {
      setStatus('Network error while recording consent.');
    } finally { setBusy(false); }
  }

  const canSave = !!currentUserId && !!picks && !!resultBlob;

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
          setResultBlob(null);
          setPicks(null);
          setSavedNotice(null);
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedId(p.id)}
            style={{
              border: selectedId === p.id ? '2px solid #208AEF' : '1px solid #ccc',
              borderRadius: 8, padding: 8,
            }}
          >
            <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: p.shade.hex, marginRight: 6, verticalAlign: 'middle' }} />
            {p.brand} {p.name}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={apply} disabled={busy}>{busy ? 'Applying…' : 'Apply'}</button>
        {file && (
          <button onClick={() => generateLook(0)} disabled={busy}>
            {busy ? 'Generating…' : 'Generate a look'}
          </button>
        )}
        {picks && file && (
          <button onClick={() => generateLook(lookSeed + 1)} disabled={busy}>
            Regenerate
          </button>
        )}
        {canSave && (
          <button onClick={onSaveClick} disabled={busy}>
            {busy ? 'Saving…' : 'Save look'}
          </button>
        )}
        {!currentUserId && picks && (
          <a href="/login" style={{ alignSelf: 'center' }}>Sign in to save</a>
        )}
      </div>

      {status && <p style={{ color: 'crimson' }}>{status}</p>}
      {savedNotice && (
        <p>
          {savedNotice}{' '}
          <a href="/looks">Your looks</a>
        </p>
      )}

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
              <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 7, background: p.shade.hex }} />
                <span><strong>{p.brand}</strong> {p.name} — {p.category}</span>
                <a href={p.buyUrl} target="_blank" rel="sponsored nofollow noopener" style={{ marginLeft: 'auto' }}>
                  Shop
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {consentOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'grid', placeItems: 'center', padding: 16, zIndex: 50,
          }}
        >
          <div style={{ background: '#fff', borderRadius: 8, padding: 16, maxWidth: 480, display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Save this look?</h2>
            <p>
              We&apos;ll keep the makeup-applied photo (a biometric image) and your selected
              products on Beauty AI&apos;s encrypted storage so you can come back to this look.
              Your original selfie is never uploaded. You can delete any saved look — or
              all of them — at any time from the <em>Your looks</em> page.
            </p>
            <label style={{ display: 'flex', gap: 8 }}>
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
              />
              <span>
                I consent to Beauty AI storing this rendered face image as biometric
                data, encrypted, until I delete it.
              </span>
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConsentOpen(false)} disabled={busy}>Cancel</button>
              <button onClick={confirmConsent} disabled={busy || !consentChecked}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
