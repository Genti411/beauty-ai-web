# Beauty AI Web — Product Catalog: Design Spec

**Date:** 2026-05-26
**Status:** Approved (pending user review of this document)
**Primary repo:** `beauty-ai-web` (UI). **Also touches:** `beauty-ai` (shared Supabase migration).

## Summary

The product catalog is sub-project 2 of the Beauty AI website. It lets anyone
browse and search makeup products (publicly, no login) and follow affiliate
buy-links, and it establishes the `products` data and a small try-on-enabled
`tryon_shades` subset that later slices (try-on engine, generate-a-look) build on.
Catalog data is ingested through a swappable `FeedSource` interface; for the MVP
it is seeded from a hand-curated sample (real affiliate feeds plug into the same
interface once the affiliate accounts are approved).

## Dependency

This slice builds on the **web foundation** (Next.js app + Supabase client
factories), which is currently in an open PR (`beauty-ai-web` #1). Building the
catalog requires the foundation present — either merge the foundation PR first
and branch from `main`, or stack the catalog branch on `feature/web-foundation`.
The plan will assume the foundation code is available.

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Catalog data for MVP | Seed a curated sample via a swappable `FeedSource`; real affiliate adapter later |
| 2 | Access | Public browse — no login required |
| 3 | Shared-DB schema location | Migration lives in the mobile repo (`beauty-ai/supabase/migrations`); single migration history |
| 4 | Try-on shade data | Include `tryon_shades` and seed a handful now (for slices 3–4) |
| 5 | Buy-links | Link out to retailer `buy_url` (no cart/checkout); `rel="sponsored nofollow noopener"` |
| 6 | Compliance | Visible FTC affiliate disclosure on pages with buy-links |

## Architecture

- **Shared schema in one place.** The website and app share one Supabase project,
  and Supabase keeps a single migration history per project. The new catalog
  tables are therefore added as a migration in the **mobile repo**
  (`beauty-ai/supabase/migrations`), which already owns that history. The website
  only *reads* them. This slice's plan touches both repos: a migration in
  `beauty-ai`, the UI + ingestion in `beauty-ai-web`.
- **Swappable ingestion.** A `FeedSource` interface (`fetchProducts(): Promise<NormalizedProduct[]>`).
  A `SampleFeedSource` (hand-curated, includes shade hex for a few products) is
  implemented now. A real affiliate-feed adapter implements the same interface
  later with no consumer changes.
- **Read path.** The website's `/products` page reads from Supabase server-side
  using the public (anon) read policy — no auth required.

## Data model (new tables; migration in the mobile repo)

- **`products`**
  - `id uuid primary key default gen_random_uuid()`
  - `source text not null` (e.g. `'sample'`)
  - `external_id text not null` (id within the source)
  - `brand text not null`
  - `name text not null`
  - `category text not null` (e.g. `lipstick`, `eyeshadow`, `blush`)
  - `shade_name text`
  - `image_url text`
  - `price numeric(10,2)`
  - `currency text not null default 'USD'`
  - `buy_url text not null`
  - `popularity_score int not null default 0`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - `unique (source, external_id)` — enables idempotent upserts.
- **`tryon_shades`** (try-on-enabled subset)
  - `product_id uuid primary key references public.products(id) on delete cascade`
  - `hex text not null` (e.g. `#B23A48`)
  - `region text not null` (`lips` | `eyes` | `cheeks`)
  - `finish text` (e.g. `matte`, `satin`)
- **RLS**
  - Both tables: RLS enabled, with a public `SELECT` policy (`using (true)`) so
    the catalog is publicly readable.
  - No client INSERT/UPDATE/DELETE policy — writes happen only via the service
    role during ingestion.

## Ingestion

- `NormalizedProduct` type mirrors the `products` columns (minus db-managed
  fields).
- `interface FeedSource { fetchProducts(): Promise<NormalizedProduct[]> }`.
- `SampleFeedSource implements FeedSource` — returns ~8–12 curated products
  spanning a few categories; a subset also carries `{ hex, region, finish }` for
  `tryon_shades`.
- `normalizeProduct(raw)` — pure mapper from a raw source row to `NormalizedProduct`
  (unit-tested).
- An **ingestion script** (run locally/manually for MVP, using the service-role
  key) upserts products by `(source, external_id)` and seeds `tryon_shades`. It
  is idempotent: running it twice produces no duplicates.

## Browse UI (website, public)

- **Route `/products`** (Server Component): a responsive grid of product cards.
- **Product card:** image, brand + name, shade name, price, and a **"Shop"**
  link to `buy_url` with `rel="sponsored nofollow noopener"` and
  `target="_blank"`.
- **Controls (URL query params, SEO/shareable):**
  - category filter, name search, pagination (`?category=&search=&page=`).
- **Data fetch:** server-side Supabase query — `.eq('category', …)` when set,
  `.ilike('name', %search%)` when set, ordered by `popularity_score` desc,
  `.range()` for pagination.
- **`parseCatalogQuery(searchParams)`** — a pure helper turning raw params into a
  typed `{ category?, search?, page }` (clamps page ≥ 1, ignores unknown
  categories). Unit-tested.
- No product-detail page for MVP (YAGNI) — cards link straight to the retailer.

## FTC compliance

A clear, visible affiliate disclosure on any page showing buy-links, e.g. a short
banner: "Beauty AI may earn a commission from purchases made through links on this
page." This is a hard requirement.

## Error handling

- Empty results (no products match filter/search) → a friendly "no products
  found" state, not an error.
- Supabase read failure → an error state with a retry, not a crash.
- Missing `image_url` → a neutral placeholder.
- Ingestion: a malformed feed row is skipped and logged; one bad row does not
  abort the whole import.

## Testing

- **Unit:** `parseCatalogQuery(searchParams)` (category/search/page parsing,
  page clamping, unknown-category handling); `normalizeProduct(raw)` (mapping +
  skipping incomplete rows).
- **Integration (local Supabase stack):** running `SampleFeedSource` ingestion
  twice is **idempotent** (no duplicates by `(source, external_id)`); an **anon**
  client can `SELECT` seeded products (public RLS) but a write is rejected (no
  write policy).

## Out of scope (later slices)

Try-on rendering (slice 3), the generate-a-look recommender (slice 4), the real
affiliate-feed adapter + scheduled refresh, product-detail pages, and any
cart/checkout (there is none — we link out to retailers).

## Open items to verify before/during build

- Which affiliate program to target first for the real adapter (e.g. Amazon
  Associates / Rakuten-Sephora) and its feed schema + usage terms.
- Final makeup category taxonomy.
- Exact disclosure wording (legal review when approaching launch).
