# Beauty AI Web — Opt-in Save Looks: Design Spec

**Date:** 2026-05-28
**Status:** Approved (pending user review of this document)
**Primary repo:** `beauty-ai-web` (UI + data access). **Also touches:** `beauty-ai`
(shared Supabase migration for the new table + Storage bucket policies).

## Summary

Opt-in **Save look** persists a user's generated look on the shared Supabase
backend. Storage is biometric-sensitive (the saved image is a rendered face),
so this slice is gated behind explicit consent, the data is isolated per-user
by Row Level Security on both the database row and the Storage object, and the
original selfie is **never uploaded**. Users can view, share via affiliate
links, and delete saved looks (individually or all at once) on a new auth-gated
`/looks` page.

## Dependency

Stacks on `feature/web-generate` (which stacks on `feature/web-tryon`, etc.).
Build on `feature/web-save-looks`; PR targets `feature/web-generate` (or `main`
once the chain merges).

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | What's stored | Rendered result image + picks metadata. No original selfie. |
| 2 | Storage | Private Supabase Storage bucket `look-images`; encrypted at rest |
| 3 | Isolation | RLS on `saved_looks` AND Storage policy keyed to `<user_id>/...` prefix |
| 4 | Consent | One-time biometric consent modal on first save; `profiles.saved_looks_consented_at` records timestamp |
| 5 | Auth | Saving + `/looks` require sign-in. `/try-on` itself stays public |
| 6 | Schema location | Migration in mobile repo `beauty-ai/supabase/migrations` |
| 7 | Out: auto-purge | Deferred to compliance slice (6) |

## Architecture

### Shared DB (migration in mobile repo)

- **`saved_looks`** table
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `image_path text not null` (the Storage object key)
  - `picks jsonb not null` (the products applied — frozen at save time)
  - `created_at timestamptz not null default now()`
  - Index on `(user_id, created_at desc)`.
- **RLS** enabled. Policies (NO `update`):
  - `saved_looks_select_own` (`select` using `auth.uid() = user_id`)
  - `saved_looks_insert_own` (`insert` with check `auth.uid() = user_id`)
  - `saved_looks_delete_own` (`delete` using `auth.uid() = user_id`)
- **`profiles`** gains `saved_looks_consented_at timestamptz` (nullable).
- **Storage bucket `look-images`** (private). Storage policies allow read /
  insert / delete on `storage.objects` only when the first path segment equals
  the authenticated user's id (`(storage.foldername(name))[1] = auth.uid()::text`).

### Web (this repo)

- **Middleware** adds `/looks` to the protected-prefix list (the existing
  `shouldRedirectToLogin` helper).
- **`lib/looks/path.ts`** — `pathFor(userId, lookId): string` → `'<userId>/<lookId>.png'`.
  Pure, unit-tested.
- **`lib/looks/picks.ts`** — `serializePicks(picks: TryOnProduct[]): SavedPicks[]`.
  Returns a minimal projection: `{ id, brand, name, category, shade, buyUrl }`.
  Pure, unit-tested.
- **`lib/looks/looks.ts`** — server-side data access via `@/lib/supabase/server`:
  - `saveLook({ userId, blob, picks })` — uploads to `look-images`, inserts a row.
  - `getSavedLooks()` — returns `SavedLook[]` with a short-lived signed URL per
    `image_path`.
  - `deleteSavedLook(lookId)` — deletes both the Storage object and the row.
  - `deleteAllSavedLooks()` — bulk delete.
- **`lib/profile/consent.ts`** — `hasSavedLooksConsent(userId): boolean`,
  `recordSavedLooksConsent(userId)`.
- **`/try-on` UI changes (TryOnStudio):**
  - When `picks` is set AND user is signed in, render a **Save look** button.
    The studio receives the signed-in user's id + their consent timestamp as
    props from the server `page.tsx`.
  - First click → consent modal (text below). On confirm: record consent,
    then call a `/api/looks` POST (Route Handler) that runs `saveLook(...)`.
    Subsequent clicks skip the modal.
- **`/looks` page (Server Component, protected):**
  - Loads `getSavedLooks()` and renders a grid: image (signed URL), creation
    date, picks list with affiliate Shop links (`rel="sponsored nofollow noopener"`),
    a per-look **Delete** button (server action), and a **Delete all my looks**
    button at the top (server action).
  - Empty state: a friendly "No saved looks yet" message linking to `/try-on`.

### Consent modal text (verbatim baseline; tunable)

> **Save this look?**
> We'll keep the makeup-applied photo (a biometric image) and your selected
> products on Beauty AI's encrypted storage so you can come back to this look.
> Your original selfie is never uploaded. You can delete any saved look — or
> all of them — at any time from the *Your looks* page.

A required checkbox: **I consent to Beauty AI storing this rendered face image
as biometric data, encrypted, until I delete it.** Buttons: **Save** (disabled
until checked) / **Cancel**.

## Data flow

1. User generates a look on `/try-on` (existing flow).
2. Clicks **Save look**.
3. If `profiles.saved_looks_consented_at` is null → consent modal; on confirm
   `POST /api/looks/consent` records `saved_looks_consented_at = now()`.
4. Studio uploads the result blob: `POST /api/looks` with multipart
   (`blob`, `picksJson`). The route handler:
   1. Resolves the current `user_id` server-side from cookies.
   2. Generates `lookId = uuid`; computes `imagePath = pathFor(userId, lookId)`.
   3. Uploads the blob to bucket `look-images` at `imagePath` (service-role
      client is NOT used — the *user's* server client uploads via Storage
      RLS so the user-prefix policy verifies).
   4. Inserts `saved_looks` row.
5. `/looks` lists looks newest-first; each card requests a signed URL
   (short TTL, e.g. 1 hour) via `supabase.storage.from('look-images').createSignedUrl(...)`.
6. Per-look Delete (server action): removes the row, then deletes the Storage
   object. Delete-all: same, scoped to the user's prefix.

## Error handling

- **No picks / no photo**: Save button is hidden.
- **Not signed in**: Save button is hidden (use `Sign in to save` link
  instead).
- **Consent not granted**: clicking Save opens the modal; cancelling does
  nothing.
- **Upload failure**: friendly error, no DB row inserted (the row insert
  happens only after a successful upload).
- **Delete: object exists, row missing (or vice versa)**: best-effort cleanup
  — both operations are attempted; the user-visible result is "removed".

## Testing

- **Unit (pure):**
  - `pathFor(userId, lookId)` — deterministic, includes both segments,
    extension `.png`.
  - `serializePicks(picks)` — returns the minimal projection, drops any
    surprise fields, preserves order.
  - `hasSavedLooksConsent(profile)` — boolean from a profile row's timestamp.
- **Integration (local Supabase stack):**
  - RLS isolation on `saved_looks`: user A can insert/select/delete own rows;
    user A cannot select, insert, or delete user B's rows.
  - Storage isolation on `look-images`: user A can upload/list/delete an
    object under `<userA>/...`; user A cannot upload/list/delete under
    `<userB>/...`.
- **Build/lint:** `npm run build`, `npm run lint` clean.
- **Manual (human):** end-to-end on the local stack — sign in, generate a
  look, Save → consent → confirm; visit `/looks`; delete one; delete all.

## Compliance notes

- This slice extends the existing biometric posture: consent before storage,
  encryption at rest, in-app delete, data minimization (no original selfie).
- The retention policy text we publish (compliance slice 6) will name
  `saved_looks` and the `look-images` bucket explicitly.
- This spec is engineering scaffolding for compliance — not a legal review.

## Out of scope (later)

Auto-purge after inactivity (slice 6 — compliance), naming/renaming a look,
sharing a look (public URL), re-rendering a saved look against the latest
catalog, undertone/suitability filtering.

## Open items to verify before/during build

- Exact Supabase Storage policy syntax for `storage.objects` with a
  user-prefix predicate (verify against the running CLI version when writing
  the migration).
- Whether `saveLook` should use a Route Handler (`POST /api/looks`) or a
  Server Action — pick Route Handler in the plan for clean multipart upload
  semantics, but flag if Server Actions simplify.
