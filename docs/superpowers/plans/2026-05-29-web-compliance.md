# Beauty AI Web — Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the website's privacy posture: Privacy/Terms pages, a cookie notice + footer, in-app data export + account deletion, and a documented retention window with an auto-purge mechanism for saved looks.

**Architecture:** Static legal pages + a root-layout footer and cookie notice. Data rights are server route handlers on `/api/account/*`. Retention is a pure `isExpired` helper + a service-role `purgeExpiredLooks` (it deletes Storage objects too, which SQL can't), behind a `CRON_SECRET`-guarded `/api/cron/purge` route triggered by Vercel Cron. Service-role usage is confined to the delete + purge server modules.

**Tech Stack:** Next.js 16 (App Router, TS), `@supabase/ssr` + `@supabase/supabase-js`, Jest, Vercel Cron.

---

## Prerequisites

- Project: `C:\Users\Genti\beauty-ai-web`, branch `feature/web-compliance` (stacked on `feature/web-save-looks`). Work from there; absolute paths.
- Local Supabase stack running + seeded; `saved_looks` + `look-images` exist (from slice 5). Local keys (new format): URL `http://127.0.0.1:54321`, anon `sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH`, service `sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz`.
- Add `CRON_SECRET=local-cron-secret` to `.env.local` (gitignored) for Task 6.

## File structure

```
lib/looks/
  retention.ts        # RETENTION_DAYS + isExpired() + retention.test.ts
  purge.ts            # purgeExpiredLooks() (service-role, server-only)
lib/account/
  export.ts           # buildExportPayload() pure shaper + export.test.ts
app/privacy/page.tsx
app/terms/page.tsx
app/_components/
  site-footer.tsx     # privacy/terms links + affiliate disclosure
  cookie-notice.tsx   # dismissible essential-cookies banner (client)
  data-rights.tsx     # client: Export + Delete-account buttons (used on /account)
app/layout.tsx        # MODIFIED: render footer + cookie notice
app/account/page.tsx  # MODIFIED: render <DataRights/>
app/api/account/export/route.ts
app/api/account/delete/route.ts
app/api/cron/purge/route.ts
vercel.json           # daily cron → /api/cron/purge
tests/integration/purge.test.ts
```

---

## Task 1: Retention helper (TDD)

**Files:** Create `lib/looks/retention.ts`, `lib/looks/retention.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\looks\retention.test.ts`:
```ts
import { isExpired, RETENTION_DAYS } from './retention';

const now = new Date('2026-05-29T00:00:00Z');

describe('isExpired', () => {
  it('is false for a look created today', () => {
    expect(isExpired('2026-05-29T00:00:00Z', now)).toBe(false);
  });
  it('is false just within the window', () => {
    const within = new Date(now.getTime() - (RETENTION_DAYS - 1) * 86400_000).toISOString();
    expect(isExpired(within, now)).toBe(false);
  });
  it('is true past the window', () => {
    const past = new Date(now.getTime() - (RETENTION_DAYS + 1) * 86400_000).toISOString();
    expect(isExpired(past, now)).toBe(true);
  });
  it('honors a custom day count', () => {
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400_000).toISOString();
    expect(isExpired(tenDaysAgo, now, 5)).toBe(true);
    expect(isExpired(tenDaysAgo, now, 30)).toBe(false);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- lib/looks/retention.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\looks\retention.ts`:
```ts
// Saved looks are retained for this many days from creation, then auto-purged.
// Placeholder pending the retention policy decision / attorney input.
export const RETENTION_DAYS = 365;

const DAY_MS = 86400_000;

// True if a look created at `createdAt` is older than `days` relative to `now`.
export function isExpired(createdAt: string, now: Date, days: number = RETENTION_DAYS): boolean {
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return ageMs > days * DAY_MS;
}
```

- [ ] **Step 4: Run GREEN**

Run: `npm test -- lib/looks/retention.test.ts` → PASS (4).

- [ ] **Step 5: Commit**

```bash
git add lib/looks/retention.ts lib/looks/retention.test.ts
git commit -m "feat: retention window + isExpired helper"
```

---

## Task 2: Export payload shaper (TDD)

**Files:** Create `lib/account/export.ts`, `lib/account/export.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\account\export.test.ts`:
```ts
import { buildExportPayload } from './export';

describe('buildExportPayload', () => {
  it('shapes profile + saved looks into the documented JSON, excluding image bytes', () => {
    const profile = { id: 'u1', display_name: 'Ada', saved_looks_consented_at: '2026-05-01T00:00:00Z' };
    const looks = [
      { id: 'l1', image_path: 'u1/l1.png', picks: [{ id: 'p1' }], created_at: '2026-05-02T00:00:00Z' },
    ];
    expect(buildExportPayload(profile, looks)).toEqual({
      profile: { id: 'u1', display_name: 'Ada', saved_looks_consented_at: '2026-05-01T00:00:00Z' },
      savedLooks: [
        { id: 'l1', image_path: 'u1/l1.png', picks: [{ id: 'p1' }], created_at: '2026-05-02T00:00:00Z' },
      ],
    });
  });

  it('handles a null profile and empty looks', () => {
    expect(buildExportPayload(null, [])).toEqual({ profile: null, savedLooks: [] });
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- lib/account/export.test.ts` → FAIL.

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\account\export.ts`:
```ts
export type ExportProfile = {
  id: string;
  display_name: string | null;
  saved_looks_consented_at: string | null;
};

export type ExportLook = {
  id: string;
  image_path: string;
  picks: unknown;
  created_at: string;
};

export type ExportPayload = {
  profile: ExportProfile | null;
  savedLooks: ExportLook[];
};

// Shape a user's data for the export download. Metadata only — never image bytes.
export function buildExportPayload(
  profile: ExportProfile | null,
  looks: ExportLook[],
): ExportPayload {
  return {
    profile: profile
      ? {
          id: profile.id,
          display_name: profile.display_name,
          saved_looks_consented_at: profile.saved_looks_consented_at,
        }
      : null,
    savedLooks: looks.map((l) => ({
      id: l.id,
      image_path: l.image_path,
      picks: l.picks,
      created_at: l.created_at,
    })),
  };
}
```

- [ ] **Step 4: Run GREEN**

Run: `npm test -- lib/account/export.test.ts` → PASS (2).

- [ ] **Step 5: Commit**

```bash
git add lib/account/export.ts lib/account/export.test.ts
git commit -m "feat: data-export payload shaper"
```

---

## Task 3: purgeExpiredLooks (service-role) + integration test

**Files:** Create `lib/looks/purge.ts`, `tests/integration/purge.test.ts`.

- [ ] **Step 1: Implement the purge module**

Create `C:\Users\Genti\beauty-ai-web\lib\looks\purge.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import { isExpired, RETENTION_DAYS } from './retention';

const BUCKET = 'look-images';

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Deletes saved_looks older than RETENTION_DAYS, including their Storage objects.
// Service-role (bypasses RLS) — server/cron only. Returns the number purged.
export async function purgeExpiredLooks(now: Date = new Date()): Promise<number> {
  const supabase = admin();
  const { data, error } = await supabase.from('saved_looks').select('id, image_path, created_at');
  if (error) throw error;

  const expired = (data ?? []).filter((r) =>
    isExpired((r as { created_at: string }).created_at, now, RETENTION_DAYS),
  ) as { id: string; image_path: string }[];
  if (expired.length === 0) return 0;

  const paths = expired.map((r) => r.image_path);
  const ids = expired.map((r) => r.id);

  // Rows first so a transient storage failure can't leave broken records.
  const { error: delError } = await supabase.from('saved_looks').delete().in('id', ids);
  if (delError) throw delError;
  await supabase.storage.from(BUCKET).remove(paths);

  return expired.length;
}
```

- [ ] **Step 2: Write the integration test**

Create `C:\Users\Genti\beauty-ai-web\tests\integration\purge.test.ts`:
```ts
/** @jest-environment node */
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

import { createClient } from '@supabase/supabase-js';
import { purgeExpiredLooks } from '../../lib/looks/purge';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BUCKET = 'look-images';

async function makeUser() {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const email = `purge_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: 'Password123!' });
  if (error) throw error;
  return data.user!.id;
}

describe('purgeExpiredLooks', () => {
  it('deletes expired looks (row + object) and keeps recent ones', async () => {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const userId = await makeUser();

    const oldPath = `${userId}/old.png`;
    const newPath = `${userId}/new.png`;
    const tinyPng = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    await admin.storage.from(BUCKET).upload(oldPath, tinyPng);
    await admin.storage.from(BUCKET).upload(newPath, tinyPng);

    const old = new Date(Date.now() - 400 * 86400_000).toISOString(); // > 365d
    await admin.from('saved_looks').insert([
      { user_id: userId, image_path: oldPath, picks: [], created_at: old },
      { user_id: userId, image_path: newPath, picks: [] }, // created_at defaults to now
    ]);

    const purged = await purgeExpiredLooks();
    expect(purged).toBeGreaterThanOrEqual(1);

    // Old row gone, new row remains.
    const rows = await admin.from('saved_looks').select('image_path').eq('user_id', userId);
    const remaining = (rows.data ?? []).map((r) => (r as { image_path: string }).image_path);
    expect(remaining).toContain(newPath);
    expect(remaining).not.toContain(oldPath);

    // Old object gone, new object remains.
    const listed = await admin.storage.from(BUCKET).list(userId);
    const names = (listed.data ?? []).map((o) => o.name);
    expect(names).toContain('new.png');
    expect(names).not.toContain('old.png');

    // Cleanup.
    await admin.from('saved_looks').delete().eq('user_id', userId);
    await admin.storage.from(BUCKET).remove([newPath]);
  });
});
```

- [ ] **Step 3: Run the integration test**

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
npm test -- tests/integration/purge.test.ts
```
Expected: PASS (1 test). Then `npm run build` to confirm `purge.ts` type-checks.

- [ ] **Step 4: Commit**

```bash
git add lib/looks/purge.ts tests/integration/purge.test.ts
git commit -m "feat: purgeExpiredLooks with retention + integration test"
```

---

## Task 4: Cron purge route + vercel.json

**Files:** Create `app/api/cron/purge/route.ts`, `vercel.json`. Modify `.env.local`.

- [ ] **Step 1: Add the cron secret locally**

Append to `C:\Users\Genti\beauty-ai-web\.env.local` (gitignored):
```
CRON_SECRET=local-cron-secret
```

- [ ] **Step 2: The route**

Create `C:\Users\Genti\beauty-ai-web\app\api\cron\purge\route.ts`:
```ts
import { NextResponse } from 'next/server';
import { purgeExpiredLooks } from '@/lib/looks/purge';

async function handle(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const purged = await purgeExpiredLooks();
    return NextResponse.json({ purged });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'purge failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}
export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
```

- [ ] **Step 3: Vercel cron config**

Create `C:\Users\Genti\beauty-ai-web\vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/purge", "schedule": "0 3 * * *" }
  ]
}
```
(Vercel Cron sends a GET with `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set in the project env. Daily at 03:00 UTC.)

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: `/api/cron/purge` appears as a dynamic route. (No dev server.)

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/purge/route.ts vercel.json
git commit -m "feat: CRON_SECRET-guarded purge route + daily Vercel cron"
```

---

## Task 5: Account export + delete routes

**Files:** Create `app/api/account/export/route.ts`, `app/api/account/delete/route.ts`.

- [ ] **Step 1: Export route**

Create `C:\Users\Genti\beauty-ai-web\app\api\account\export\route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildExportPayload, type ExportLook, type ExportProfile } from '@/lib/account/export';

export async function GET(): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, saved_looks_consented_at')
    .eq('id', user.id)
    .maybeSingle();

  const { data: looks } = await supabase
    .from('saved_looks')
    .select('id, image_path, picks, created_at')
    .order('created_at', { ascending: false });

  const payload = buildExportPayload(
    (profile as ExportProfile | null) ?? null,
    (looks as ExportLook[] | null) ?? [],
  );

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'content-disposition': 'attachment; filename="beauty-ai-data.json"',
    },
  });
}
```

- [ ] **Step 2: Delete route (service-role)**

Create `C:\Users\Genti\beauty-ai-web\app\api\account\delete\route.ts`:
```ts
import { NextResponse } from 'next/server';
import { createClient as createServer } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';

const BUCKET = 'look-images';

export async function POST(): Promise<Response> {
  const supabase = await createServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }
  const admin = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Remove the user's storage objects. Abort before deleting the user if this fails
  //    (avoid orphaned objects whose owner row no longer exists).
  const listed = await admin.storage.from(BUCKET).list(user.id);
  if (listed.error) {
    return NextResponse.json({ error: 'storage cleanup failed' }, { status: 500 });
  }
  const paths = (listed.data ?? []).map((o) => `${user.id}/${o.name}`);
  if (paths.length > 0) {
    const removed = await admin.storage.from(BUCKET).remove(paths);
    if (removed.error) {
      return NextResponse.json({ error: 'storage cleanup failed' }, { status: 500 });
    }
  }

  // 2) Delete the auth user — cascades profiles + saved_looks via FK on delete cascade.
  const del = await admin.auth.admin.deleteUser(user.id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message }, { status: 500 });
  }

  // 3) Clear the session cookie.
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/api/account/export` and `/api/account/delete` appear as dynamic routes.

- [ ] **Step 4: Commit**

```bash
git add app/api/account
git commit -m "feat: account data export + account deletion routes"
```

---

## Task 6: Data-rights UI on /account

**Files:** Create `app/_components/data-rights.tsx`. Modify `app/account/page.tsx`.

- [ ] **Step 1: Data-rights client component**

Create `C:\Users\Genti\beauty-ai-web\app\_components\data-rights.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DataRights() {
  const router = useRouter();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(`Could not delete: ${j.error ?? res.statusText}`);
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error while deleting your account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ display: 'grid', gap: 12, marginTop: 24, borderTop: '1px solid #eee', paddingTop: 16 }}>
      <h2 style={{ fontSize: 18 }}>Your data</h2>

      <a href="/api/account/export" download>
        Export my data (JSON)
      </a>

      <div style={{ display: 'grid', gap: 8 }}>
        <p style={{ margin: 0 }}>
          Delete your account and all saved looks. This cannot be undone. Type{' '}
          <strong>DELETE</strong> to confirm.
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          aria-label="Type DELETE to confirm account deletion"
        />
        <button onClick={deleteAccount} disabled={busy || confirm !== 'DELETE'}>
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render it on /account**

In `C:\Users\Genti\beauty-ai-web\app\account\page.tsx`, add the import after the existing imports:
```tsx
import { DataRights } from '@/app/_components/data-rights';
```
Then render `<DataRights />` just before the closing `</main>` of the page (after the sign-out form).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: `/account` still builds (dynamic).

- [ ] **Step 4: Commit**

```bash
git add app/_components/data-rights.tsx app/account/page.tsx
git commit -m "feat: data-rights UI (export + delete account) on /account"
```

---

## Task 7: Legal pages, footer, cookie notice

**Files:** Create `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/_components/site-footer.tsx`, `app/_components/cookie-notice.tsx`. Modify `app/layout.tsx`.

- [ ] **Step 1: Privacy page**

Create `C:\Users\Genti\beauty-ai-web\app\privacy\page.tsx`:
```tsx
export const metadata = { title: 'Privacy Policy — Beauty AI' };

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 760, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 12 }}>
      <p style={{ background: '#fff3cd', padding: 8, borderRadius: 6, fontSize: 13 }}>
        DRAFT — pending legal review. This text describes how the product is built; it is not final legal advice.
      </p>
      <h1>Privacy Policy</h1>

      <h2>What we collect</h2>
      <p>
        Beauty AI processes a photo you upload entirely in your browser to render makeup try-on
        results. Your original selfie is never uploaded to our servers. If you choose to save a look,
        we store the rendered (makeup-applied) image — which is a biometric image — and the list of
        products in that look.
      </p>

      <h2>Where it is stored</h2>
      <p>
        Saved looks are stored in our database (the <code>saved_looks</code> records) and the rendered
        images in a private, access-controlled storage bucket (<code>look-images</code>), encrypted at
        rest. Each user can access only their own saved looks.
      </p>

      <h2>Consent</h2>
      <p>
        We store a rendered face image only after you give explicit consent the first time you save a
        look. You can withdraw by deleting your saved looks or your account at any time.
      </p>

      <h2>Retention</h2>
      <p>
        Saved looks are retained until you delete them, and are automatically purged after a defined
        retention period of inactivity. Deleting your account removes your profile, saved looks, and
        stored images.
      </p>

      <h2>Your rights</h2>
      <p>
        From your account page you can export your data (a JSON file of your profile and saved-look
        records) and permanently delete your account and all associated data.
      </p>

      <h2>Affiliate links</h2>
      <p>
        Product links may be affiliate links; Beauty AI may earn a commission from purchases made
        through them.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Terms page**

Create `C:\Users\Genti\beauty-ai-web\app\terms\page.tsx`:
```tsx
export const metadata = { title: 'Terms of Service — Beauty AI' };

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: '32px auto', padding: '0 16px', display: 'grid', gap: 12 }}>
      <p style={{ background: '#fff3cd', padding: 8, borderRadius: 6, fontSize: 13 }}>
        DRAFT — pending legal review. This text describes how the product is built; it is not final legal advice.
      </p>
      <h1>Terms of Service</h1>

      <h2>Using Beauty AI</h2>
      <p>
        Beauty AI provides virtual makeup try-on and product recommendations. You must be 18 or older
        to use the service. You are responsible for the photos you choose to upload.
      </p>

      <h2>Recommendations</h2>
      <p>
        Try-on renders and product suggestions are for illustration only and are not a guarantee of how
        a product will look or perform in person.
      </p>

      <h2>Affiliate relationships</h2>
      <p>
        Some product links are affiliate links; we may earn a commission from qualifying purchases at no
        extra cost to you.
      </p>

      <h2>Accounts &amp; termination</h2>
      <p>
        You may delete your account at any time from your account page. We may suspend accounts that
        misuse the service.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Footer**

Create `C:\Users\Genti\beauty-ai-web\app\_components\site-footer.tsx`:
```tsx
import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid #eee', marginTop: 48, padding: '16px', fontSize: 13, color: '#666', display: 'grid', gap: 6, textAlign: 'center' }}>
      <nav style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
      <p style={{ margin: 0 }}>
        Beauty AI may earn a commission from purchases made through links on this site.
      </p>
    </footer>
  );
}
```

- [ ] **Step 4: Cookie notice**

Create `C:\Users\Genti\beauty-ai-web\app\_components\cookie-notice.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';

const KEY = 'cookie-notice-dismissed';

export function CookieNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(localStorage.getItem(KEY) !== '1');
  }, []);

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, background: '#111', color: '#fff',
        padding: 12, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center',
        fontSize: 13, zIndex: 40,
      }}
    >
      <span>
        We use only essential cookies needed to sign you in. We don&apos;t use tracking or analytics
        cookies.
      </span>
      <button
        onClick={() => {
          localStorage.setItem(KEY, '1');
          setShow(false);
        }}
      >
        Got it
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Render footer + notice in the root layout**

In `C:\Users\Genti\beauty-ai-web\app\layout.tsx`, add imports after the existing imports:
```tsx
import { SiteFooter } from '@/app/_components/site-footer';
import { CookieNotice } from '@/app/_components/cookie-notice';
```
Then change the `<body>` to render children plus the footer and notice. Replace the existing `<body>{children}</body>` with:
```tsx
      <body>
        {children}
        <SiteFooter />
        <CookieNotice />
      </body>
```
(If the body has a className, keep it.)

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: `/privacy` + `/terms` appear (static); build clean.

- [ ] **Step 7: Commit**

```bash
git add app/privacy app/terms app/_components/site-footer.tsx app/_components/cookie-notice.tsx app/layout.tsx
git commit -m "feat: privacy/terms pages, site footer, cookie notice"
```

---

## Task 8: Verification pass

- [ ] **Step 1: Unit tests**

Run: `npm test -- --selectProjects unit`
Expected: all unit suites pass (incl. retention: 4, export: 2).

- [ ] **Step 2: Integration tests** (stack running, env vars set as in Task 3)

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
$env:SUPABASE_SERVICE_ROLE_KEY = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
npm test -- --selectProjects integration
```
Expected: catalog-rls, tryon-products, save-looks, purge — all pass.

- [ ] **Step 3: Build + lint**

```powershell
npm run build
npm run lint
```
Expected: build clean (routes: `/privacy`, `/terms`, `/api/account/export`, `/api/account/delete`, `/api/cron/purge` present); lint clean.

- [ ] **Step 4: Manual (HUMAN)**

`npm run dev`, then:
1. Visit `/privacy` and `/terms` → DRAFT banner + content render; footer links work.
2. Cookie notice shows; click **Got it** → it disappears and stays gone on reload.
3. Sign in → `/account` → **Export my data** downloads a JSON; inspect it (profile + saved-look metadata, no image bytes).
4. Create a throwaway account, save a look, then **Delete my account** (type DELETE) → confirm you're signed out and the account/looks are gone.
5. Cron: `curl` with the secret →
   `curl -X POST -H "Authorization: Bearer local-cron-secret" http://localhost:3000/api/cron/purge`
   returns `{ "purged": N }`; without the header returns 401.

- [ ] **Step 5: Milestone commit**

```bash
git add -A
git commit --allow-empty -m "chore: web compliance milestone complete"
```

## Done criteria

- `/privacy` + `/terms` (DRAFT) render; footer + cookie notice site-wide.
- `/account` offers data export (JSON) and account deletion (storage cleanup → admin delete → sign out).
- Saved looks auto-purge past the retention window via a `CRON_SECRET`-guarded route + daily Vercel cron; purge is integration-tested.
- Service-role key is confined to the delete + purge server modules; unit + integration tests pass; build + lint clean.

## Out of scope (later)

Attorney-authored legal copy, vendor DPAs, a full opt-in cookie-consent manager, localized policies, and an image archive in the export.
