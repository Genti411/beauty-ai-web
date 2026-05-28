# Beauty AI Web — Generate a Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Generate a look" button to `/try-on` that picks the top product per category by `popularity_score` and applies them all to the photo in one engine call, with a Regenerate button that cycles through next-ranked picks.

**Architecture:** A pure `pickTopShades(products, seed)` helper does the selection (top per category, seed-th wrap). `TryOnProduct` gains `popularityScore` (one column in `getTryOnProducts`, one line in `rowToTryOnProduct`). `TryOnStudio` adds `lookSeed`/`picks` state, two buttons, and a picks list with affiliate buy-links. No new route, no server changes — purely client-side composition on top of the existing engine and catalog data.

**Tech Stack:** Next.js 16 (App Router, TS), the existing `TryOnEngine`, `@supabase/ssr`, Jest.

---

## Prerequisites

- Project: `C:\Users\Genti\beauty-ai-web`, branch `feature/web-generate` (stacked on `feature/web-tryon`). Work from there; absolute paths.
- Exists: `lib/catalog/tryon-products.ts` (`TryOnProduct`, `getTryOnProducts`, `rowToTryOnProduct`, `tryon-products.test.ts`); `lib/tryon/engine.ts` (`applyLook` accepts `ShadeData[]`); `lib/tryon/landmark-engine.ts`; `app/try-on/_components/tryon-studio.tsx`. The local Supabase stack is running + seeded (8 products, 5 with shades, mixed `popularity_score`).
- Local keys (new format): URL `http://127.0.0.1:54321`, anon `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`, service `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`.

## File structure

```
lib/tryon/
  pick.ts            # pickTopShades(products, seed) + pick.test.ts
lib/catalog/
  tryon-products.ts  # MODIFIED: TryOnProduct gains popularityScore; select adds popularity_score; rowToTryOnProduct maps it
  tryon-products.test.ts  # MODIFIED: existing tests get popularity_score; new assertion on popularityScore
app/try-on/_components/tryon-studio.tsx  # MODIFIED: lookSeed + picks state, two buttons, picks list with affiliate links
```

---

## Task 1: pickTopShades helper (TDD)

**Files:** Create `lib/tryon/pick.ts`, `lib/tryon/pick.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\pick.test.ts`:
```ts
import { pickTopShades } from './pick';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

function p(
  id: string,
  category: 'lipstick' | 'eyeshadow' | 'blush',
  popularityScore: number,
  hex = '#000000',
  region: 'lips' | 'eyes' | 'cheeks' = 'lips',
): TryOnProduct {
  return {
    id, brand: 'B', name: id, category, popularityScore,
    buyUrl: `https://example.com/buy/${id}`,
    shade: { hex, region },
  };
}

const sample: TryOnProduct[] = [
  p('lip-a', 'lipstick', 90, '#A00000', 'lips'),
  p('lip-b', 'lipstick', 60, '#B00000', 'lips'),
  p('lip-c', 'lipstick', 75, '#C00000', 'lips'),
  p('eye-a', 'eyeshadow', 88, '#0000A0', 'eyes'),
  p('eye-b', 'eyeshadow', 50, '#0000B0', 'eyes'),
  p('blush-a', 'blush', 80, '#00A000', 'cheeks'),
];

describe('pickTopShades', () => {
  it('returns the most popular product per category for seed 0', () => {
    const picks = pickTopShades(sample, 0);
    expect(picks.map((p) => p.id).sort()).toEqual(['blush-a', 'eye-a', 'lip-a']);
  });

  it('seed 1 picks the second-most-popular per category, wrapping per group size', () => {
    const picks = pickTopShades(sample, 1);
    // Lips sorted by popularity desc: lip-a(90), lip-c(75), lip-b(60) → seed 1 = lip-c
    // Eyes sorted: eye-a(88), eye-b(50) → seed 1 = eye-b
    // Blush has only blush-a → seed 1 wraps to blush-a
    expect(picks.map((p) => p.id).sort()).toEqual(['blush-a', 'eye-b', 'lip-c']);
  });

  it('seed wraps modularly per group size', () => {
    // seed 2 on the lips group of 3 wraps to lip-b (index 2 % 3 = 2 = lip-b at 60)
    // seed 2 on eyes group of 2 wraps to eye-a (index 2 % 2 = 0 = eye-a)
    // seed 2 on blush group of 1 wraps to blush-a
    const picks = pickTopShades(sample, 2);
    expect(picks.map((p) => p.id).sort()).toEqual(['blush-a', 'eye-a', 'lip-b']);
  });

  it('returns [] for empty input', () => {
    expect(pickTopShades([], 0)).toEqual([]);
  });

  it('ignores categories the engine does not render', () => {
    const products: TryOnProduct[] = [
      ...sample,
      // A category outside the supported set (engine renders only lipstick/eyeshadow/blush via lips/eyes/cheeks).
      { id: 'x', brand: 'B', name: 'x', category: 'foundation', popularityScore: 999, shade: { hex: '#fff', region: 'cheeks' } } as unknown as TryOnProduct,
    ];
    const picks = pickTopShades(products, 0);
    expect(picks.map((p) => p.category).sort()).toEqual(['blush', 'eyeshadow', 'lipstick']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/tryon/pick.test.ts`
Expected: FAIL — "Cannot find module './pick'".

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\pick.ts`:
```ts
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

const SUPPORTED_CATEGORIES = ['lipstick', 'eyeshadow', 'blush'] as const;

// Picks the seed-th most-popular product per supported category. seed wraps
// modularly within each category group; categories with no products are
// silently skipped, categories the engine doesn't render are ignored.
export function pickTopShades(products: TryOnProduct[], seed: number = 0): TryOnProduct[] {
  if (products.length === 0) return [];

  const result: TryOnProduct[] = [];
  for (const category of SUPPORTED_CATEGORIES) {
    const group = products
      .filter((p) => p.category === category)
      .sort((a, b) => b.popularityScore - a.popularityScore);
    if (group.length === 0) continue;
    result.push(group[seed % group.length]);
  }
  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/tryon/pick.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tryon/pick.ts lib/tryon/pick.test.ts
git commit -m "feat: pickTopShades top-per-category hotness picker"
```

---

## Task 2: Plumb `popularityScore` through `TryOnProduct`

**Files:** Modify `lib/catalog/tryon-products.ts`, `lib/catalog/tryon-products.test.ts`

The picker uses `popularityScore`, but the data layer doesn't expose it yet.

- [ ] **Step 1: Modify the type and mapper**

In `C:\Users\Genti\beauty-ai-web\lib\catalog\tryon-products.ts`:

1. Add `popularityScore: number;` AND `buyUrl: string;` to the `TryOnProduct` type (after `category`).
2. Add `popularity_score: number;` AND `buy_url: string;` to the `TryOnRow` type (after `category`).
3. In `rowToTryOnProduct`, add `popularityScore: row.popularity_score,` and `buyUrl: row.buy_url,` to the returned object (place them after `category`).
4. In `getTryOnProducts`, change the `.select(...)` columns string from
   `'id, brand, name, category, image_url, tryon_shades!inner(hex, region, finish)'`
   to
   `'id, brand, name, category, popularity_score, buy_url, image_url, tryon_shades!inner(hex, region, finish)'`.

- [ ] **Step 2: Update the unit tests**

In `C:\Users\Genti\beauty-ai-web\lib\catalog\tryon-products.test.ts`:

1. In the first test ("maps a joined row to a TryOnProduct"), add `popularity_score: 90,` and `buy_url: 'https://example.com/buy/p1',` to the input row (after `category`), and add `popularityScore: 90,` and `buyUrl: 'https://example.com/buy/p1',` to the expected object (after `category`).
2. In the second test ("handles null image and null finish; accepts the shade as an array (Supabase embed)"), add `popularity_score: 0,` and `buy_url: 'https://example.com/buy/p2',` to the input row (after `category`). Add a new assertion: `expect(result.popularityScore).toBe(0);` and `expect(result.buyUrl).toBe('https://example.com/buy/p2');`.

- [ ] **Step 3: Run to verify tests pass**

Run: `npm test -- lib/catalog/tryon-products.test.ts lib/tryon/pick.test.ts`
Expected: PASS (2 + 5 = 7 tests).

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: compiles successfully. (The pick + tryon-products tests cover the typed surface.)

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/tryon-products.ts lib/catalog/tryon-products.test.ts
git commit -m "feat: expose popularityScore on TryOnProduct"
```

---

## Task 3: Wire Generate-a-Look into TryOnStudio

**Files:** Modify `app/try-on/_components/tryon-studio.tsx`

This task is presented as a single replacement so the file stays focused (no need to also create a separate picks-list component — inline JSX is fine for the MVP).

- [ ] **Step 1: Replace the studio with the look-aware version**

Replace the ENTIRE contents of `C:\Users\Genti\beauty-ai-web\app\try-on\_components\tryon-studio.tsx` with EXACTLY:
```tsx
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
      setPicks(null); // single-product apply clears any generated look
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
            onClick={() => {
              setLookSeed(0);
              generateLook(0);
            }}
            disabled={busy}
          >
            {busy ? 'Generating…' : 'Generate a look'}
          </button>
        )}
        {picks && file && (
          <button
            onClick={() => {
              const nextSeed = lookSeed + 1;
              setLookSeed(nextSeed);
              generateLook(nextSeed);
            }}
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
```

NOTE on the "Shop" link: it points at `p.buyUrl` with `rel="sponsored nofollow noopener"` and `target="_blank"` — the same affiliate convention used by the catalog `ProductCard`. `buy_url` is now part of `TryOnProduct` (Task 2).

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles successfully; `/try-on` still listed as dynamic.

- [ ] **Step 3: Commit**

```bash
git add "app/try-on/_components/tryon-studio.tsx"
git commit -m "feat: Generate a look button + Regenerate on /try-on"
```

---

## Task 4: Verification pass

- [ ] **Step 1: Unit tests**

Run: `npm test -- --selectProjects unit`
Expected: all unit suites pass (incl. pick: 5, updated tryon-products: 2).

- [ ] **Step 2: Integration test** (stack running)

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
npm test -- --selectProjects integration
```
Expected: catalog-rls + tryon-products integration tests pass.

- [ ] **Step 3: Build + lint**

```powershell
npm run build
npm run lint
```
Expected: build compiles, lint clean.

- [ ] **Step 4: Manual visual (HUMAN)**

With the stack running + `npm run ingest` done, run `npm run dev`. On `/try-on`:
1. Upload a clear, front-facing selfie.
2. Click **Generate a look** → confirm lipstick + eyeshadow + blush apply in one pass and read naturally.
3. Click **Regenerate** → the picks swap to the next-ranked products; confirm the look changes.
4. Confirm the affiliate disclosure shows under "In this look", and each "Shop" link opens `/products?category=<…>` (which carries the real affiliate buy-links per product).
5. Try with no photo / non-image file → friendly messages.

- [ ] **Step 5: Milestone commit**

```bash
git add -A
git commit --allow-empty -m "chore: generate-a-look milestone complete"
```

---

## Done criteria

- `pickTopShades` unit-tested (5 tests).
- `TryOnProduct.popularityScore` plumbed through the data layer (tests updated).
- `/try-on` has **Generate a look** + **Regenerate** that apply multi-product looks via the existing engine.
- Picks list with affiliate disclosure renders below the result; build + lint clean.
- Manual visual confirms a multi-product look reads naturally and Regenerate cycles.

## Out of scope (later slices)

Undertone/suitability filtering, saving the generated look (slice 5), and sharing.
