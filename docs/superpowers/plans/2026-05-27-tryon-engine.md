# Beauty AI Web — Try-On Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload a photo on the website and see a makeup product's shade applied to the right facial region (lips/cheeks/eyes), entirely in the browser, behind a swappable `TryOnEngine`.

**Architecture:** A `TryOnEngine` interface with a client-side `LandmarkTryOnEngine` (MediaPipe FaceLandmarker → 468 landmarks → `<canvas>` polygon fills). Pure helpers map regions→polygons and finish→blend/opacity (unit-tested). A `/try-on` page (Server Component fetches try-on-enabled products) hosts a client `TryOnStudio` (upload, pick, render). The catalog gains a `hasTryOn` flag and a "Try it on" deep-link. The photo never leaves the browser.

**Tech Stack:** Next.js 16 (App Router, TS), `@mediapipe/tasks-vision`, `@supabase/ssr`, Jest.

---

## Prerequisites

- Project: `C:\Users\Genti\beauty-ai-web`, branch `feature/web-tryon` (branched off `feature/web-catalog`, so the catalog code + `tryon_shades` are present). Work from there; absolute paths.
- The local Supabase stack must be running and seeded (run the catalog `npm run ingest` if `tryon_shades` is empty). It now uses NEW-format keys:
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`
  - `SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz` (only for re-running ingest)
- `lib/catalog/types.ts` exports `ShadeData = { hex; region: 'lips'|'eyes'|'cheeks'; finish? }`. `lib/catalog/products.ts` has `getProducts`, `rowToCard`, `ProductCard`. `app/products/_components/product-card.tsx` exists.

## File structure

```
lib/tryon/
  finish.ts            # finishStyle(finish) + finish.test.ts
  regions.ts           # REGION_INDICES + regionPolygons() + regions.test.ts
  engine.ts            # TryOnEngine interface + error types
  landmark-engine.ts   # LandmarkTryOnEngine (client-side MediaPipe + canvas)
lib/catalog/
  tryon-products.ts    # getTryOnProducts(), rowToTryOnProduct(), TryOnProduct + tryon-products.test.ts
  products.ts          # MODIFIED: add hasTryOn to ProductCard/rowToCard/getProducts
app/try-on/
  page.tsx             # Server Component: fetch try-on products -> TryOnStudio
  error.tsx            # error boundary
  _components/tryon-studio.tsx   # Client: upload, picker, canvas, apply
app/products/_components/product-card.tsx  # MODIFIED: "Try it on" link when hasTryOn
tests/integration/tryon-products.test.ts   # getTryOnProducts vs local stack
```

---

## Task 1: Install MediaPipe tasks-vision

- [ ] **Step 1: Install**

Run (from `C:\Users\Genti\beauty-ai-web`):
```
npm install @mediapipe/tasks-vision
```
(Use `--legacy-peer-deps` only if npm reports a peer conflict.)

- [ ] **Step 2: Record the installed version**

Run:
```
npm ls @mediapipe/tasks-vision
```
Note the exact version (e.g. `0.10.x`). Task 4 sets the WASM CDN URL to this exact version so the WASM and JS match.

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @mediapipe/tasks-vision"
```

---

## Task 2: finishStyle helper (TDD)

**Files:** Create `lib/tryon/finish.ts`, `lib/tryon/finish.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\finish.test.ts`:
```ts
import { finishStyle } from './finish';

describe('finishStyle', () => {
  it('matte → opaque multiply', () => {
    expect(finishStyle('matte')).toEqual({ opacity: 0.55, blendMode: 'multiply' });
  });
  it('satin → soft-light', () => {
    expect(finishStyle('satin')).toEqual({ opacity: 0.45, blendMode: 'soft-light' });
  });
  it('shimmer → screen', () => {
    expect(finishStyle('shimmer')).toEqual({ opacity: 0.4, blendMode: 'screen' });
  });
  it('is case-insensitive', () => {
    expect(finishStyle('MATTE').blendMode).toBe('multiply');
  });
  it('defaults for unknown or absent finish', () => {
    expect(finishStyle('glossy')).toEqual({ opacity: 0.45, blendMode: 'multiply' });
    expect(finishStyle(undefined)).toEqual({ opacity: 0.45, blendMode: 'multiply' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/tryon/finish.test.ts`
Expected: FAIL — "Cannot find module './finish'".

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\finish.ts`:
```ts
export type FinishStyle = {
  opacity: number;
  blendMode: GlobalCompositeOperation;
};

// Maps a product finish to a canvas blend mode + opacity so the shade reads as
// makeup over skin rather than a flat sticker.
export function finishStyle(finish?: string): FinishStyle {
  switch ((finish ?? '').toLowerCase()) {
    case 'matte':
      return { opacity: 0.55, blendMode: 'multiply' };
    case 'satin':
      return { opacity: 0.45, blendMode: 'soft-light' };
    case 'shimmer':
      return { opacity: 0.4, blendMode: 'screen' };
    default:
      return { opacity: 0.45, blendMode: 'multiply' };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/tryon/finish.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tryon/finish.ts lib/tryon/finish.test.ts
git commit -m "feat: finishStyle blend/opacity mapping"
```

---

## Task 3: regionPolygons helper (TDD)

**Files:** Create `lib/tryon/regions.ts`, `lib/tryon/regions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\regions.test.ts`:
```ts
import { regionPolygons, REGION_INDICES, type Landmark } from './regions';

// 468 fake landmarks where landmark[i] = { x: i/1000, y: i/2000 }.
const landmarks: Landmark[] = Array.from({ length: 468 }, (_, i) => ({
  x: i / 1000,
  y: i / 2000,
}));

describe('regionPolygons', () => {
  it('returns one polygon for lips, scaled to pixel coordinates', () => {
    const polys = regionPolygons('lips', landmarks, 100, 200);
    expect(polys).toHaveLength(1);
    const firstIdx = REGION_INDICES.lips[0][0];
    expect(polys[0][0]).toEqual({ x: (firstIdx / 1000) * 100, y: (firstIdx / 2000) * 200 });
    expect(polys[0]).toHaveLength(REGION_INDICES.lips[0].length);
  });

  it('returns two polygons for eyes and for cheeks', () => {
    expect(regionPolygons('eyes', landmarks, 100, 100)).toHaveLength(2);
    expect(regionPolygons('cheeks', landmarks, 100, 100)).toHaveLength(2);
  });

  it('returns [] when landmarks are empty', () => {
    expect(regionPolygons('lips', [], 100, 100)).toEqual([]);
  });

  it('returns [] when landmarks are too few for the indices', () => {
    const few: Landmark[] = [{ x: 0, y: 0 }, { x: 0.1, y: 0.1 }];
    expect(regionPolygons('lips', few, 100, 100)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/tryon/regions.test.ts`
Expected: FAIL — "Cannot find module './regions'".

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\regions.ts`:
```ts
export type Region = 'lips' | 'eyes' | 'cheeks';
export type Landmark = { x: number; y: number };
export type Point = { x: number; y: number };

// MediaPipe FaceLandmarker (468-point face mesh) index loops per region.
// These are a reasonable STARTING set, refined during the manual visual step.
// Each region is one or more closed loops to fill as polygons.
export const REGION_INDICES: Record<Region, number[][]> = {
  // Outer lip contour loop.
  lips: [[61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]],
  // Upper-lid contours, left then right eye.
  eyes: [
    [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
    [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249],
  ],
  // Cheek blobs, left then right.
  cheeks: [
    [50, 101, 118, 117, 123],
    [280, 330, 347, 346, 352],
  ],
};

// Returns pixel-space polygons for a region given NORMALIZED landmarks (0..1) and
// the image dimensions. Returns [] if landmarks are missing or too few for the
// configured indices (caller renders nothing for that region).
export function regionPolygons(
  region: Region,
  landmarks: Landmark[],
  width: number,
  height: number,
): Point[][] {
  if (!landmarks || landmarks.length === 0) return [];
  const loops = REGION_INDICES[region];
  const result: Point[][] = [];
  for (const loop of loops) {
    if (loop.some((i) => i >= landmarks.length)) return [];
    result.push(loop.map((i) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height })));
  }
  return result;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/tryon/regions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tryon/regions.ts lib/tryon/regions.test.ts
git commit -m "feat: region → landmark polygon mapping"
```

---

## Task 4: TryOnEngine interface + LandmarkTryOnEngine

**Files:** Create `lib/tryon/engine.ts`, `lib/tryon/landmark-engine.ts`

This is client-side (canvas + MediaPipe). It is NOT unit-tested (it needs a real browser + model); its pure dependencies are tested in Tasks 2–3, and it's verified by `npm run build` (type-check) + the manual visual step in Task 7.

- [ ] **Step 1: Engine interface + errors**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\engine.ts`:
```ts
import type { ShadeData } from '@/lib/catalog/types';

export type { ShadeData };

export interface TryOnEngine {
  // Applies the given shades to a face in the image; returns a PNG Blob.
  applyLook(image: ImageBitmapSource, shades: ShadeData[]): Promise<Blob>;
}

export class NoFaceError extends Error {
  constructor() {
    super('No face detected');
    this.name = 'NoFaceError';
  }
}

export class MultipleFacesError extends Error {
  constructor() {
    super('Multiple faces detected');
    this.name = 'MultipleFacesError';
  }
}
```

- [ ] **Step 2: LandmarkTryOnEngine**

Create `C:\Users\Genti\beauty-ai-web\lib\tryon\landmark-engine.ts`:
```ts
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ShadeData, TryOnEngine } from './engine';
import { NoFaceError, MultipleFacesError } from './engine';
import { regionPolygons, type Region } from './regions';
import { finishStyle } from './finish';

// IMPORTANT: replace <VERSION> with the exact @mediapipe/tasks-vision version
// installed in Task 1 (from package.json) so the WASM matches the JS package.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@<VERSION>/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class LandmarkTryOnEngine implements TryOnEngine {
  private landmarkerPromise?: Promise<FaceLandmarker>;

  private getLandmarker(): Promise<FaceLandmarker> {
    if (!this.landmarkerPromise) {
      this.landmarkerPromise = (async () => {
        const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
        return FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL },
          runningMode: 'IMAGE',
          numFaces: 2, // detect up to 2 so we can reject multi-face photos
        });
      })();
    }
    return this.landmarkerPromise;
  }

  async applyLook(image: ImageBitmapSource, shades: ShadeData[]): Promise<Blob> {
    const bitmap = await createImageBitmap(image);
    const landmarker = await this.getLandmarker();
    const result = landmarker.detect(bitmap);

    if (!result.faceLandmarks || result.faceLandmarks.length === 0) throw new NoFaceError();
    if (result.faceLandmarks.length > 1) throw new MultipleFacesError();

    const landmarks = result.faceLandmarks[0];
    const { width, height } = bitmap;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    ctx.drawImage(bitmap, 0, 0);

    for (const shade of shades) {
      const polys = regionPolygons(shade.region as Region, landmarks, width, height);
      if (polys.length === 0) continue;
      const { opacity, blendMode } = finishStyle(shade.finish);
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.globalCompositeOperation = blendMode;
      ctx.fillStyle = shade.hex;
      for (const poly of polys) {
        ctx.beginPath();
        poly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png'),
    );
  }
}
```

- [ ] **Step 3: Set the WASM version**

Replace `<VERSION>` in `landmark-engine.ts` with the exact version from `npm ls @mediapipe/tasks-vision` (Task 1). Example: if installed `0.10.22`, the URL becomes `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm`.

- [ ] **Step 4: Verify build (type-check)**

Run: `npm run build`
Expected: compiles successfully. If `landmarker.detect(bitmap)` has a type mismatch on the input, check the installed `@mediapipe/tasks-vision` `detect()` signature and adjust the argument type minimally (it accepts `HTMLImageElement | HTMLCanvasElement | ImageBitmap | ...`). If genuinely blocked, report BLOCKED with the exact error.

- [ ] **Step 5: Commit**

```bash
git add lib/tryon/engine.ts lib/tryon/landmark-engine.ts
git commit -m "feat: TryOnEngine interface and client-side LandmarkTryOnEngine"
```

---

## Task 5: Catalog data layer — try-on products + hasTryOn

**Files:**
- Create: `lib/catalog/tryon-products.ts`, `lib/catalog/tryon-products.test.ts`
- Create: `tests/integration/tryon-products.test.ts`
- Modify: `lib/catalog/products.ts`, `lib/catalog/products.test.ts`, `app/products/_components/product-card.tsx`

- [ ] **Step 1: Write the failing unit test for the try-on mapper**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\tryon-products.test.ts`:
```ts
import { rowToTryOnProduct } from './tryon-products';

describe('rowToTryOnProduct', () => {
  it('maps a joined row to a TryOnProduct', () => {
    expect(
      rowToTryOnProduct({
        id: 'p1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick', category: 'lipstick',
        image_url: 'https://example.com/x.jpg',
        tryon_shades: { hex: '#B23A48', region: 'lips', finish: 'matte' },
      }),
    ).toEqual({
      id: 'p1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick', category: 'lipstick',
      imageUrl: 'https://example.com/x.jpg',
      shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
    });
  });

  it('handles null image and null finish; accepts the shade as an array (Supabase embed)', () => {
    const result = rowToTryOnProduct({
      id: 'p2', brand: 'B', name: 'N', category: 'blush', image_url: null,
      tryon_shades: [{ hex: '#E8896B', region: 'cheeks', finish: null }],
    });
    expect(result.imageUrl).toBeUndefined();
    expect(result.shade).toEqual({ hex: '#E8896B', region: 'cheeks', finish: undefined });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/catalog/tryon-products.test.ts`
Expected: FAIL — "Cannot find module './tryon-products'".

- [ ] **Step 3: Implement the try-on products data layer**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\tryon-products.ts`:
```ts
import { createClient } from '@/lib/supabase/server';
import type { ShadeData } from './types';

export type TryOnProduct = {
  id: string;
  brand: string;
  name: string;
  category: string;
  imageUrl?: string;
  shade: ShadeData;
};

type ShadeRow = { hex: string; region: string; finish: string | null };
type TryOnRow = {
  id: string;
  brand: string;
  name: string;
  category: string;
  image_url: string | null;
  // Supabase may return an embedded to-one relation as an object OR a
  // single-element array depending on relationship detection — handle both.
  tryon_shades: ShadeRow | ShadeRow[];
};

function firstShade(s: ShadeRow | ShadeRow[]): ShadeRow {
  return Array.isArray(s) ? s[0] : s;
}

export function rowToTryOnProduct(row: TryOnRow): TryOnProduct {
  const shade = firstShade(row.tryon_shades);
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    category: row.category,
    imageUrl: row.image_url ?? undefined,
    shade: {
      hex: shade.hex,
      region: shade.region as ShadeData['region'],
      finish: shade.finish ?? undefined,
    },
  };
}

export async function getTryOnProducts(): Promise<TryOnProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, brand, name, category, image_url, tryon_shades!inner(hex, region, finish)')
    .order('popularity_score', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => rowToTryOnProduct(r as unknown as TryOnRow));
}
```

- [ ] **Step 4: Run to verify the unit test passes**

Run: `npm test -- lib/catalog/tryon-products.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add `hasTryOn` to the catalog query + card**

In `C:\Users\Genti\beauty-ai-web\lib\catalog\products.ts`:
- Add `hasTryOn: boolean;` to the `ProductCard` type.
- Add `tryon_shades: { product_id: string } | { product_id: string }[] | null;` to the `ProductRow` type.
- In `rowToCard`, add: `hasTryOn: Array.isArray(row.tryon_shades) ? row.tryon_shades.length > 0 : row.tryon_shades != null,`
- In `getProducts`, change the `.select(...)` columns string to also embed the relation:
  `'id, brand, name, category, shade_name, image_url, price, currency, buy_url, tryon_shades(product_id)'`

Update `C:\Users\Genti\beauty-ai-web\lib\catalog\products.test.ts` — add `tryon_shades` to both rowToCard test inputs and assert `hasTryOn`:
- First test input: add `tryon_shades: { product_id: 'p1' }`, and add `hasTryOn: true` to the expected object.
- Second test input: add `tryon_shades: null`, and assert `expect(card.hasTryOn).toBe(false);`.

- [ ] **Step 6: Add the "Try it on" link to the product card**

In `C:\Users\Genti\beauty-ai-web\app\products\_components\product-card.tsx`, add an import at top:
```tsx
import Link from 'next/link';
```
And render a try-on link right before the closing `</article>`, after the "Shop" link:
```tsx
      {product.hasTryOn && (
        <Link href={`/try-on?product=${product.id}`}>Try it on</Link>
      )}
```

- [ ] **Step 7: Write the integration test for getTryOnProducts**

Create `C:\Users\Genti\beauty-ai-web\tests\integration\tryon-products.test.ts`:
```ts
/** @jest-environment node */
import { ingest } from '../../lib/catalog/ingest';
import { SampleFeedSource } from '../../lib/catalog/sample-feed';
import { getTryOnProducts } from '../../lib/catalog/tryon-products';

describe('getTryOnProducts', () => {
  beforeAll(async () => {
    await ingest(new SampleFeedSource()); // ensure seeded
  });

  it('returns only try-on-enabled products, each with a valid shade', async () => {
    const products = await getTryOnProducts();
    expect(products.length).toBe(5); // 5 sample products carry shade data
    for (const p of products) {
      expect(p.shade.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['lips', 'eyes', 'cheeks']).toContain(p.shade.region);
    }
  });
});
```
NOTE: `getTryOnProducts` uses the server Supabase client (`@/lib/supabase/server`), which calls `cookies()` from `next/headers`. In the node test environment that import may need cookies to be available. If the test errors on `next/headers`/`cookies`, switch this test to use a direct anon `createClient` from `@supabase/supabase-js` querying the same `select('... tryon_shades!inner(...)')` and mapping via `rowToTryOnProduct`, asserting the same expectations. Report which approach you used.

- [ ] **Step 8: Run unit + integration tests and build**

Run the unit suite: `npm test -- --selectProjects unit` (expect all green incl. updated products + new tryon-products).
Run the integration test with env vars set:
```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
npm test -- tests/integration/tryon-products.test.ts
```
Expected: PASS (1 test, 5 products). Then `npm run build` (clean).

- [ ] **Step 9: Commit**

```bash
git add lib/catalog/tryon-products.ts lib/catalog/tryon-products.test.ts tests/integration/tryon-products.test.ts lib/catalog/products.ts lib/catalog/products.test.ts "app/products/_components/product-card.tsx"
git commit -m "feat: try-on products data layer + hasTryOn flag and Try it on link"
```

---

## Task 6: /try-on page + TryOnStudio

**Files:** Create `app/try-on/page.tsx`, `app/try-on/error.tsx`, `app/try-on/_components/tryon-studio.tsx`

- [ ] **Step 1: The TryOnStudio client component**

Create `C:\Users\Genti\beauty-ai-web\app\try-on\_components\tryon-studio.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
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

  async function apply() {
    if (!file) {
      setStatus('Please choose a photo first.');
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
      setResultUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
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
```

- [ ] **Step 2: The page (Server Component)**

Create `C:\Users\Genti\beauty-ai-web\app\try-on\page.tsx`:
```tsx
import { getTryOnProducts } from '@/lib/catalog/tryon-products';
import { TryOnStudio } from './_components/tryon-studio';

export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const products = await getTryOnProducts();
  return <TryOnStudio products={products} initialProductId={product} />;
}
```

- [ ] **Step 3: Error boundary**

Create `C:\Users\Genti\beauty-ai-web\app\try-on\error.tsx`:
```tsx
'use client';

export default function TryOnError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 880, margin: '32px auto', padding: '0 16px' }}>
      <h1>Virtual Try-On</h1>
      <p>We could not load try-on right now.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: compiles successfully; `/try-on` appears (dynamic, since it reads cookies + searchParams). Do NOT run a dev server.

- [ ] **Step 5: Commit**

```bash
git add app/try-on
git commit -m "feat: /try-on page with upload, product picker, and canvas render"
```

---

## Task 7: Verification pass

- [ ] **Step 1: Unit tests**

Run: `npm test -- --selectProjects unit`
Expected: all unit suites pass (incl. finish, regions, tryon-products, updated products).

- [ ] **Step 2: Integration tests** (stack running, env vars set as in Task 5 Step 8)

Run: `npm test -- --selectProjects integration`
Expected: catalog-rls + tryon-products integration tests pass.

- [ ] **Step 3: Build + lint**

```powershell
npm run build
npm run lint
```
Expected: build compiles (`/try-on` present); lint clean.

- [ ] **Step 4: Manual visual verification (HUMAN — the core acceptance criterion)**

With the stack running and `npm run ingest` done, run `npm run dev`, then in a browser:
1. Visit `/try-on`. Upload a clear, front-facing selfie.
2. Pick a lipstick → Apply → confirm the lip color reads naturally (follows the lips, not a flat blob).
3. Pick a blush, then an eyeshadow → confirm cheeks/eyes render acceptably.
4. From `/products`, click "Try it on" on a try-on-enabled product → confirm it deep-links to `/try-on` with that product preselected.
5. Try a photo with no face and one with two faces → confirm the friendly messages.
If a region looks off, tune its index loop in `lib/tryon/regions.ts` (`REGION_INDICES`) and the opacity/blend in `lib/tryon/finish.ts`, then re-check. This visual tuning is expected and is the point of the slice.

- [ ] **Step 5: Milestone commit**

```bash
git add -A
git commit --allow-empty -m "chore: try-on engine milestone complete"
```

---

## Done criteria

- Pure helpers (`finishStyle`, `regionPolygons`, `rowToTryOnProduct`) are unit-tested; `getTryOnProducts` is integration-tested (returns the 5 seeded try-on products).
- `/try-on` lets a user upload a photo, pick a try-on-enabled product, and see the shade applied on a canvas — entirely client-side (photo never uploaded).
- Product cards show "Try it on" for try-on-enabled products, deep-linking with the product preselected.
- Build + lint clean.
- Manual visual check confirms lips/cheeks/eyes render acceptably (the human acceptance step).

## Out of scope (later slices)

Multi-product generate-a-look (slice 4 — engine already accepts a shade list), saving looks (slice 5), live camera, foundation/complex finishes, swapping in a licensed AR SDK, self-hosting the model.
