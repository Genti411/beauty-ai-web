# Beauty AI Web — Generate a Look: Design Spec

**Date:** 2026-05-28
**Status:** Approved (pending user review of this document)
**Repo:** `beauty-ai-web`. Stacks on the try-on engine slice.

## Summary

"Generate a look" lets a user, on `/try-on`, click one button and see the top
trending products applied to their photo as a complete makeup look (lipstick +
eyeshadow + blush). Picks are ranked by `popularity_score` from the catalog;
the existing `TryOnEngine.applyLook(image, shades[])` does the multi-shade
composite. A "Regenerate" button cycles through the next-ranked picks. The
photo never leaves the browser. Affiliate buy-links are shown for each picked
product.

## Dependency

Stacks on the **try-on engine** slice (branch `feature/web-tryon` / PR #3 in
`beauty-ai-web`), which in turn stacks on the catalog. Build on
`feature/web-generate` (branched off `feature/web-tryon`); its PR targets
`feature/web-tryon`.

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Picker | Pure hotness (top `popularity_score` per category), no attribute extraction in v1 |
| 2 | Categories | One pick per category present in the catalog (lipstick/eyeshadow/blush) |
| 3 | Engine | Reuse `TryOnEngine.applyLook(image, shades[])` — already accepts a list |
| 4 | Entry point | A "Generate a look" button on `/try-on` (no new route) |
| 5 | Regenerate | A seed bumped per click → picks the next-ranked product per category, wrapping |
| 6 | Privacy | Unchanged — photo stays in the browser |
| 7 | Compliance | Picks list shows affiliate buy-links with `rel="sponsored nofollow noopener"` |

## Architecture

- **`pickTopShades(products: TryOnProduct[], seed = 0): TryOnProduct[]`** — a pure
  helper. Groups by `category`, sorts each group by `popularityScore` desc, and
  returns the `seed`-th entry of each (modular wrap on group size). Empty input
  returns `[]`. Unit-tested.
- **`TryOnProduct` gains `popularityScore: number`.** `getTryOnProducts` selects
  `popularity_score` from `products` (one extra column); `rowToTryOnProduct` maps
  it; an extra test case asserts the mapping.
- **`TryOnStudio` integration** — adds:
  - state: `lookSeed: number` (starts at 0), `picks: TryOnProduct[] | null`.
  - "Generate a look" button (visible when a photo is loaded): calls
    `pickTopShades(products, lookSeed)`, passes the picks' shades to
    `engine.applyLook(file, picks.map(p => p.shade))`, stores the result blob and
    the picks.
  - "Regenerate" button (visible when `picks` is set): bumps `lookSeed` and
    re-runs the pick + apply.
  - Picks list rendered alongside the result canvas — for each picked product:
    brand + name + shade + price + a "Shop" link to `buy_url` with
    `rel="sponsored nofollow noopener"`. (No new component — inline JSX in the
    studio is enough for MVP.)
- **No new route, no new server fetch.** The studio already has the product list
  from `/try-on/page.tsx`; this slice only adds client-side selection +
  multi-shade rendering.

## Data flow

1. Page (Server Component) loads `getTryOnProducts()` → passes to `TryOnStudio`.
2. User uploads a photo, clicks **Generate a look**.
3. `pickTopShades(products, lookSeed)` returns one product per category.
4. `engine.applyLook(file, picks.map(p => p.shade))` paints all shades onto the
   canvas in one pass.
5. Result Blob → object URL → displayed; picks list rendered.
6. Clicking **Regenerate** increments `lookSeed` and repeats from step 3.

## Error handling

- **No photo loaded:** the button is hidden until a file is chosen.
- **No try-on products available:** the button is hidden, with a small note.
- **NoFaceError / MultipleFacesError / engine errors:** handled by the same try-on
  status messages already in the studio.
- **Categories with only one product** (so regenerate would always pick the same
  thing): the modular wrap returns the same item — acceptable for v1.

## Testing

- **Unit (`pickTopShades`):**
  - Picks the most popular product per category present in the input.
  - `seed = 1` picks the second-most-popular per category; wraps on group size.
  - Empty input → `[]`.
  - Ignores categories the engine doesn't render (i.e. picks only from
    `lipstick | eyeshadow | blush` if any other categories ever appear).
- **Unit (`rowToTryOnProduct`):** add a case asserting `popularityScore` is
  mapped from `popularity_score` (extends the existing test).
- **Build/lint:** `npm run build`, `npm run lint` clean.
- **Manual (human):** open `/try-on`, upload a real selfie, click **Generate a
  look** → confirm a multi-product look reads naturally; **Regenerate** swaps
  picks. Affiliate disclosure and buy-links are correct.

## Out of scope (later slices)

Photo attribute extraction / undertone-based suitability filtering, saving a
generated look (slice 5), sharing, and any non-MVP UX polish.

## Open items to verify before/during build

- Whether to surface the picks list above or beside the canvas — small UX call;
  default is **below** the canvas for simplicity.
- Whether categories absent from the catalog should be silently skipped or shown
  with a "no pick available" hint — default is **silently skipped**.
