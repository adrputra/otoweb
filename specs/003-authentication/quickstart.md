# Quickstart: Authentication

**Feature**: `003-authentication`

## Prerequisites

- Node.js 24 and pnpm 12.3.4.
- Dependencies installed: `pnpm install`.
- For a real Supabase flow: a Supabase project with email/password auth enabled
  and these values in `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SITE_URL` (for example `http://localhost:3000`)

No Docker, local PostgreSQL, or Supabase CLI is required for the automated
verification.

## Automated verification (no live auth server)

```bash
# Unit/contract tests, including the fake auth backend
pnpm test

# Focused auth suite
pnpm exec vitest run tests/unit/auth

# Type and lint gates
pnpm typecheck
pnpm lint

# Browser checks: unauthenticated /admin redirect + no /register route
pnpm test:e2e

# Production build
pnpm build
```

Expected outcomes:

- `pnpm test` passes and includes the auth session, proxy, flow, and
  no-registration tests.
- `pnpm test:e2e` passes `/admin` redirect, login-page rendering, and `/register`
  404 checks.
- `pnpm typecheck`, `pnpm lint`, and `pnpm build` exit 0.

## Manual verification

1. Start the app: `pnpm dev`.
2. Visit `http://localhost:3000/admin` in a private window.
   - Expected: redirect to `/login?next=%2Fadmin` (or `/login?next=/admin`).
3. Confirm `/login` shows email and password fields, a "Lupa kata sandi?" link,
   and no registration link.
4. Sign in with a Supabase user created by a platform operator.
   - Expected: redirect to `/admin`; the admin shell shows the account and a
     "Keluar" control.
5. Select "Keluar".
   - Expected: redirect to `/login`; visiting `/admin` redirects again.
6. Visit `/forgot-password`, submit the account email, and follow the emailed
   link.
   - Expected: `/auth/callback` establishes a recovery session and redirects to
     `/reset-password`.
7. Set a new password (minimum 8 characters, matching confirmation).
   - Expected: password update succeeds and the new password can sign in.
8. Visit `/register` and `/signup`.
   - Expected: 404. There is no public registration.

## Environment / deployment notes

- Supabase dashboard → Authentication → URL Configuration: set the Site URL to
  the deployed origin and add `<origin>/auth/callback` to the redirect allow
  list.
- Account creation stays in the Supabase dashboard/Admin API. The application
  exposes no sign-up route.
- Session lifetime and refresh rotation are Supabase project settings. The
  application rejects expired or invalid sessions on every admin request.
- Never place a service-role key in `NEXT_PUBLIC_*` variables or the repository.

## Visual QA

```bash
# Starts the dev server, captures desktop/mobile auth screens, writes report
pnpm visual:qa
```

Evidence is written under `.visual-qa/screenshots/` and `.visual-qa/reports/`.
