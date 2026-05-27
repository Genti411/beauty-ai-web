# Beauty AI Web — Product Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, browseable/searchable makeup product catalog on the Beauty AI website, fed through a swappable ingestion interface (seeded from a curated sample for the MVP), backed by `products` + `tryon_shades` tables on the shared Supabase project.

**Architecture:** The shared DB schema (`products`, `tryon_shades`, RLS) is a migration in the mobile repo (single migration history). The website ingests data through a `FeedSource` interface (`SampleFeedSource` now, real affiliate adapter later) via a service-role script, and reads it server-side through the public anon read policy to render `/products`. Pure helpers (`parseCatalogQuery`, `normalizeProduct`, `rowToCard`) are unit-tested; ingestion idempotency and RLS are integration-tested against the local stack.

**Tech Stack:** Next.js 16 (App Router, TS), `@supabase/ssr` + `@supabase/supabase-js`, `tsx` for the ingestion script, Jest, Supabase CLI (local Postgres).

---

## Prerequisites / cross-repo notes

- **Two repos:**
  - `C:\Users\Genti\beauty-ai` (mobile) — owns `supabase/` and the shared DB migration history. **Task 1** adds the catalog migration here.
  - `C:\Users\Genti\beauty-ai-web` (web) — ingestion + UI. **Tasks 2–8** are here.
- **Foundation dependency:** the web tasks build on the web foundation (Next app + `lib/supabase/server.ts`). Execute on a branch that contains the foundation — either after merging foundation PR #1 to `main`, or stacked on `feature/web-foundation`.
- **Local Supabase stack** must be running (`cd C:\Users\Genti\beauty-ai && npx supabase start`, needs Docker). After Task 1's migration, run `npx supabase db reset` in the mobile repo so the new tables exist locally; keep the stack running for the web integration tests.
- Local URL: `http://127.0.0.1:54321`. The **service-role** key (for the ingestion script only) comes from `npx supabase status` (field `service_role key`). It is a server-only secret — it must NOT use the `NEXT_PUBLIC_` prefix and must never be imported by app/browser code.

## File structure

```
beauty-ai (mobile repo):
  supabase/migrations/20260526000002_products_catalog.sql   # products + tryon_shades + RLS

beauty-ai-web (web repo):
  lib/catalog/
    types.ts            # NormalizedProduct, Category, CATEGORIES
    normalize.ts        # normalizeProduct(raw) + normalize.test.ts
    query.ts            # parseCatalogQuery(params) + query.test.ts
    feed-source.ts      # FeedSource interface
    sample-feed.ts      # SampleFeedSource (curated sample) + sample-feed.test.ts
    products.ts         # getProducts(query), rowToCard + products.test.ts (rowToCard)
    ingest.ts           # ingest(source) + service-role admin client (importable, no auto-run)
  scripts/
    ingest.ts           # thin runner: calls ingest(new SampleFeedSource()) (run via `npm run ingest`)
  app/products/
    page.tsx            # public catalog page (Server Component)
    error.tsx           # client error boundary (read-failure retry)
    _components/
      product-card.tsx
      catalog-filters.tsx
      affiliate-disclosure.tsx
  tests/integration/
    catalog-rls.test.ts # ingestion idempotency + anon read / deny-write
```

---

## Task 1 (MOBILE repo): catalog migration

**Files:**
- Create: `C:\Users\Genti\beauty-ai\supabase\migrations\20260526000002_products_catalog.sql`

- [ ] **Step 1: Write the migration**

Create the file with EXACTLY:
```sql
-- Public makeup catalog + the try-on-enabled shade subset.
create table public.products (
  id              uuid primary key default gen_random_uuid(),
  source          text not null,
  external_id     text not null,
  brand           text not null,
  name            text not null,
  category        text not null,
  shade_name      text,
  image_url       text,
  price           numeric(10,2),
  currency        text not null default 'USD',
  buy_url         text not null,
  popularity_score int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source, external_id)
);

create index products_category_idx on public.products (category);
create index products_popularity_idx on public.products (popularity_score desc);

create table public.tryon_shades (
  product_id uuid primary key references public.products (id) on delete cascade,
  hex        text not null,
  region     text not null,
  finish     text
);

alter table public.products enable row level security;
alter table public.tryon_shades enable row level security;

-- Catalog is public: anyone may read. No client write policy — writes happen
-- only via the service role during ingestion.
create policy "products_public_read" on public.products for select using (true);
create policy "tryon_shades_public_read" on public.tryon_shades for select using (true);
```

- [ ] **Step 2: Apply and verify**

Run (from `C:\Users\Genti\beauty-ai`, Docker + stack running):
```powershell
npx supabase db reset
```
Then verify the objects exist:
```powershell
docker exec -i supabase_db_beauty-ai psql -U postgres -d postgres -c "\dt public.products" -c "\dt public.tryon_shades" -c "select polname, polcmd from pg_policy where polrelid in ('public.products'::regclass,'public.tryon_shades'::regclass) order by polname;"
```
Expected: both tables listed; two `r` (SELECT) policies `products_public_read` and `tryon_shades_public_read`.

- [ ] **Step 3: Commit (in the mobile repo)**

```bash
git -C C:\Users\Genti\beauty-ai add supabase/migrations/20260526000002_products_catalog.sql
git -C C:\Users\Genti\beauty-ai commit -m "feat: products + tryon_shades catalog tables with public-read RLS"
```
(Use a feature branch in the mobile repo if not already on one — do not commit on a protected main without intent.)

---

## Task 2 (WEB repo): catalog types + normalizeProduct (TDD)

**Files:**
- Create: `lib/catalog/types.ts`
- Create: `lib/catalog/normalize.ts`, `lib/catalog/normalize.test.ts`

- [ ] **Step 1: Create the types**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\types.ts`:
```ts
export const CATEGORIES = ['lipstick', 'eyeshadow', 'blush'] as const;
export type Category = (typeof CATEGORIES)[number];

export type ShadeData = {
  hex: string;
  region: 'lips' | 'eyes' | 'cheeks';
  finish?: string;
};

export type NormalizedProduct = {
  source: string;
  externalId: string;
  brand: string;
  name: string;
  category: Category;
  shadeName?: string;
  imageUrl?: string;
  price?: number;
  currency: string;
  buyUrl: string;
  popularityScore: number;
  shade?: ShadeData; // present only for try-on-enabled products
};
```

- [ ] **Step 2: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\normalize.test.ts`:
```ts
import { normalizeProduct } from './normalize';

const rawValid = {
  source: 'sample',
  external_id: 'lip-001',
  brand: 'Rouge Lab',
  name: 'Velvet Matte Lipstick',
  category: 'lipstick',
  shade_name: 'Crimson',
  image_url: 'https://example.com/lip-001.jpg',
  price: 24,
  currency: 'USD',
  buy_url: 'https://example.com/buy/lip-001',
  popularity_score: 90,
};

describe('normalizeProduct', () => {
  it('maps a valid raw row to a NormalizedProduct', () => {
    expect(normalizeProduct(rawValid)).toEqual({
      source: 'sample',
      externalId: 'lip-001',
      brand: 'Rouge Lab',
      name: 'Velvet Matte Lipstick',
      category: 'lipstick',
      shadeName: 'Crimson',
      imageUrl: 'https://example.com/lip-001.jpg',
      price: 24,
      currency: 'USD',
      buyUrl: 'https://example.com/buy/lip-001',
      popularityScore: 90,
    });
  });

  it('returns null when a required field is missing', () => {
    expect(normalizeProduct({ ...rawValid, buy_url: undefined })).toBeNull();
  });

  it('returns null for an unknown category', () => {
    expect(normalizeProduct({ ...rawValid, category: 'perfume' })).toBeNull();
  });

  it('defaults currency to USD and popularity to 0 when absent', () => {
    const { currency, popularity_score, ...rest } = rawValid;
    const result = normalizeProduct(rest);
    expect(result?.currency).toBe('USD');
    expect(result?.popularityScore).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- lib/catalog/normalize.test.ts`
Expected: FAIL — "Cannot find module './normalize'".

- [ ] **Step 4: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\normalize.ts`:
```ts
import { CATEGORIES, type Category, type NormalizedProduct } from './types';

type RawProduct = Record<string, unknown>;

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// Maps a raw feed row to a NormalizedProduct, or returns null if it is missing
// required fields or has an unknown category (the caller skips nulls).
export function normalizeProduct(raw: RawProduct): NormalizedProduct | null {
  const source = asString(raw.source);
  const externalId = asString(raw.external_id);
  const brand = asString(raw.brand);
  const name = asString(raw.name);
  const category = asString(raw.category);
  const buyUrl = asString(raw.buy_url);

  if (!source || !externalId || !brand || !name || !category || !buyUrl) return null;
  if (!CATEGORIES.includes(category as Category)) return null;

  return {
    source,
    externalId,
    brand,
    name,
    category: category as Category,
    shadeName: asString(raw.shade_name),
    imageUrl: asString(raw.image_url),
    price: asNumber(raw.price),
    currency: asString(raw.currency) ?? 'USD',
    buyUrl,
    popularityScore: asNumber(raw.popularity_score) ?? 0,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- lib/catalog/normalize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/catalog/types.ts lib/catalog/normalize.ts lib/catalog/normalize.test.ts
git commit -m "feat: catalog types and product normalizer"
```

---

## Task 3 (WEB repo): FeedSource interface + SampleFeedSource

**Files:**
- Create: `lib/catalog/feed-source.ts`
- Create: `lib/catalog/sample-feed.ts`, `lib/catalog/sample-feed.test.ts`

- [ ] **Step 1: Define the interface**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\feed-source.ts`:
```ts
import type { NormalizedProduct } from './types';

// A swappable catalog source. SampleFeedSource now; a real affiliate-feed
// adapter implements the same interface later.
export interface FeedSource {
  readonly source: string;
  fetchProducts(): Promise<NormalizedProduct[]>;
}
```

- [ ] **Step 2: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\sample-feed.test.ts`:
```ts
import { SampleFeedSource } from './sample-feed';
import { CATEGORIES } from './types';

describe('SampleFeedSource', () => {
  it('has source "sample"', () => {
    expect(new SampleFeedSource().source).toBe('sample');
  });

  it('returns several products, all with valid required fields and known categories', async () => {
    const products = await new SampleFeedSource().fetchProducts();
    expect(products.length).toBeGreaterThanOrEqual(6);
    for (const p of products) {
      expect(p.source).toBe('sample');
      expect(p.externalId).toBeTruthy();
      expect(p.brand).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.buyUrl).toMatch(/^https?:\/\//);
      expect(CATEGORIES).toContain(p.category);
    }
  });

  it('has unique externalIds', async () => {
    const products = await new SampleFeedSource().fetchProducts();
    const ids = products.map((p) => p.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes at least 4 try-on-enabled products with valid shade data', async () => {
    const products = await new SampleFeedSource().fetchProducts();
    const withShade = products.filter((p) => p.shade);
    expect(withShade.length).toBeGreaterThanOrEqual(4);
    for (const p of withShade) {
      expect(p.shade!.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['lips', 'eyes', 'cheeks']).toContain(p.shade!.region);
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- lib/catalog/sample-feed.test.ts`
Expected: FAIL — "Cannot find module './sample-feed'".

- [ ] **Step 4: Implement (fictional brands — avoids trademark issues in committed seed data)**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\sample-feed.ts`:
```ts
import type { FeedSource } from './feed-source';
import type { NormalizedProduct } from './types';

const SAMPLE: NormalizedProduct[] = [
  {
    source: 'sample', externalId: 'lip-001', brand: 'Rouge Lab',
    name: 'Velvet Matte Lipstick', category: 'lipstick', shadeName: 'Crimson',
    imageUrl: 'https://placehold.co/400x400?text=Crimson', price: 24, currency: 'USD',
    buyUrl: 'https://example.com/buy/lip-001', popularityScore: 95,
    shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
  },
  {
    source: 'sample', externalId: 'lip-002', brand: 'Glow Theory',
    name: 'Sheer Tint Balm', category: 'lipstick', shadeName: 'Rosewood',
    imageUrl: 'https://placehold.co/400x400?text=Rosewood', price: 18, currency: 'USD',
    buyUrl: 'https://example.com/buy/lip-002', popularityScore: 88,
    shade: { hex: '#A8576B', region: 'lips', finish: 'satin' },
  },
  {
    source: 'sample', externalId: 'lip-003', brand: 'Rouge Lab',
    name: 'Liquid Lip Stain', category: 'lipstick', shadeName: 'Berry',
    imageUrl: 'https://placehold.co/400x400?text=Berry', price: 22, currency: 'USD',
    buyUrl: 'https://example.com/buy/lip-003', popularityScore: 70,
  },
  {
    source: 'sample', externalId: 'eye-001', brand: 'Lumi',
    name: 'Single Eyeshadow', category: 'eyeshadow', shadeName: 'Bronze',
    imageUrl: 'https://placehold.co/400x400?text=Bronze', price: 16, currency: 'USD',
    buyUrl: 'https://example.com/buy/eye-001', popularityScore: 92,
    shade: { hex: '#8C5A2B', region: 'eyes', finish: 'shimmer' },
  },
  {
    source: 'sample', externalId: 'eye-002', brand: 'Lumi',
    name: 'Single Eyeshadow', category: 'eyeshadow', shadeName: 'Taupe',
    imageUrl: 'https://placehold.co/400x400?text=Taupe', price: 16, currency: 'USD',
    buyUrl: 'https://example.com/buy/eye-002', popularityScore: 80,
    shade: { hex: '#7A6A5A', region: 'eyes', finish: 'matte' },
  },
  {
    source: 'sample', externalId: 'blush-001', brand: 'Petal',
    name: 'Powder Blush', category: 'blush', shadeName: 'Peach',
    imageUrl: 'https://placehold.co/400x400?text=Peach', price: 20, currency: 'USD',
    buyUrl: 'https://example.com/buy/blush-001', popularityScore: 85,
    shade: { hex: '#E8896B', region: 'cheeks', finish: 'satin' },
  },
  {
    source: 'sample', externalId: 'blush-002', brand: 'Petal',
    name: 'Cream Blush', category: 'blush', shadeName: 'Mauve',
    imageUrl: 'https://placehold.co/400x400?text=Mauve', price: 21, currency: 'USD',
    buyUrl: 'https://example.com/buy/blush-002', popularityScore: 60,
  },
  {
    source: 'sample', externalId: 'eye-003', brand: 'Glow Theory',
    name: 'Shimmer Eyeshadow', category: 'eyeshadow', shadeName: 'Champagne',
    imageUrl: 'https://placehold.co/400x400?text=Champagne', price: 17, currency: 'USD',
    buyUrl: 'https://example.com/buy/eye-003', popularityScore: 78,
  },
];

export class SampleFeedSource implements FeedSource {
  readonly source = 'sample';
  async fetchProducts(): Promise<NormalizedProduct[]> {
    return SAMPLE;
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- lib/catalog/sample-feed.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/catalog/feed-source.ts lib/catalog/sample-feed.ts lib/catalog/sample-feed.test.ts
git commit -m "feat: FeedSource interface and curated SampleFeedSource"
```

---

## Task 4 (WEB repo): ingestion script + integration test

**Files:**
- Create: `scripts/ingest.ts`
- Create: `tests/integration/catalog-rls.test.ts`
- Modify: `.env.local` (add the service-role key, gitignored), `package.json` (add `ingest` script)

- [ ] **Step 1: Add the service-role env var (local only, NOT NEXT_PUBLIC)**

Get the local service-role key: `cd C:\Users\Genti\beauty-ai && npx supabase status` → copy the `service_role key`. Append to `C:\Users\Genti\beauty-ai-web\.env.local`:
```
SUPABASE_SERVICE_ROLE_KEY=<local service_role key from supabase status>
```
This is a server-only secret. It has NO `NEXT_PUBLIC_` prefix so it is never bundled into the browser, and it must never be imported by app code — only the ingestion script reads it. `.env.local` is already gitignored.

- [ ] **Step 2: Install tsx (to run the TS script) and add a package script**

Run:
```powershell
npm install --save-dev tsx
```
Add to `package.json` `"scripts"`: `"ingest": "tsx scripts/ingest.ts"` (keep existing scripts).

- [ ] **Step 3a: Write the importable ingestion module**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\ingest.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import type { FeedSource } from './feed-source';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
}

// Service-role client bypasses RLS for writes. Server/script-only — never
// imported by app/browser code (no NEXT_PUBLIC_ prefix on the key).
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function ingest(source: FeedSource): Promise<number> {
  const products = await source.fetchProducts();

  for (const p of products) {
    const { data, error } = await admin
      .from('products')
      .upsert(
        {
          source: p.source,
          external_id: p.externalId,
          brand: p.brand,
          name: p.name,
          category: p.category,
          shade_name: p.shadeName ?? null,
          image_url: p.imageUrl ?? null,
          price: p.price ?? null,
          currency: p.currency,
          buy_url: p.buyUrl,
          popularity_score: p.popularityScore,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source,external_id' },
      )
      .select('id')
      .single();
    if (error) throw error;

    if (p.shade) {
      const { error: shadeError } = await admin.from('tryon_shades').upsert(
        {
          product_id: data.id,
          hex: p.shade.hex,
          region: p.shade.region,
          finish: p.shade.finish ?? null,
        },
        { onConflict: 'product_id' },
      );
      if (shadeError) throw shadeError;
    }
  }

  return products.length;
}
```

- [ ] **Step 3b: Write the thin runner script**

Create `C:\Users\Genti\beauty-ai-web\scripts\ingest.ts` (only ever run via `npm run ingest`; never imported by tests):
```ts
import { ingest } from '../lib/catalog/ingest';
import { SampleFeedSource } from '../lib/catalog/sample-feed';

ingest(new SampleFeedSource())
  .then((n) => {
    console.log(`Ingested ${n} products.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

- [ ] **Step 4: Run the ingestion once**

With the local stack running and Task 1's migration applied, run (PowerShell, from `C:\Users\Genti\beauty-ai-web`):
```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_SERVICE_ROLE_KEY = "<service_role key>"
npm run ingest
```
Expected: "Ingested 8 products."

- [ ] **Step 5: Write the integration test**

Create `C:\Users\Genti\beauty-ai-web\tests\integration\catalog-rls.test.ts`:
```ts
/** @jest-environment node */
import { createClient } from '@supabase/supabase-js';
import { ingest } from '../../lib/catalog/ingest';
import { SampleFeedSource } from '../../lib/catalog/sample-feed';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe('catalog ingestion + RLS', () => {
  it('ingestion is idempotent (no duplicates on a second run)', async () => {
    await ingest(new SampleFeedSource());
    await ingest(new SampleFeedSource());

    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon
      .from('products')
      .select('id')
      .eq('source', 'sample');
    expect(error).toBeNull();
    expect(data!.length).toBe(8); // 8 sample products, not 16
  });

  it('anon can read products (public RLS) but cannot write', async () => {
    const anon = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const read = await anon.from('products').select('id').limit(1);
    expect(read.error).toBeNull();
    expect(read.data!.length).toBeGreaterThan(0);

    const write = await anon.from('products').insert({
      source: 'sample', external_id: 'hack-1', brand: 'x', name: 'x',
      category: 'lipstick', buy_url: 'https://example.com', currency: 'USD',
    });
    expect(write.error).not.toBeNull(); // RLS blocks the insert
  });
});
```

This integration test reuses the jest "integration" project (node env) created in the foundation. It needs the local stack running, Task 1's migration applied, and the env vars set (including `SUPABASE_SERVICE_ROLE_KEY` for `ingest`).

- [ ] **Step 6: Run the integration test**

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<local anon key>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<local service_role key>"
npm test -- tests/integration/catalog-rls.test.ts
```
Expected: PASS (2 tests). If the jest "integration" project's `testMatch` only includes `tests/integration/**/*.test.ts`, this file is picked up automatically.

- [ ] **Step 7: Commit (do NOT commit .env.local)**

```bash
git add lib/catalog/ingest.ts scripts/ingest.ts tests/integration/catalog-rls.test.ts package.json package-lock.json
git commit -m "feat: service-role ingestion with idempotency + RLS integration test"
```
Run `git status` first and confirm `.env.local` is not staged.

---

## Task 5 (WEB repo): parseCatalogQuery (TDD)

**Files:**
- Create: `lib/catalog/query.ts`, `lib/catalog/query.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\query.test.ts`:
```ts
import { parseCatalogQuery } from './query';

describe('parseCatalogQuery', () => {
  it('parses a known category, trimmed search, and page', () => {
    expect(parseCatalogQuery({ category: 'lipstick', search: '  red ', page: '2' })).toEqual({
      category: 'lipstick',
      search: 'red',
      page: 2,
    });
  });

  it('ignores an unknown category', () => {
    expect(parseCatalogQuery({ category: 'perfume' }).category).toBeUndefined();
  });

  it('defaults page to 1 when missing or invalid', () => {
    expect(parseCatalogQuery({}).page).toBe(1);
    expect(parseCatalogQuery({ page: 'abc' }).page).toBe(1);
    expect(parseCatalogQuery({ page: '0' }).page).toBe(1);
  });

  it('treats blank search as undefined', () => {
    expect(parseCatalogQuery({ search: '   ' }).search).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/catalog/query.test.ts`
Expected: FAIL — "Cannot find module './query'".

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\query.ts`:
```ts
import { CATEGORIES, type Category } from './types';

export type CatalogQuery = {
  category?: Category;
  search?: string;
  page: number;
};

type RawParams = {
  category?: string;
  search?: string;
  page?: string;
};

export function parseCatalogQuery(params: RawParams): CatalogQuery {
  const category = CATEGORIES.includes(params.category as Category)
    ? (params.category as Category)
    : undefined;

  const search = params.search?.trim() ? params.search.trim() : undefined;

  const pageNum = Number(params.page);
  const page = Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1;

  return { category, search, page };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/catalog/query.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/query.ts lib/catalog/query.test.ts
git commit -m "feat: parseCatalogQuery helper"
```

---

## Task 6 (WEB repo): getProducts data fetch + rowToCard (TDD for rowToCard)

**Files:**
- Create: `lib/catalog/products.ts`, `lib/catalog/products.test.ts`

- [ ] **Step 1: Write the failing test (pure mapper only)**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\products.test.ts`:
```ts
import { rowToCard } from './products';

describe('rowToCard', () => {
  it('maps a db row to a ProductCard', () => {
    expect(
      rowToCard({
        id: 'p1',
        brand: 'Rouge Lab',
        name: 'Velvet Matte Lipstick',
        category: 'lipstick',
        shade_name: 'Crimson',
        image_url: 'https://example.com/x.jpg',
        price: 24,
        currency: 'USD',
        buy_url: 'https://example.com/buy/x',
      }),
    ).toEqual({
      id: 'p1',
      brand: 'Rouge Lab',
      name: 'Velvet Matte Lipstick',
      category: 'lipstick',
      shadeName: 'Crimson',
      imageUrl: 'https://example.com/x.jpg',
      price: 24,
      currency: 'USD',
      buyUrl: 'https://example.com/buy/x',
    });
  });

  it('maps null shade_name/image_url/price to undefined', () => {
    const card = rowToCard({
      id: 'p2', brand: 'B', name: 'N', category: 'blush',
      shade_name: null, image_url: null, price: null, currency: 'USD',
      buy_url: 'https://example.com/buy/y',
    });
    expect(card.shadeName).toBeUndefined();
    expect(card.imageUrl).toBeUndefined();
    expect(card.price).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/catalog/products.test.ts`
Expected: FAIL — "Cannot find module './products'".

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\catalog\products.ts`:
```ts
import { createClient } from '@/lib/supabase/server';
import type { CatalogQuery } from './query';

export const PAGE_SIZE = 24;

export type ProductCard = {
  id: string;
  brand: string;
  name: string;
  category: string;
  shadeName?: string;
  imageUrl?: string;
  price?: number;
  currency: string;
  buyUrl: string;
};

type ProductRow = {
  id: string;
  brand: string;
  name: string;
  category: string;
  shade_name: string | null;
  image_url: string | null;
  price: number | null;
  currency: string;
  buy_url: string;
};

export function rowToCard(row: ProductRow): ProductCard {
  return {
    id: row.id,
    brand: row.brand,
    name: row.name,
    category: row.category,
    shadeName: row.shade_name ?? undefined,
    imageUrl: row.image_url ?? undefined,
    price: row.price ?? undefined,
    currency: row.currency,
    buyUrl: row.buy_url,
  };
}

export type CatalogResult = {
  products: ProductCard[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export async function getProducts(query: CatalogQuery): Promise<CatalogResult> {
  const supabase = await createClient();

  let q = supabase
    .from('products')
    .select(
      'id, brand, name, category, shade_name, image_url, price, currency, buy_url',
      { count: 'exact' },
    );

  if (query.category) q = q.eq('category', query.category);
  if (query.search) q = q.ilike('name', `%${query.search}%`);

  const from = (query.page - 1) * PAGE_SIZE;
  q = q.order('popularity_score', { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    products: (data ?? []).map((r) => rowToCard(r as ProductRow)),
    totalCount: count ?? 0,
    page: query.page,
    pageSize: PAGE_SIZE,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/catalog/products.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/products.ts lib/catalog/products.test.ts
git commit -m "feat: getProducts catalog query and rowToCard mapper"
```

---

## Task 7 (WEB repo): catalog page + components

**Files:**
- Create: `app/products/page.tsx`
- Create: `app/products/_components/affiliate-disclosure.tsx`
- Create: `app/products/_components/product-card.tsx`
- Create: `app/products/_components/catalog-filters.tsx`

- [ ] **Step 1: Affiliate disclosure component**

Create `C:\Users\Genti\beauty-ai-web\app\products\_components\affiliate-disclosure.tsx`:
```tsx
export function AffiliateDisclosure() {
  return (
    <p
      role="note"
      style={{ fontSize: 12, color: '#666', margin: '8px 0 16px' }}
    >
      Beauty AI may earn a commission from purchases made through links on this page.
    </p>
  );
}
```

- [ ] **Step 2: Product card component**

Create `C:\Users\Genti\beauty-ai-web\app\products\_components\product-card.tsx`:
```tsx
import type { ProductCard as Product } from '@/lib/catalog/products';

export function ProductCard({ product }: { product: Product }) {
  return (
    <article style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, display: 'grid', gap: 6 }}>
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external retailer images, no next/image loader configured
        <img src={product.imageUrl} alt={product.name} width={200} height={200} style={{ objectFit: 'cover', borderRadius: 6 }} />
      ) : (
        <div style={{ width: 200, height: 200, background: '#f4f4f4', borderRadius: 6 }} aria-hidden />
      )}
      <strong>{product.brand}</strong>
      <span>{product.name}</span>
      {product.shadeName && <span style={{ color: '#666' }}>{product.shadeName}</span>}
      {product.price !== undefined && (
        <span>{product.currency} {product.price.toFixed(2)}</span>
      )}
      <a href={product.buyUrl} target="_blank" rel="sponsored nofollow noopener">
        Shop
      </a>
    </article>
  );
}
```

- [ ] **Step 3: Catalog filters component (category links + search form)**

Create `C:\Users\Genti\beauty-ai-web\app\products\_components\catalog-filters.tsx`:
```tsx
import Link from 'next/link';
import { CATEGORIES, type Category } from '@/lib/catalog/types';

export function CatalogFilters({
  activeCategory,
  search,
}: {
  activeCategory?: Category;
  search?: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
      <form method="get" style={{ display: 'flex', gap: 8 }}>
        <input name="search" placeholder="Search products" defaultValue={search ?? ''} />
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        <button type="submit">Search</button>
      </form>
      <nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/products" style={{ fontWeight: activeCategory ? 'normal' : 'bold' }}>
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c}
            href={`/products?category=${c}`}
            style={{ fontWeight: activeCategory === c ? 'bold' : 'normal' }}
          >
            {c}
          </Link>
        ))}
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: The catalog page (Server Component — Next 16 `searchParams` is async)**

Create `C:\Users\Genti\beauty-ai-web\app\products\page.tsx`:
```tsx
import Link from 'next/link';
import { parseCatalogQuery } from '@/lib/catalog/query';
import { getProducts } from '@/lib/catalog/products';
import { AffiliateDisclosure } from './_components/affiliate-disclosure';
import { ProductCard } from './_components/product-card';
import { CatalogFilters } from './_components/catalog-filters';

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = parseCatalogQuery(params);
  const { products, totalCount, page, pageSize } = await getProducts(query);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (query.category) sp.set('category', query.category);
    if (query.search) sp.set('search', query.search);
    sp.set('page', String(p));
    return `/products?${sp.toString()}`;
  }

  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
      <h1>Products</h1>
      <AffiliateDisclosure />
      <CatalogFilters activeCategory={query.category} search={query.search} />

      {products.length === 0 ? (
        <p>No products found.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}
          <span>Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={pageHref(page + 1)}>Next</Link>}
        </nav>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Error boundary (read-failure state with retry)**

Create `C:\Users\Genti\beauty-ai-web\app\products\error.tsx`:
```tsx
'use client';

export default function ProductsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
      <h1>Products</h1>
      <p>We couldn’t load products right now.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
```
This catches a Supabase read failure in `getProducts` and renders a friendly state with a retry, instead of crashing.

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: compiles successfully; `/products` is a DYNAMIC route (`ƒ`) because it reads cookies via the server Supabase client.

- [ ] **Step 7: Commit**

```bash
git add app/products
git commit -m "feat: public product catalog page with filters, search, pagination, and disclosure"
```

---

## Task 8 (WEB repo): full verification pass

- [ ] **Step 1: Unit tests**

Run: `npm test -- --selectProjects unit`
Expected: all unit suites pass (email, guard, normalize, sample-feed, query, products).

- [ ] **Step 2: Integration test** (local stack running, Task 1 migration applied, env vars set)

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<local anon key>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<local service_role key>"
npm test -- --selectProjects integration
```
Expected: catalog-rls integration tests pass.

- [ ] **Step 3: Build + lint**

```powershell
npm run build
npm run lint
```
Expected: build compiles (`/products` dynamic); lint clean.

- [ ] **Step 4: Manual smoke (deferred to a human — needs the stack + a browser)**

After `npm run ingest`, run `npm run dev` and visit `/products`: products render; category links filter; search filters; pagination works (if >24 items); the affiliate disclosure shows; "Shop" links open the retailer in a new tab.

- [ ] **Step 5: Milestone commit**

```bash
git add -A
git commit --allow-empty -m "chore: product catalog milestone complete"
```

---

## Done criteria

- `products` + `tryon_shades` exist on the shared project with public-read RLS (migration in the mobile repo).
- `SampleFeedSource` ingests idempotently via the service-role script; `tryon_shades` seeded.
- `/products` publicly lists products with working category filter, name search, and pagination, ordered by popularity, with an FTC affiliate disclosure and correctly-`rel`'d buy-links.
- Unit + integration tests pass; build + lint clean.

## Out of scope (later slices)

Try-on rendering (slice 3), generate-a-look (slice 4), the real affiliate-feed adapter + scheduled refresh, product-detail pages, cart/checkout.
