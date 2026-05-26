# Beauty AI Web — Foundation: Design Spec

**Date:** 2026-05-26
**Status:** Approved (pending user review of this document)
**Repo:** `beauty-ai-web` (separate from the Expo app repo `beauty-ai`)

## Summary

A Next.js website that is a companion to the Beauty AI mobile app. It runs on the
*same* Supabase backend, so accounts and profiles are shared. This first slice —
the **web foundation** — stands up the site, lets users log in with the same
account as the app (email OTP), provides a basic layout and a protected area, and
deploys to Vercel. Later slices add the product catalog, virtual try-on, a
"generate a look" recommender, opt-in saved looks, and the web compliance layer.

## Broader website vision (context for this slice)

The website adds two new capabilities on top of the shared backend:

1. **Virtual makeup try-on** — upload a photo and see products applied to it.
   Powered client-side by MediaPipe FaceLandmarker + canvas shade rendering,
   behind a swappable `TryOnEngine` interface (a licensed AR SDK can replace it
   later). Default flow is ephemeral: the photo stays in the browser and is never
   uploaded.
2. **"Generate a look" recommendation** — one click extracts makeup-relevant
   attributes from the photo *in the browser* (undertone, skin depth, lip/eye
   color), ranks the catalog's try-on-enabled products by **hotness** (trending /
   best-seller, filtered lightly for suitability), applies the top picks per
   category (lipstick, eyeshadow, blush…) via the try-on engine, and shows the
   look plus affiliate buy-links. Only derived, non-identifying attributes ever
   leave the browser — the selfie does not.

Products come from **affiliate/retailer feeds** (lawful, monetizable) normalized
into Supabase `products`, with a curated `tryon_shades` subset carrying shade hex,
face-region mapping, and a `popularity_score` (feed-derived at first, behavior-
derived once there is traffic). FTC affiliate disclosure is shown in the UI.

### Decomposition (each its own spec → plan → build)

1. **Web foundation** (THIS SPEC) — Next.js + shared login + layout + deploy.
2. **Product catalog** — affiliate-feed ingestion, `products` + `tryon_shades`,
   browse/search, affiliate disclosure, buy-links.
3. **Try-on engine** — client-side MediaPipe + canvas rendering behind `TryOnEngine`.
4. **Generate-a-look** — in-browser attribute extraction, hotness-ranked picks,
   multi-product compositing. (Depends on 2 and 3.)
5. **Opt-in save looks** — consent + encrypted upload/storage + gallery.
6. **Web compliance** — privacy policy/ToS, cookie/consent banner, affiliate-
   disclosure consolidation, data rights.

Build order: 1 → 2 → 3 → 4, then 5; 6 woven through and consolidated near the end.
The try-on engine (3) is the biggest technical risk and may be validated early
with a couple of hardcoded shades before the full catalog is built.

## Locked decisions (this slice)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Relationship | Companion to the app; shared Supabase project (shared accounts) |
| 2 | Web framework | Next.js (App Router, TypeScript), deployed to Vercel |
| 3 | Repo | Separate repo `beauty-ai-web` (not a monorepo with the Expo app yet) |
| 4 | Auth | Email OTP via `@supabase/ssr` (cookie-based); Apple web sign-in deferred |
| 5 | Try-on engine | Client-side MediaPipe behind a swappable interface (later slice) |
| 6 | Catalog source | Affiliate/retailer feeds (later slice) |
| 7 | Recommendation | Hotness-ranked, suitability-filtered (later slice) |
| 8 | Photo handling | Ephemeral by default; opt-in encrypted save (later slice) |

## Architecture (web foundation)

- **Next.js App Router (TypeScript).** Server Components for pages; a root
  `middleware.ts` refreshes the Supabase auth cookie on every request and guards
  protected routes.
- **Supabase via `@supabase/ssr`.** Two client factories:
  - a browser client (Client Components) and
  - a server client (Server Components / Route Handlers / middleware) that reads
    and writes the auth cookie.
  Both point at the same Supabase project URL + anon key as the mobile app, so
  accounts are shared. No service-role key in the app.
- **Shared DB types.** A generated `database.types.ts` (from `supabase gen types`)
  for type-safe queries. The foundation uses only the `profiles` type.

### Auth flow (email OTP)

1. User enters email on `/login` → `supabase.auth.signInWithOtp({ email })`.
2. User enters the 6-digit code → `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
3. On success the session is persisted in cookies via `@supabase/ssr`; middleware
   now treats the user as authenticated.
4. Protected routes (`/account`) read the user server-side; unauthenticated access
   redirects to `/login`.
5. Sign-out clears the session cookie and redirects to `/`.

## Routes / components

- **`/` (public landing):** brief intro + link to log in. Renders for everyone.
- **`/login`:** two-stage email → code form (Client Component calling the browser
  Supabase client).
- **`/account` (protected):** Server Component that reads the current user and
  their `profiles` row (RLS-scoped) and greets them; includes a sign-out action.
- **`middleware.ts`:** refreshes the session cookie; redirects unauthenticated
  requests for protected paths to `/login`.
- **`lib/supabase/server.ts` and `lib/supabase/client.ts`:** the two client
  factories. **`lib/auth/email.ts`:** pure `normalizeEmail` / `isValidEmail`
  helpers (ported from the app).

## Data model

No new tables in this slice. It reads the existing shared `profiles` table (RLS:
a user can read only their own row). New tables (`products`, `tryon_shades`,
saved looks) belong to later slices.

## Repo / deployment

- New git repo `beauty-ai-web` (local path `C:\Users\Genti\beauty-ai-web`).
- `.env.local` (gitignored) holds `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `.env.example` is committed.
- For local dev these point at the local Supabase stack
  (`http://127.0.0.1:54321` + local anon key). For production they point at a
  hosted Supabase project (provisioning the hosted project is an open item).
- Deploys to Vercel; the same env vars are configured in the Vercel project.

## Error handling

- Invalid email → inline validation, no request sent.
- OTP send failure / invalid or expired code → friendly error message; user can
  retry or request a new code.
- Network failure → surfaced error with retry.
- Unauthenticated access to a protected route → redirect to `/login`.

## Testing

- **Unit:** `lib/auth/email.ts` (`normalizeEmail`, `isValidEmail`).
- **Integration/route:** middleware auth-gating — an unauthenticated request to
  `/account` redirects to `/login`; an authenticated one is allowed.
- **E2E (optional stretch):** Playwright happy path — log in with email OTP →
  land on `/account` → sign out.

## Out of scope (later slices)

Product catalog, virtual try-on engine, generate-a-look recommendation, opt-in
saved looks, and the full privacy-policy / cookie-consent / affiliate-disclosure
compliance layer. Apple "Sign in with Apple" on web.

## Open items to verify before/during build

- Hosted Supabase project for production (URL + anon key) and its email-OTP
  template configured to send the token code.
- Vercel project setup + environment variables.
- Whether to share the email-helper logic with the app via a package later
  (duplicated for now to keep the repos independent).
