# Beauty AI Web — Opt-in Save Looks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated user explicitly save a generated look (rendered result image + picks) to the shared Supabase backend behind one-time biometric consent, with a `/looks` gallery + delete (single + all). The original selfie is never uploaded.

**Architecture:** A `saved_looks` table + private `look-images` Storage bucket on the shared project, both with per-user RLS keyed to `auth.uid()`. A consent timestamp on `profiles`. Server-side data access from the Next.js server client; UI changes are a Save button on `/try-on` (with a consent modal) and a new auth-gated `/looks` page. Pure helpers (`pathFor`, `serializePicks`) are unit-tested; cross-user RLS isolation on DB + Storage is integration-tested.

**Tech Stack:** Next.js 16 (App Router, TS), `@supabase/ssr`, Supabase Storage, Jest.

---

## Prerequisites / cross-repo notes

- **Mobile repo** (`C:\Users\Genti\beauty-ai`): owns the shared migration history. **Task 1** lives here. Create a feature branch (e.g. `feature/save-looks-schema`) off `main` before committing.
- **Web repo** (`C:\Users\Genti\beauty-ai-web`): branch `feature/web-save-looks` (stacked on `feature/web-generate`). Tasks 2–8 are here.
- Local Supabase stack must be running. After Task 1's migration, run `npx supabase db reset` in the mobile repo. Then re-run the catalog ingest in the web repo (`npm run ingest`) so try-on products are seeded.
- Local keys (new format): URL `http://127.0.0.1:54321`, anon `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`, service `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`.

## File structure

```
beauty-ai (mobile):
  supabase/migrations/20260528000001_save_looks.sql

beauty-ai-web (web):
  lib/looks/
    path.ts           # pathFor(userId, lookId) + path.test.ts
    picks.ts          # serializePicks(picks) + picks.test.ts
    looks.ts          # saveLook/getSavedLooks/deleteSavedLook/deleteAllSavedLooks
  lib/profile/
    consent.ts        # hasSavedLooksConsent / recordSavedLooksConsent + consent.test.ts
  app/api/looks/
    route.ts          # POST upload
    consent/route.ts  # POST consent
  app/looks/
    page.tsx          # gallery (server, auth-gated)
    _components/look-card.tsx       # client; calls per-look delete server action
    _components/delete-all-button.tsx # client; calls delete-all server action
  app/looks/actions.ts                # server actions: deleteLookAction, deleteAllLooksAction
  app/try-on/_components/tryon-studio.tsx   # MODIFIED: Save look button + consent modal
  app/try-on/page.tsx                       # MODIFIED: load user + consent flag; pass to studio
  lib/auth/guard.ts                         # MODIFIED: /looks is a protected prefix
  tests/integration/save-looks.test.ts      # RLS + Storage isolation
```

---

## Task 1 (MOBILE repo): saved_looks migration + Storage bucket + policies

**Files:** Create `C:\Users\Genti\beauty-ai\supabase\migrations\20260528000001_save_looks.sql`. Switch to a fresh feature branch in the mobile repo first.

- [ ] **Step 1: Branch (mobile repo)**

Run:
```
git -C C:\Users\Genti\beauty-ai checkout main
git -C C:\Users\Genti\beauty-ai checkout -b feature/save-looks-schema
```

- [ ] **Step 2: Write the migration**

Create the file with EXACTLY:
```sql
-- Opt-in saved looks: a per-user gallery of rendered with-makeup images.
alter table public.profiles
  add column if not exists saved_looks_consented_at timestamptz;

create table public.saved_looks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  image_path  text not null,
  picks       jsonb not null,
  created_at  timestamptz not null default now()
);
create index saved_looks_user_created_idx on public.saved_looks (user_id, created_at desc);

alter table public.saved_looks enable row level security;

create policy "saved_looks_select_own"
  on public.saved_looks for select
  using (auth.uid() = user_id);

create policy "saved_looks_insert_own"
  on public.saved_looks for insert
  with check (auth.uid() = user_id);

create policy "saved_looks_delete_own"
  on public.saved_looks for delete
  using (auth.uid() = user_id);

-- Private Storage bucket for rendered look images.
insert into storage.buckets (id, name, public)
values ('look-images', 'look-images', false)
on conflict (id) do nothing;

-- Per-user prefix isolation on storage.objects for this bucket.
-- The object key is '<user_id>/<look_id>.png'.
create policy "look_images_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'look-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "look_images_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'look-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "look_images_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'look-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Step 3: Apply + verify**

Run (from `C:\Users\Genti\beauty-ai`):
```
npx supabase db reset
```
Expected: prior migrations + this one apply cleanly.

Verify the objects:
```
docker exec -i supabase_db_beauty-ai psql -U postgres -d postgres -c "\dt public.saved_looks" -c "select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='saved_looks_consented_at';" -c "select polname from pg_policy where polrelid='public.saved_looks'::regclass order by polname;" -c "select id, public from storage.buckets where id='look-images';" -c "select polname from pg_policy where polrelid='storage.objects'::regclass and polname like 'look_images_%' order by polname;"
```
Expected: table present; consent column present; three saved_looks policies; bucket `look-images` with `public=false`; three look_images storage policies.

- [ ] **Step 4: Commit**

```
git -C C:\Users\Genti\beauty-ai add supabase/migrations/20260528000001_save_looks.sql
git -C C:\Users\Genti\beauty-ai commit -m "feat: saved_looks table + look-images bucket with per-user RLS"
```

- [ ] **Step 5: Re-seed catalog (in the web repo)**

`db reset` wiped the seeded catalog. Re-run the ingest from `C:\Users\Genti\beauty-ai-web`:
```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
npm run ingest
```
Expected: "Ingested 8 products."

---

## Task 2 (WEB repo): pure helpers (TDD)

Three tiny, focused helpers — three small TDD cycles in one task.

**Files:** Create `lib/looks/path.ts` + test, `lib/looks/picks.ts` + test, `lib/profile/consent.ts` + test.

- [ ] **Step 1: Failing test for `pathFor`**

Create `C:\Users\Genti\beauty-ai-web\lib\looks\path.test.ts`:
```ts
import { pathFor } from './path';

describe('pathFor', () => {
  it('returns "<userId>/<lookId>.png"', () => {
    expect(pathFor('user-1', 'look-1')).toBe('user-1/look-1.png');
  });

  it('does not coerce the userId or lookId', () => {
    const path = pathFor('AAA-bbb', 'XYZ-123');
    expect(path).toBe('AAA-bbb/XYZ-123.png');
  });
});
```

- [ ] **Step 2: Run RED + implement**

Run: `npm test -- lib/looks/path.test.ts` → FAIL (module not found).
Create `C:\Users\Genti\beauty-ai-web\lib\looks\path.ts`:
```ts
// Storage object key for a saved look. The first segment must equal the
// owner's user id — the Storage RLS policy enforces it.
export function pathFor(userId: string, lookId: string): string {
  return `${userId}/${lookId}.png`;
}
```
Run again → PASS (2).

- [ ] **Step 3: Failing test for `serializePicks`**

Create `C:\Users\Genti\beauty-ai-web\lib\looks\picks.test.ts`:
```ts
import { serializePicks } from './picks';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

const sample: TryOnProduct[] = [
  {
    id: 'lip-1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick',
    category: 'lipstick', popularityScore: 95, buyUrl: 'https://example.com/buy/lip-1',
    imageUrl: 'https://example.com/x.jpg',
    shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
  },
];

describe('serializePicks', () => {
  it('keeps only the documented fields', () => {
    expect(serializePicks(sample)).toEqual([
      {
        id: 'lip-1', brand: 'Rouge Lab', name: 'Velvet Matte Lipstick',
        category: 'lipstick', buyUrl: 'https://example.com/buy/lip-1',
        shade: { hex: '#B23A48', region: 'lips', finish: 'matte' },
      },
    ]);
  });

  it('preserves order', () => {
    const second: TryOnProduct = { ...sample[0], id: 'lip-2' };
    expect(serializePicks([sample[0], second]).map((p) => p.id)).toEqual(['lip-1', 'lip-2']);
  });
});
```

- [ ] **Step 4: Run RED + implement**

Run: `npm test -- lib/looks/picks.test.ts` → FAIL.
Create `C:\Users\Genti\beauty-ai-web\lib\looks\picks.ts`:
```ts
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

export type SavedPick = {
  id: string;
  brand: string;
  name: string;
  category: string;
  buyUrl: string;
  shade: TryOnProduct['shade'];
};

// Project a TryOnProduct down to a minimal, stable shape stored in saved_looks.picks
// (jsonb). Avoids storing surprise fields and keeps the on-disk shape under our control.
export function serializePicks(picks: TryOnProduct[]): SavedPick[] {
  return picks.map((p) => ({
    id: p.id,
    brand: p.brand,
    name: p.name,
    category: p.category,
    buyUrl: p.buyUrl,
    shade: p.shade,
  }));
}
```
Run again → PASS (2).

- [ ] **Step 5: Failing test for consent helpers**

Create `C:\Users\Genti\beauty-ai-web\lib\profile\consent.test.ts`:
```ts
import { hasSavedLooksConsent } from './consent';

describe('hasSavedLooksConsent', () => {
  it('returns true when the timestamp is set', () => {
    expect(hasSavedLooksConsent({ saved_looks_consented_at: '2026-05-28T00:00:00Z' })).toBe(true);
  });
  it('returns false when null or missing', () => {
    expect(hasSavedLooksConsent({ saved_looks_consented_at: null })).toBe(false);
    expect(hasSavedLooksConsent({})).toBe(false);
  });
});
```

- [ ] **Step 6: Run RED + implement**

Run: `npm test -- lib/profile/consent.test.ts` → FAIL.
Create `C:\Users\Genti\beauty-ai-web\lib\profile\consent.ts`:
```ts
import { createClient } from '@/lib/supabase/server';

// Just the field this helper reads — accept anything wider.
export type ConsentRow = { saved_looks_consented_at?: string | null };

export function hasSavedLooksConsent(profile: ConsentRow): boolean {
  return !!profile.saved_looks_consented_at;
}

export async function recordSavedLooksConsent(userId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ saved_looks_consented_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}
```
Run again → PASS (2).

- [ ] **Step 7: Commit**

```bash
git add lib/looks/path.ts lib/looks/path.test.ts lib/looks/picks.ts lib/looks/picks.test.ts lib/profile/consent.ts lib/profile/consent.test.ts
git commit -m "feat: pure helpers for save-looks (path, picks projection, consent)"
```

---

## Task 3 (WEB repo): server-side data access

**Files:** Create `lib/looks/looks.ts`.

Pure helpers were unit-tested in Task 2; the data access here is exercised by the integration test in Task 7.

- [ ] **Step 1: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\looks\looks.ts`:
```ts
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { pathFor } from './path';
import { serializePicks, type SavedPick } from './picks';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

const BUCKET = 'look-images';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type SavedLook = {
  id: string;
  imageUrl: string;
  picks: SavedPick[];
  createdAt: string;
};

type SavedLookRow = {
  id: string;
  image_path: string;
  picks: SavedPick[];
  created_at: string;
};

export async function saveLook(args: {
  userId: string;
  blob: Blob;
  picks: TryOnProduct[];
}): Promise<{ id: string }> {
  const supabase = await createClient();
  const lookId = randomUUID();
  const imagePath = pathFor(args.userId, lookId);

  const upload = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, args.blob, { contentType: 'image/png', upsert: false });
  if (upload.error) throw upload.error;

  const { error } = await supabase
    .from('saved_looks')
    .insert({
      id: lookId,
      user_id: args.userId,
      image_path: imagePath,
      picks: serializePicks(args.picks),
    });
  if (error) {
    // Roll back the orphaned object on row-insert failure.
    await supabase.storage.from(BUCKET).remove([imagePath]);
    throw error;
  }
  return { id: lookId };
}

export async function getSavedLooks(): Promise<SavedLook[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_looks')
    .select('id, image_path, picks, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as SavedLookRow[];
  const looks: SavedLook[] = [];
  for (const r of rows) {
    const signed = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(r.image_path, SIGNED_URL_TTL);
    looks.push({
      id: r.id,
      imageUrl: signed.data?.signedUrl ?? '',
      picks: r.picks,
      createdAt: r.created_at,
    });
  }
  return looks;
}

export async function deleteSavedLook(lookId: string): Promise<void> {
  const supabase = await createClient();
  // Read first so we know the image path (RLS-scoped to owner).
  const { data, error: readError } = await supabase
    .from('saved_looks')
    .select('image_path')
    .eq('id', lookId)
    .maybeSingle();
  if (readError) throw readError;
  if (!data) return; // not found / not yours — nothing to do
  const path = (data as { image_path: string }).image_path;

  const removed = await supabase.storage.from(BUCKET).remove([path]);
  if (removed.error) throw removed.error;

  const { error: delError } = await supabase
    .from('saved_looks')
    .delete()
    .eq('id', lookId);
  if (delError) throw delError;
}

export async function deleteAllSavedLooks(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('saved_looks').select('image_path');
  if (error) throw error;
  const paths = (data ?? []).map((r) => (r as { image_path: string }).image_path);
  if (paths.length > 0) {
    const removed = await supabase.storage.from(BUCKET).remove(paths);
    if (removed.error) throw removed.error;
  }
  // RLS scopes the delete to the current user automatically.
  const { error: delError } = await supabase
    .from('saved_looks')
    .delete()
    .not('id', 'is', null);
  if (delError) throw delError;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add lib/looks/looks.ts
git commit -m "feat: server-side save/get/delete for saved looks"
```

---

## Task 4 (WEB repo): API routes

**Files:** Create `app/api/looks/route.ts`, `app/api/looks/consent/route.ts`.

The browser uploads the result Blob to the API, which runs server-side with cookies-authed Supabase.

- [ ] **Step 1: Upload route**

Create `C:\Users\Genti\beauty-ai-web\app\api\looks\route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { saveLook } from '@/lib/looks/looks';
import type { TryOnProduct } from '@/lib/catalog/tryon-products';

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const blob = form.get('blob');
  const picksJson = form.get('picksJson');
  if (!(blob instanceof Blob) || typeof picksJson !== 'string') {
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  }
  let picks: TryOnProduct[];
  try {
    picks = JSON.parse(picksJson);
  } catch {
    return NextResponse.json({ error: 'bad picks json' }, { status: 400 });
  }
  if (!Array.isArray(picks) || picks.length === 0) {
    return NextResponse.json({ error: 'picks required' }, { status: 400 });
  }

  try {
    const { id } = await saveLook({ userId: user.id, blob, picks });
    return NextResponse.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'save failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Consent route**

Create `C:\Users\Genti\beauty-ai-web\app\api\looks\consent\route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { recordSavedLooksConsent } from '@/lib/profile/consent';

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    await recordSavedLooksConsent(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'consent failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: compiles; `/api/looks` and `/api/looks/consent` appear as dynamic API routes.

- [ ] **Step 4: Commit**

```bash
git add app/api/looks
git commit -m "feat: API routes for saving a look and recording consent"
```

---

## Task 5 (WEB repo): /try-on Save button + consent modal

**Files:** Modify `app/try-on/page.tsx`, `app/try-on/_components/tryon-studio.tsx`.

- [ ] **Step 1: Update the page to load user + consent flag**

Replace `C:\Users\Genti\beauty-ai-web\app\try-on\page.tsx` with EXACTLY:
```tsx
import { createClient } from '@/lib/supabase/server';
import { getTryOnProducts } from '@/lib/catalog/tryon-products';
import { hasSavedLooksConsent } from '@/lib/profile/consent';
import { TryOnStudio } from './_components/tryon-studio';

export default async function TryOnPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;
  const products = await getTryOnProducts();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let consented = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('saved_looks_consented_at')
      .eq('id', user.id)
      .maybeSingle();
    consented = hasSavedLooksConsent(
      (profile as { saved_looks_consented_at: string | null } | null) ?? {},
    );
  }

  return (
    <TryOnStudio
      products={products}
      initialProductId={product}
      currentUserId={user?.id ?? null}
      initialHasConsent={consented}
    />
  );
}
```

- [ ] **Step 2: Update the studio with Save + consent modal**

Replace `C:\Users\Genti\beauty-ai-web\app\try-on\_components\tryon-studio.tsx` with EXACTLY:
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
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/try-on` still listed; compiles cleanly.

- [ ] **Step 4: Commit**

```bash
git add app/try-on/page.tsx "app/try-on/_components/tryon-studio.tsx"
git commit -m "feat: Save look button + biometric consent modal on /try-on"
```

---

## Task 6 (WEB repo): /looks gallery + delete

**Files:** Create `app/looks/page.tsx`, `app/looks/actions.ts`, `app/looks/_components/look-card.tsx`, `app/looks/_components/delete-all-button.tsx`. Modify `lib/auth/guard.ts` to protect `/looks`.

- [ ] **Step 1: Add `/looks` to the protected prefixes**

In `C:\Users\Genti\beauty-ai-web\lib\auth\guard.ts`, change the line
`const PROTECTED_PREFIXES = ['/account'];`
to
`const PROTECTED_PREFIXES = ['/account', '/looks'];`

Update `C:\Users\Genti\beauty-ai-web\lib\auth\guard.test.ts` — add a test asserting `shouldRedirectToLogin('/looks', false)` is `true` and `shouldRedirectToLogin('/looks', true)` is `false`. Add inside the same `describe`:
```ts
  it('redirects unauthenticated users from /looks', () => {
    expect(shouldRedirectToLogin('/looks', false)).toBe(true);
    expect(shouldRedirectToLogin('/looks', true)).toBe(false);
  });
```

- [ ] **Step 2: Server actions**

Create `C:\Users\Genti\beauty-ai-web\app\looks\actions.ts`:
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { deleteSavedLook, deleteAllSavedLooks } from '@/lib/looks/looks';

export async function deleteLookAction(formData: FormData): Promise<void> {
  const id = formData.get('id');
  if (typeof id !== 'string' || !id) return;
  await deleteSavedLook(id);
  revalidatePath('/looks');
}

export async function deleteAllLooksAction(): Promise<void> {
  await deleteAllSavedLooks();
  revalidatePath('/looks');
}
```

- [ ] **Step 3: Components**

Create `C:\Users\Genti\beauty-ai-web\app\looks\_components\look-card.tsx`:
```tsx
import type { SavedLook } from '@/lib/looks/looks';
import { deleteLookAction } from '../actions';

export function LookCard({ look }: { look: SavedLook }) {
  return (
    <article style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not next/image */}
      <img src={look.imageUrl} alt="Saved look" style={{ width: '100%', borderRadius: 6 }} />
      <p style={{ fontSize: 12, color: '#666' }}>
        Saved {new Date(look.createdAt).toLocaleString()}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>
        {look.picks.map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: p.shade.hex }} />
            <span><strong>{p.brand}</strong> {p.name}</span>
            <a href={p.buyUrl} target="_blank" rel="sponsored nofollow noopener" style={{ marginLeft: 'auto' }}>
              Shop
            </a>
          </li>
        ))}
      </ul>
      <form action={deleteLookAction}>
        <input type="hidden" name="id" value={look.id} />
        <button type="submit">Delete this look</button>
      </form>
    </article>
  );
}
```

Create `C:\Users\Genti\beauty-ai-web\app\looks\_components\delete-all-button.tsx`:
```tsx
import { deleteAllLooksAction } from '../actions';

export function DeleteAllButton() {
  return (
    <form action={deleteAllLooksAction}>
      <button type="submit">Delete all my looks</button>
    </form>
  );
}
```

- [ ] **Step 4: The page**

Create `C:\Users\Genti\beauty-ai-web\app\looks\page.tsx`:
```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSavedLooks } from '@/lib/looks/looks';
import { LookCard } from './_components/look-card';
import { DeleteAllButton } from './_components/delete-all-button';

export default async function LooksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const looks = await getSavedLooks();

  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Your looks</h1>
        {looks.length > 0 && <div style={{ marginLeft: 'auto' }}><DeleteAllButton /></div>}
      </header>
      {looks.length === 0 ? (
        <p>No saved looks yet. <Link href="/try-on">Try one on</Link>.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {looks.map((l) => <LookCard key={l.id} look={l} />)}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npm test -- lib/auth/guard.test.ts` (expect 6 tests). Then `npm run build` — `/looks` should appear as a dynamic route, and `/api/looks` + `/api/looks/consent` as dynamic API routes.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/guard.ts lib/auth/guard.test.ts app/looks
git commit -m "feat: /looks gallery + per-look delete + delete-all"
```

---

## Task 7 (WEB repo): integration test — RLS + Storage isolation

**Files:** Create `tests/integration/save-looks.test.ts`.

- [ ] **Step 1: Write the test**

Create `C:\Users\Genti\beauty-ai-web\tests\integration\save-looks.test.ts`:
```ts
/** @jest-environment node */
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'look-images';

function freshClient() {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signUpUser() {
  const client = freshClient();
  const email = `s_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: 'Password123!' });
  if (error) throw error;
  return { client, userId: data.user!.id };
}

describe('save-looks RLS + Storage isolation', () => {
  it('isolates saved_looks rows and look-images objects between users', async () => {
    const a = await signUpUser();
    const b = await signUpUser();

    // --- DB isolation ---
    const insertA = await a.client.from('saved_looks').insert({
      user_id: a.userId,
      image_path: `${a.userId}/x.png`,
      picks: [],
    }).select('id').single();
    expect(insertA.error).toBeNull();
    const lookAId = (insertA.data as { id: string }).id;

    // B cannot see or delete A's row.
    const bSeesA = await b.client.from('saved_looks').select('id').eq('id', lookAId).maybeSingle();
    expect(bSeesA.data).toBeNull();

    const bDeletesA = await b.client.from('saved_looks').delete().eq('id', lookAId);
    expect(bDeletesA.error).toBeNull();
    const stillThere = await a.client.from('saved_looks').select('id').eq('id', lookAId).maybeSingle();
    expect(stillThere.data?.id).toBe(lookAId); // RLS hid the row from B; A's row survives

    // B cannot insert into A's user_id.
    const bImpersonatesA = await b.client.from('saved_looks').insert({
      user_id: a.userId,
      image_path: `${a.userId}/x2.png`,
      picks: [],
    });
    expect(bImpersonatesA.error).not.toBeNull();

    // --- Storage isolation ---
    const aPath = `${a.userId}/own.png`;
    const bPath = `${b.userId}/own.png`;
    const tinyPng = new Blob(
      [Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
      { type: 'image/png' },
    );

    const aOwnUp = await a.client.storage.from(BUCKET).upload(aPath, tinyPng);
    expect(aOwnUp.error).toBeNull();

    // A cannot upload under B's prefix.
    const aImp = await a.client.storage.from(BUCKET).upload(bPath, tinyPng);
    expect(aImp.error).not.toBeNull();

    // B can list/own; cannot read A's object.
    const bReadsA = await b.client.storage.from(BUCKET).createSignedUrl(aPath, 60);
    expect(bReadsA.error).not.toBeNull();

    // Cleanup: each user removes own.
    await a.client.storage.from(BUCKET).remove([aPath]);
  });
});
```

- [ ] **Step 2: Run**

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
npm test -- tests/integration/save-looks.test.ts
```
Expected: PASS (1 test, multiple assertions).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/save-looks.test.ts
git commit -m "test: cross-user isolation on saved_looks + look-images storage"
```

---

## Task 8 (WEB repo): full verification pass

- [ ] **Step 1: Unit + integration tests**

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
npm test
```
Expected: all suites pass.

- [ ] **Step 2: Build + lint**

```powershell
npm run build
npm run lint
```
Expected: clean.

- [ ] **Step 3: Manual (HUMAN)**

`npm run dev`, then in a browser:
1. Sign in.
2. Generate a look at `/try-on`. Click **Save look** → consent modal → check → Save → confirmation.
3. Visit `/looks` → see the look. Open a "Shop" link to confirm `target=_blank` + correct `rel`.
4. Click **Delete this look** on one → it disappears.
5. Save a couple more, click **Delete all my looks** → empty state appears.
6. Sign out → `/looks` redirects to `/login`.

- [ ] **Step 4: Milestone commit**

```bash
git add -A
git commit --allow-empty -m "chore: save-looks milestone complete"
```

## Done criteria

- `saved_looks` + `look-images` exist on the shared project with per-user RLS.
- Logged-in users can Save a generated look (gated by one-time biometric consent), see it in `/looks`, and delete it individually or in bulk.
- Cross-user isolation is integration-tested on both the DB row and the Storage object.
- Build + lint clean.

## Out of scope (later slices)

Auto-purge after inactivity, naming/renaming a saved look, sharing, re-rendering an old look against the latest catalog. (Compliance slice 6 will name the bucket and table in its retention/disclosure copy.)
