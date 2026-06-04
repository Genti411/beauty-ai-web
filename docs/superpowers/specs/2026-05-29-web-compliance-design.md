# Beauty AI Web — Compliance: Design Spec

**Date:** 2026-05-29
**Status:** Approved (pending user review of this document)
**Primary repo:** `beauty-ai-web`. **Also touches:** `beauty-ai` (a small SQL helper
function for purge, optional — see Retention).

## Summary

The compliance slice completes the website's privacy posture: hosted Privacy
Policy + Terms pages, a cookie notice, in-app data rights (export + account
deletion), and a documented retention window with an auto-purge mechanism for
saved looks. It consolidates the affiliate disclosure into a site footer. All
policy text is engineering scaffold marked **"DRAFT — pending attorney review"**;
this slice builds the mechanisms, not legal advice.

## Dependency

Final slice of the web stack: stacks on `feature/web-save-looks` (PR #5), which
stacks on generate → try-on → catalog → merged foundation. Build on
`feature/web-compliance`; PR targets `feature/web-save-looks`.

## Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Legal pages | `/privacy` + `/terms` server-rendered scaffold text, DRAFT-marked |
| 2 | Footer | Root-layout footer: privacy/terms links + consolidated affiliate disclosure |
| 3 | Cookie notice | Dismissible "essential cookies only" banner; dismissal in `localStorage` |
| 4 | Data export | `/api/account/export` → JSON download (profile + saved-look metadata, not images) |
| 5 | Account deletion | `/api/account/delete` → remove storage objects, then service-role `auth.admin.deleteUser` (cascades profile + saved_looks), then sign out |
| 6 | Retention | `RETENTION_DAYS` window keyed on `saved_looks.created_at` |
| 7 | Auto-purge | `purgeExpiredLooks()` (service-role) + `/api/cron/purge` (CRON_SECRET) + Vercel Cron daily |
| 8 | Service role | Used ONLY in the server-side delete + purge routes; never in client bundle |

## Architecture

### Legal pages + footer

- **`app/privacy/page.tsx`**, **`app/terms/page.tsx`** — Server Components,
  public. Privacy text explicitly names: the rendered look image stored as
  biometric data; the `saved_looks` table + the private `look-images` bucket; that
  try-on/analysis runs in-browser and the original selfie is never uploaded; the
  retention window; the consent mechanism; and how to export/delete data. A visible
  **"DRAFT — pending legal review"** banner sits at the top of each.
- **`app/_components/site-footer.tsx`** — links to `/privacy`, `/terms`, and a
  one-line affiliate disclosure ("Beauty AI may earn a commission from purchases
  made through links on this site."). Rendered in `app/layout.tsx`.

### Cookie notice

- **`app/_components/cookie-notice.tsx`** (Client Component) — a dismissible
  bottom banner: "We use only essential cookies needed to sign you in. We don't use
  tracking or analytics cookies." A **Got it** button writes
  `localStorage['cookie-notice-dismissed'] = '1'`; the banner hides when that key
  is set. No server state.

### Data rights (on `/account`)

The existing `/account` page gains a data-rights section with two client buttons.

- **Export:** `GET /api/account/export` (auth required) → builds
  `{ profile, savedLooks }` (saved-look rows: id, picks, created_at, image_path —
  NOT the binary image) and returns it as a downloadable JSON
  (`Content-Disposition: attachment; filename="beauty-ai-data.json"`).
- **Delete account:** a confirm step (the user types `DELETE`) then
  `POST /api/account/delete` (auth required):
  1. List + remove all objects under the user's `look-images/<userId>/` prefix
     (service-role storage client).
  2. `auth.admin.deleteUser(userId)` (service-role) — cascades `profiles` +
     `saved_looks` rows via the existing `on delete cascade` FKs.
  3. Sign the user out (clear the cookie session) and redirect home.

### Retention + auto-purge

- **`lib/looks/retention.ts`** — `RETENTION_DAYS = 365`; pure
  `isExpired(createdAt: string, now: Date, days = RETENTION_DAYS): boolean`.
  Unit-tested.
- **`lib/looks/purge.ts`** — `purgeExpiredLooks(now = new Date())` (service-role,
  server-only): selects `saved_looks` where `created_at < now - RETENTION_DAYS`,
  removes their Storage objects, deletes the rows; returns the count purged.
- **`app/api/cron/purge/route.ts`** — `POST`/`GET` guarded by a
  `CRON_SECRET` (compared against `process.env.CRON_SECRET`, sent as the
  `Authorization: Bearer` header by Vercel Cron). Calls `purgeExpiredLooks()`.
- **`vercel.json`** — a daily cron entry hitting `/api/cron/purge`.
- A SQL-function alternative is intentionally NOT used: purge must also delete
  Storage objects, which a pure SQL function cannot do. The TS function owns both.

## Service-role usage (security)

`SUPABASE_SERVICE_ROLE_KEY` is read ONLY by:
- `app/api/account/delete/route.ts` (admin user deletion + storage cleanup), and
- `lib/looks/purge.ts` (cron purge).

These are server-only modules (route handlers / a module the cron route imports).
They are NEVER imported by a Client Component, and the key has no `NEXT_PUBLIC_`
prefix so it cannot reach the browser bundle. The existing user-facing routes
(`/api/looks`, `/api/looks/consent`) keep using the RLS-scoped user client.

## Data flow (delete account)

1. User opens `/account`, clicks **Delete account**, types `DELETE`, confirms.
2. `POST /api/account/delete`: resolves the user from cookies (must be signed in).
3. Service-role storage client lists `look-images` under `<userId>/` and removes
   the objects.
4. Service-role admin client calls `deleteUser(userId)` → `profiles` + `saved_looks`
   cascade-delete.
5. The route signs the user out and returns success; the client redirects to `/`.

## Error handling

- **Export/delete while unauthenticated:** 401 (and the buttons are only shown to
  signed-in users on `/account`, which is already auth-gated).
- **Delete confirm mismatch:** the button stays disabled until the user types
  `DELETE`.
- **Storage list/remove failure during delete:** surface an error; do NOT call
  `deleteUser` if object cleanup failed (avoid orphaned objects with no owner row).
- **Cron called without/with wrong secret:** 401.
- **Missing `CRON_SECRET` env:** the route returns 503 (misconfiguration) rather
  than running unprotected.

## Testing

- **Unit (pure):**
  - `isExpired(createdAt, now, days)` — true past the window, false within, exact
    boundary handling.
  - The export shaper — given a profile + look rows, returns the documented JSON
    shape (and excludes any binary/image data).
- **Integration (local stack):**
  - `purgeExpiredLooks`: seed two looks (one with an old `created_at`, one recent)
    + their storage objects; run purge; assert only the expired one's row AND
    object are gone, the recent one remains.
  - (Account-delete is exercised manually — it deletes an auth user and is awkward
    to assert in the shared local stack without leaving residue; the storage-cleanup
    + cascade are covered by the existing RLS/cascade tests and a manual check.)
- **Build/lint:** `npm run build`, `npm run lint` clean.
- **Manual (human):** view `/privacy` + `/terms`; dismiss the cookie notice;
  export data (inspect the JSON); delete a throwaway account end-to-end.

## Out of scope (later)

Real legal copy (attorney-authored), GDPR data-processing agreements with vendors,
a full opt-in cookie-consent manager (only needed once non-essential cookies
exist), localized policy variants, and a user-facing "download my images" archive
(export is metadata-only for now).

## Open items to verify before/during build

- Vercel Cron config schema (`crons` in `vercel.json`) and how it sends the
  `Authorization` header — verify against current Vercel docs at build time.
- Whether `auth.admin.deleteUser` on the local stack cascades as expected (verify
  in the manual check).
- Final `RETENTION_DAYS` value (365 is a placeholder pending the retention policy
  decision / attorney input).
