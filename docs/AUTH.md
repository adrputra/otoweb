# Authentication

Status: implemented in Phase 4 (F004). Source of intent: `docs/ROADMAP.md` §46
and `specs/003-authentication/`.

The project uses **Supabase Auth** as the production identity provider. Sessions
are cookie-based and refreshed on the server with `@supabase/ssr`, so every
server-rendered admin request is checked against the provider rather than
trusting client state.

## What exists

| Artifact                      | Purpose                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| `proxy.ts`                    | Next.js 16 request proxy; default-denies `/admin/:path*`           |
| `lib/auth/admin-proxy.ts`     | Testable proxy factory with injected session resolver              |
| `lib/auth/supabase-proxy.ts`  | Edge-safe Supabase resolver; refreshes cookies on the response     |
| `lib/auth/supabase-server.ts` | Request-scoped Supabase backend for actions/routes/components      |
| `lib/auth/server.ts`          | `getCurrentUser()` and `requireAdminUser()`                        |
| `lib/auth/actions.ts`         | Server actions: sign in, sign out, reset request, password update  |
| `lib/auth/service.ts`         | Testable auth orchestration over the `AuthBackend` interface       |
| `lib/auth/session.ts`         | Pure session-validity and fail-closed user resolution              |
| `lib/auth/paths.ts`           | Safe same-origin `/admin` redirects + recovery callback allow-list |
| `app/login/`                  | Sign-in page and client form                                       |
| `app/forgot-password/`        | Password reset request                                             |
| `app/auth/callback/route.ts`  | PKCE code / email OTP exchange                                     |
| `app/reset-password/`         | Recovery-session password update                                   |
| `components/auth/`            | Shared auth shell and form primitives                              |
| `components/admin-shell.tsx`  | Shows the signed-in account and a "Keluar" control                 |
| `tests/unit/auth/`            | Fake backend, session, proxy, flow, and no-registration tests      |
| `tests/e2e/auth.spec.ts`      | Unauthenticated redirect, auth screens, no-registration routes     |

## Routes

| Route                  | Access           | Behavior                                                        |
| ---------------------- | ---------------- | --------------------------------------------------------------- |
| `/login`               | Public           | Sign in; authenticated users redirect to a safe admin `next`    |
| `/forgot-password`     | Public           | Request a reset email; response never reveals account existence |
| `/auth/callback`       | Public           | Exchanges Supabase `code` or `token_hash` for a session         |
| `/reset-password`      | Recovery session | Set a new password; invalid links show a recovery prompt        |
| `/admin/**`            | Authenticated    | Proxy allows verified sessions only; layout guards again        |
| `/register`, `/signup` | —                | Do not exist; requests return 404                               |

## Environment

Set these in `.env.local` for a real Supabase project:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.example` contains placeholders only. Never add a service-role key to the
repository or to `NEXT_PUBLIC_*` variables.

Supabase dashboard → Authentication → URL Configuration:

- Site URL: the deployed origin.
- Redirect URLs: `<origin>/auth/callback`.

`supabase/config.toml` sets the local callback URL, refresh-token rotation, and
`enable_signup = false`. Showroom accounts are created or invited by platform
operators from the Supabase dashboard/Admin API; the application exposes no
self-service registration.

## Session lifecycle

```text
anonymous --valid credentials--> active (HTTP-only Supabase cookies)
active --request--> getUser() verifies the access token
active --token near expiry--> @supabase/ssr refreshes; Set-Cookie on response
active --expired/invalid/revoked--> rejected; admin request redirects to /login
active --Keluar--> signOut(); cookies cleared; redirect to /login
recovery link --callback--> recovery session; /reset-password updates password
```

Key decisions:

- The proxy calls `getUser()` (server-verified) instead of trusting
  `getSession()` or a decoded JWT. Provider/config errors fail closed.
- The admin layout calls `requireAdminUser()` as defense in depth.
- Refreshed cookies and cache headers are attached to both allow and redirect
  responses so token rotation is never lost.
- The login/admin `next` parameter is restricted to `/admin` or `/admin/*`;
  external, protocol-relative, backslash, and non-admin values fall back to
  `/admin`.
- The auth callback additionally allows the exact `/reset-password`
  destination so recovery links land on the reset form. Every other value falls
  back to `/admin`.

## Password reset

1. `/forgot-password` validates the email and calls
   `resetPasswordForEmail(email, { redirectTo: <site>/auth/callback?next=/reset-password })`.
2. The response is generic for known and unknown emails to avoid account
   enumeration.
3. `/auth/callback` exchanges the Supabase code (PKCE) or verifies the email
   OTP (`recovery`), writing session cookies to the redirect response, then
   sends the owner to `/reset-password`.
4. `/reset-password` requires a recovery session, validates 8+ characters and a
   matching confirmation, and calls `updateUser({ password })`.
5. The owner can then sign in with the new password.

Email delivery/SMTP and email templates are Supabase deployment configuration,
not application code.

## No public registration

- No `register`/`signup` route exists in `app/`.
- Supabase `enable_signup` is disabled in the local project config; operators
  create/invite accounts.
- `tests/unit/auth/no-registration.test.ts` walks the route tree and checks the
  auth screens; `tests/e2e/auth.spec.ts` asserts `/register`, `/signup`, and
  `/sign-up` return 404.

## Testing without a live auth service

The environment has no Docker daemon and no Supabase Auth server. Production
code is written against `@supabase/ssr`; verification injects a
`FakeAuthBackend` that implements the same `AuthBackend` interface:

- `tests/unit/auth/session.test.ts` — active, expired, invalid, and throwing
  session lookup.
- `tests/unit/auth/admin-proxy.test.ts` — anonymous redirect with full `next`,
  authenticated allow, fail-closed resolver, expired/invalid rejection,
  refreshed-cookie/header application, safe redirect validation.
- `tests/unit/auth/auth-flow.test.ts` — valid/invalid sign-in, sign-out,
  expired/invalid sessions, reset request callback URL, generic unknown-email
  behavior, password update with/without a session.
- `tests/unit/auth/callback.test.ts` — recovery code/OTP redirect to
  `/reset-password`, safe admin destinations, off-site rejection, exchange
  failures.
- `tests/unit/auth/no-registration.test.ts` — route tree and auth-screen checks.
- `tests/e2e/auth.spec.ts` — real Next.js proxy redirect and 404 checks.

## Validation

```bash
npx tsc --noEmit
npm test
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm visual:qa
```

Visual evidence is written under `.visual-qa/screenshots/` and
`.visual-qa/reports/`.

## Deferred to Phase 5 (F005)

- Tenant membership and role authorization (`platform_admin`/`owner`/`staff`).
- Tenant context resolution and hostname routing.
- Row-level security and tenant-scoped queries.
- Restricting admin access to a specific tenant/owner beyond "valid Supabase
  user".

Phase 4 authenticates identity only. Do not treat authentication as tenant
authorization.
