# Beauty AI Web — Try-On Engine: Design Spec

**Date:** 2026-05-27
**Status:** Approved (pending user review of this document)
**Repo:** `beauty-ai-web`. Stacks on the catalog slice.

## Summary

The try-on engine lets a user upload a photo and see a makeup product's shade
applied to the right facial region (lips, cheeks, eyes), entirely **in the
browser**. It is powered by MediaPipe FaceLandmarker (468 landmarks) + `<canvas>`
shade rendering, behind a swappable `TryOnEngine` interface so a licensed AR SDK
can replace it later. The photo is ephemeral — it is never uploaded. This slice
exists primarily to **de-risk visual quality**: does landmark-overlay shading look
good enough?

## Dependency

Stacks on the **catalog** slice (branch `feature/web-catalog` / PR #2 in
`beauty-ai-web`, plus the migration PR #2 in `beauty-ai`). It uses the
`tryon_shades` table and the catalog data layer (`getProducts`, `ProductCard`).
Build on `feature/web-tryon` (branched off `feature/web-catalog`); its PR targets
the catalog branch (or `main` once the catalog merges).

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Engine | Client-side MediaPipe FaceLandmarker + canvas, behind a swappable `TryOnEngine` |
| 2 | Input | Static uploaded photo (no live camera); ephemeral, never uploaded |
| 3 | Regions | Lips + cheeks + eyes (matches the three catalog categories) |
| 4 | Entry points | A dedicated `/try-on` page AND a "Try it on" deep-link on try-on-enabled product cards |
| 5 | Engine signature | `applyLook(image, shades: ShadeData[])` — accepts a list (slice 4 reuses it); v1 UI applies one product at a time |
| 6 | Model hosting | MediaPipe model/WASM from a CDN (photo stays local) |

## Architecture

- **`TryOnEngine` interface** (swappable):
  ```ts
  interface TryOnEngine {
    applyLook(image: ImageBitmapSource, shades: ShadeData[]): Promise<Blob>;
  }
  ```
  `ShadeData` = `{ hex, region: 'lips'|'eyes'|'cheeks', finish?: string }` (reused
  from the catalog types). v1 implementation: `LandmarkTryOnEngine`.
- **`LandmarkTryOnEngine`** (client-only): lazily loads the MediaPipe
  FaceLandmarker (WASM + `face_landmarker.task` model from a CDN), detects the 468
  landmarks on the uploaded image once, draws the image to an offscreen canvas,
  then for each shade fills the region polygon and returns the canvas as a Blob.
- **Privacy:** the model is fetched from a CDN; the user's photo is processed only
  in-page and never sent anywhere. No server involvement in try-on.
- **Client Components:** `/try-on`'s interactive part and the engine are
  `'use client'` (canvas + in-browser model). The page shell is a Server Component
  that fetches the product data.

## Rendering approach

- **Region polygons:** fixed MediaPipe landmark-index sets per region:
  - `lips` — outer lip contour indices.
  - `eyes` — upper eyelid region indices (both eyes).
  - `cheeks` — cheek-area indices (both cheeks), as filled blobs.
  A pure helper `regionPolygon(region, landmarks)` returns the ordered point list
  (normalized → pixel coordinates) for that region.
- **Finish → look:** a pure helper `finishStyle(finish)` maps a finish to
  `{ opacity, blendMode }` (e.g. `matte` → higher opacity, `multiply`; `satin`/
  `shimmer` → lower opacity, `soft-light`). Defaults applied for unknown/absent
  finish.
- **Fill:** for each shade, the engine paths the region polygon, sets the canvas
  `globalCompositeOperation` to the finish's blend mode and `globalAlpha` to its
  opacity, and fills with the hex — so the shade reads as makeup over skin, not a
  flat sticker. A light feather/blur on the region edge keeps it natural.

## Components / flow

- **`app/try-on/page.tsx` (Server Component):** fetches `getTryOnProducts()` and
  renders `<TryOnStudio products={...} initialProductId={(await searchParams).product} />`.
- **`app/try-on/_components/tryon-studio.tsx` (Client Component):** photo file
  upload; a product picker (the try-on-enabled products, optionally grouped by
  region/category); a result `<canvas>`; controls to switch product or reset.
  Applies the selected product's shade via the engine. Honors `initialProductId`.
- **Catalog integration (small additions to the catalog data layer on this branch):**
  - `getProducts` gains a `hasTryOn: boolean` (left-join `tryon_shades`); the
    `ProductCard` shows a **"Try it on"** link → `/try-on?product=<id>` only when
    `hasTryOn` is true.
  - New `getTryOnProducts(): Promise<TryOnProduct[]>` (products *inner-join*
    `tryon_shades`) where `TryOnProduct = { id, brand, name, category, imageUrl?, shade: ShadeData }`.
  - `rowToTryOnProduct(row)` — pure mapper (unit-tested).

## Data model

No new tables. Reads the existing `tryon_shades` (from the catalog slice) joined
to `products`. All reads use the existing public read policy (anon) — try-on is
public (no login).

## Error handling

- **No face detected / multiple faces:** friendly message asking for a clear,
  single, front-facing photo; no render.
- **Model load failure:** error state with a retry.
- **Non-image / oversized file:** rejected with a message before processing.
- **Bad or non-try-on `?product` id:** no preselection (studio opens with no
  product chosen).

## Testing

- **Unit (pure, no DOM/canvas):**
  - `regionPolygon(region, landmarks)` — returns the correct point set per region,
    converts normalized → pixel coords, handles a missing/empty landmark input.
  - `finishStyle(finish)` — correct `{ opacity, blendMode }` per finish + default.
  - `rowToTryOnProduct(row)` — db row → `TryOnProduct` (null image → undefined).
- **Build/lint:** `npm run build` (the `/try-on` page builds) and `npm run lint`
  clean.
- **Manual / visual (human):** the rendering quality is judged by a person — upload
  a real front-facing selfie on `/try-on`, apply a lipstick, a blush, and an
  eyeshadow, and confirm each reads naturally. A subagent/CI cannot make this call;
  it is the core acceptance criterion for this slice and is performed by the user.

## Out of scope (later slices)

Multi-product "generate a look" (slice 4 — the engine already accepts a shade
list), saving/sharing looks (slice 5), live-camera try-on, foundation/concealer
and complex finishes, and swapping in a licensed AR SDK.

## Open items to verify before/during build

- The exact MediaPipe `@mediapipe/tasks-vision` package + model URL and the
  current FaceLandmarker API (verify against docs at build time).
- The specific landmark-index sets for lips/eyes/cheeks (from MediaPipe's face
  mesh topology).
- Whether to self-host the model later (vs CDN) for reliability/offline.
