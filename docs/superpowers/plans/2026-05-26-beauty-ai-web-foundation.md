# Beauty AI Web — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Beauty AI website: a Next.js app on the *shared* Supabase backend where a user logs in with the same account as the mobile app (email OTP), with a public landing page, a protected `/account` page, and middleware-based route protection.

**Architecture:** Next.js App Router (TypeScript). Auth uses `@supabase/ssr` with cookie-based sessions: a browser client for Client Components, an async server client for Server Components, and a `middleware.ts` that refreshes the session cookie and redirects unauthenticated users away from protected routes. The Supabase client points at the same project URL + anon key as the mobile app, so accounts are shared. The route-guard decision is a pure function for easy testing.

**Tech Stack:** Next.js (App Router) + TypeScript, `@supabase/ssr`, `@supabase/supabase-js`, Jest via `next/jest` + `@testing-library`, deploys to Vercel.

---

## Prerequisites / environment

- OS: Windows 11. Node v20.18.0, npm.
- The repo `C:\Users\Genti\beauty-ai-web` already exists with `.git` (branch `main`) and a `docs/` folder holding the spec + this plan. Do NOT re-init git; commit into it.
- **The shared local Supabase stack must be running** for auth to work. It is started from the *mobile* repo: `cd C:\Users\Genti\beauty-ai && npx supabase start` (needs Docker). The web app talks to the same local project at `http://127.0.0.1:54321`.
- Local credentials (same project as the app):
  - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`

## File structure (created by this plan)

```
beauty-ai-web/
  app/
    layout.tsx                  # (from scaffold; kept)
    page.tsx                    # public landing (replaced)
    login/page.tsx              # email-OTP login (Client Component)
    account/page.tsx            # protected; reads user + profile; sign-out
  lib/
    auth/
      email.ts                  # pure normalizeEmail/isValidEmail
      email.test.ts
      guard.ts                  # pure shouldRedirectToLogin()
      guard.test.ts
    supabase/
      client.ts                 # createBrowserClient factory
      server.ts                 # createServerClient (async, cookies)
      middleware.ts             # updateSession() session refresh + guard
  middleware.ts                 # Next.js middleware entry → updateSession
  .env.local                    # gitignored; real local values
  .env.example                  # committed
  jest.config.js
```

`@/*` resolves to the project root (set by create-next-app `--import-alias "@/*"`), so imports look like `@/lib/auth/email`.

---

## Task 1: Scaffold Next.js into the existing repo

**Files:** the Next.js template (package.json, app/, tsconfig, etc.)

- [ ] **Step 1: Scaffold into a sibling temp dir**

Run (PowerShell, from `C:\Users\Genti`):
```powershell
npx create-next-app@latest beauty-ai-web-tmp --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-npm --yes
```
`--yes` makes it non-interactive (accepts defaults for anything not flagged, including the Turbopack prompt). Expected: a runnable Next.js App Router app in `C:\Users\Genti\beauty-ai-web-tmp`.

- [ ] **Step 2: Merge into the project, preserving .git and docs**

Run (PowerShell):
```powershell
robocopy "C:\Users\Genti\beauty-ai-web-tmp" "C:\Users\Genti\beauty-ai-web" /E /XD .git
Remove-Item -Recurse -Force "C:\Users\Genti\beauty-ai-web-tmp"
```
NOTE: robocopy exits with code 1 (or other small codes) on SUCCESS — do not treat that as failure. Verify `C:\Users\Genti\beauty-ai-web\package.json` and `app\` now exist.

- [ ] **Step 3: Install and verify it builds**

Run (from `C:\Users\Genti\beauty-ai-web`):
```powershell
npm install
npm run build
```
Expected: `npm run build` completes with "Compiled successfully" (Next type-checks + builds). Stop if it errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js App Router app"
```

---

## Task 2: Install Supabase + testing dependencies and configure Jest

**Files:**
- Modify: `package.json`
- Create: `jest.config.ts`

- [ ] **Step 1: Install Supabase packages**

Run:
```powershell
npm install @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Install test dependencies**

Run:
```powershell
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @types/jest
```

- [ ] **Step 3: Create the Jest config (uses next/jest so the `@/*` alias and TS just work)**

Use a CommonJS `.js` config (a `.ts` config would require installing `ts-node`). Create `C:\Users\Genti\beauty-ai-web\jest.config.js`:
```js
const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
};

module.exports = createJestConfig(config);
```

Add a `"test": "jest"` entry to `package.json` `"scripts"` (keep existing scripts).

- [ ] **Step 4: Verify the runner starts**

Run:
```powershell
npm test -- --passWithNoTests
```
Expected: Jest runs and reports no tests found, exiting 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: add supabase and jest dependencies"
```

---

## Task 3: Environment config and Supabase client factories

**Files:**
- Create: `.env.example`, `.env.local`
- Modify: `.gitignore`
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`

- [ ] **Step 1: Env files**

Create `C:\Users\Genti\beauty-ai-web\.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

Create `C:\Users\Genti\beauty-ai-web\.env.local` with the real local values:
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdWJhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```
WARNING: that anon key MUST equal the one in the Prerequisites section above — copy it from there exactly.

The Next.js template `.gitignore` already ignores `.env*` (which covers `.env.local`). Confirm it does. Then make sure `.env.example` is NOT ignored — if the template uses a broad `.env*` pattern, add an explicit un-ignore line `!.env.example` to `.gitignore` so the example is committed.

- [ ] **Step 2: Browser client**

Create `C:\Users\Genti\beauty-ai-web\lib\supabase\client.ts`:
```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Server client**

Create `C:\Users\Genti\beauty-ai-web\lib\supabase\server.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore because the
            // middleware refreshes the session cookie.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Verify build still passes**

Run:
```powershell
npm run build
```
Expected: compiles successfully.

- [ ] **Step 5: Commit**

```bash
git add .env.example .gitignore lib/supabase/client.ts lib/supabase/server.ts
git commit -m "feat: supabase browser and server client factories"
```
Before committing, run `git status` and CONFIRM `.env.local` is NOT staged.

---

## Task 4: Email helpers (TDD)

**Files:**
- Create: `lib/auth/email.ts`
- Test: `lib/auth/email.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\auth\email.test.ts`:
```ts
import { normalizeEmail, isValidEmail } from './email';

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });
  it('rejects an address with no @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });
  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```powershell
npm test -- lib/auth/email.test.ts
```
Expected: FAIL — "Cannot find module './email'".

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\auth\email.ts`:
```ts
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  const email = normalizeEmail(input);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```powershell
npm test -- lib/auth/email.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/email.ts lib/auth/email.test.ts
git commit -m "feat: email normalize/validate helpers"
```

---

## Task 5: Route-guard decision (TDD)

A pure function that decides whether an unauthenticated request should be redirected to login. Extracted from the middleware so it's testable without mocking `NextRequest`.

**Files:**
- Create: `lib/auth/guard.ts`
- Test: `lib/auth/guard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `C:\Users\Genti\beauty-ai-web\lib\auth\guard.test.ts`:
```ts
import { shouldRedirectToLogin } from './guard';

describe('shouldRedirectToLogin', () => {
  it('redirects an unauthenticated user from a protected route', () => {
    expect(shouldRedirectToLogin('/account', false)).toBe(true);
  });
  it('redirects from a nested protected route', () => {
    expect(shouldRedirectToLogin('/account/settings', false)).toBe(true);
  });
  it('does not redirect an authenticated user from a protected route', () => {
    expect(shouldRedirectToLogin('/account', true)).toBe(false);
  });
  it('does not redirect on the public landing page', () => {
    expect(shouldRedirectToLogin('/', false)).toBe(false);
  });
  it('does not redirect on the login page', () => {
    expect(shouldRedirectToLogin('/login', false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```powershell
npm test -- lib/auth/guard.test.ts
```
Expected: FAIL — "Cannot find module './guard'".

- [ ] **Step 3: Implement**

Create `C:\Users\Genti\beauty-ai-web\lib\auth\guard.ts`:
```ts
const PROTECTED_PREFIXES = ['/account'];

export function shouldRedirectToLogin(pathname: string, isAuthenticated: boolean): boolean {
  if (isAuthenticated) return false;
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```powershell
npm test -- lib/auth/guard.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/guard.ts lib/auth/guard.test.ts
git commit -m "feat: route-guard decision helper"
```

---

## Task 6: Session-refresh middleware

**Files:**
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts` (project root)

- [ ] **Step 1: Create updateSession**

Create `C:\Users\Genti\beauty-ai-web\lib\supabase\middleware.ts`:
```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { shouldRedirectToLogin } from '@/lib/auth/guard';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: do not run code between createServerClient and getUser(), and do
  // not remove getUser() — it refreshes the session and prevents random logouts.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (shouldRedirectToLogin(request.nextUrl.pathname, !!user)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Create the middleware entry**

Create `C:\Users\Genti\beauty-ai-web\middleware.ts`:
```ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 3: Verify build passes**

Run:
```powershell
npm run build
```
Expected: compiles successfully (the unit suite already covers the guard logic).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/middleware.ts middleware.ts
git commit -m "feat: session-refresh middleware with route guard"
```

---

## Task 7: Login page (email OTP)

**Files:**
- Create: `app/login/page.tsx`

- [ ] **Step 1: Implement the login page**

Create `C:\Users\Genti\beauty-ai-web\app\login\page.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { normalizeEmail, isValidEmail } from '@/lib/auth/email';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const clean = normalizeEmail(email);
    if (!isValidEmail(clean)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: clean });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStage('code');
  }

  async function verifyCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.trim(),
      type: 'email',
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push('/account');
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 360, margin: '64px auto', display: 'grid', gap: 12 }}>
      <h1>Log in to Beauty AI</h1>
      {stage === 'email' ? (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button onClick={sendCode} disabled={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </button>
        </>
      ) : (
        <>
          <p>Enter the 6-digit code sent to {normalizeEmail(email)}</p>
          <input
            inputMode="numeric"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button onClick={verifyCode} disabled={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run:
```powershell
npm run build
```
Expected: compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "feat: email OTP login page"
```

---

## Task 8: Protected account page + sign-out

**Files:**
- Create: `app/account/page.tsx`

- [ ] **Step 1: Implement the account page (Server Component) with a sign-out server action**

Create `C:\Users\Genti\beauty-ai-web\app\account\page.tsx`:
```tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();

  async function signOut() {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  }

  const displayName = (profile as { display_name: string | null } | null)?.display_name;

  return (
    <main style={{ maxWidth: 480, margin: '64px auto', display: 'grid', gap: 12 }}>
      <h1>Welcome{displayName ? `, ${displayName}` : ''}</h1>
      <p style={{ color: '#666' }}>{user.email}</p>
      <form action={signOut}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run:
```powershell
npm run build
```
Expected: compiles successfully. `/account` is treated as a dynamic route (it reads cookies), which is correct.

- [ ] **Step 3: Commit**

```bash
git add app/account/page.tsx
git commit -m "feat: protected account page with sign-out"
```

---

## Task 9: Public landing page

**Files:**
- Modify: `app/page.tsx` (replace the scaffold default)

- [ ] **Step 1: Replace the landing page**

Replace the entire contents of `C:\Users\Genti\beauty-ai-web\app\page.tsx` with:
```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 560, margin: '96px auto', display: 'grid', gap: 16 }}>
      <h1>Beauty AI</h1>
      <p>Try on makeup looks and get personalized recommendations.</p>
      <Link href="/login">Log in</Link>
    </main>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run:
```powershell
npm run build
```
Expected: compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: public landing page"
```

---

## Task 10: Full verification pass

- [ ] **Step 1: Run the test suite**

Run:
```powershell
npm test
```
Expected: all suites pass (email: 4, guard: 5).

- [ ] **Step 2: Production build**

Run:
```powershell
npm run build
```
Expected: "Compiled successfully", with routes `/`, `/login` (static) and `/account` (dynamic) listed.

- [ ] **Step 3: Lint**

Run:
```powershell
npm run lint
```
Expected: no errors (warnings acceptable).

- [ ] **Step 4: Manual smoke test (deferred to a human — requires the local Supabase stack running and a browser)**

With `npx supabase start` running in the mobile repo:
```powershell
npm run dev
```
Then in a browser:
1. Visit `/` → landing page renders (public).
2. Visit `/account` while logged out → redirected to `/login`.
3. On `/login`, enter your email → "Send code" → read the 6-digit code from the local Inbucket mailbox (URL printed by `supabase start`) → enter it → "Verify".
4. Land on `/account`, see your email → "Sign out" → returned to `/`.

- [ ] **Step 5: Milestone commit**

```bash
git add -A
git commit --allow-empty -m "chore: web foundation milestone complete"
```

---

## Done criteria

- The website builds (`npm run build`) and lints cleanly.
- Unit tests pass (email helpers + route-guard decision).
- Logged-out access to `/account` redirects to `/login`; email-OTP login (shared account with the app) lands on `/account` showing the user; sign-out returns to `/`.

## Out of scope (later slices)

Product catalog, virtual try-on engine, generate-a-look recommendation, opt-in saved looks, the full privacy/cookie/affiliate-disclosure compliance layer, Apple "Sign in with Apple" on web, generated `database.types.ts`, and production hosted-Supabase + Vercel deployment.
