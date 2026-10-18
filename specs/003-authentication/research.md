# Research: Authentication

**Feature**: `003-authentication`  
**Date**: 2026-10-18

## Decisions

### D1 — Supabase Auth with `@supabase/ssr` cookie sessions

**Decision**: Use Supabase Auth as the identity provider and `@supabase/ssr`'s
`createServerClient` to persist the access/refresh token pair in HTTP-only
cookies. Create a fresh client per request in the proxy, server actions, and
route handlers.

**Rationale**: The roadmap names Supabase Auth. `@supabase/ssr` is the supported
way to use Supabase Auth with Next.js App Router server rendering; it handles
cookie encoding, token refresh, and the `setAll(cookies, headers)` contract
needed to write refreshed cookies back to the response.

**Alternatives considered**:
- `@supabase/supabase-js` plus a hand-written cookie storage adapter: more code,
  easier to get refresh/cookie semantics wrong.
- Client-only auth with localStorage: does not protect server-rendered admin
  routes and cannot refresh sessions safely.
- NextAuth/Auth.js: adds a second auth framework; the roadmap specifies Supabase
  Auth.

### D2 — Next.js 16 `proxy.ts` instead of `middleware.ts`

**Decision**: Add a root-level `proxy.ts` exporting `proxy` and a `config`
matcher of `/admin/:path*`. Keep the decision logic in
`lib/auth/admin-proxy.ts` as a factory that accepts an injected auth resolver.

**Rationale**: Next.js 16 renames the request-interception convention to
`proxy.ts` (`PROXY_FILENAME = 'proxy'`). The matcher limits auth work to the
admin tree so public pages are unaffected. The factory makes the exact
production logic testable with fake sessions without booting Next.

**Alternatives considered**:
- `middleware.ts`: deprecated in Next.js 16.
- Per-page checks only: easy to miss a route; the proxy is the default-deny
  boundary.
- Edge config in `next.config.mjs`: cannot perform server-verified user lookup.

### D3 — Server-verified user lookup, fail closed

**Decision**: Call `supabase.auth.getUser()` in the proxy and server guard. Treat
any error, missing user, expired token, or missing configuration as
unauthenticated. Redirect to `/login` with a validated `next` parameter.

**Rationale**: `getSession()` trusts a cookie that can be tampered with;
`getUser()` validates the access token with Supabase Auth and refreshes it when
possible. Failing closed prevents a misconfigured environment from exposing
admin content.

**Alternatives considered**:
- Decode the JWT locally without verification: insecure.
- Trust a client-side auth state: does not protect server routes.

### D4 — Injectable `AuthBackend` for executable verification

**Decision**: Define `AuthBackend` with `getUser`, `signInWithPassword`,
`signOut`, `requestPasswordReset`, and `updatePassword`. Production implements it
with `@supabase/ssr`; tests implement `FakeAuthBackend` with configurable users,
session expiry, and failure modes.

**Rationale**: The environment has no Docker daemon and no live Supabase Auth
server. The fake exercises the same service, session, and proxy code paths,
proving login, logout, reset, expiry, and invalid-session behavior without
fabricating a live service.

**Alternatives considered**:
- Mock `@supabase/supabase-js` module functions: brittle and does not exercise
  the orchestration or session helpers.
- Skip auth behavior tests and rely on manual checks: violates the evidence
  rules.

### D5 — Four public auth routes and one callback

**Decision**: `/login` (sign-in), `/forgot-password` (request reset),
`/reset-password` (set a new password with a recovery session), and
`/auth/callback` (exchange a Supabase code or token hash for a session). No
`/register` or `/signup` route.

**Rationale**: These are the minimum routes for the roadmap's login, logout, and
password reset requirements. Keeping the callback separate from the pages makes
the Supabase redirect URL explicit and testable.

**Alternatives considered**:
- `/admin/login`: couples a public auth screen to the protected tree and
  complicates the matcher.
- Reset form on the login page: no recovery-session boundary.

### D6 — Safe redirects restricted to admin paths

**Decision**: `safeNextPath` accepts only same-origin paths that are exactly
`/admin` or start with `/admin/`; it rejects absolute URLs, protocol-relative
URLs, backslashes, and control characters. Anything else falls back to `/admin`.

**Rationale**: The `next` parameter is attacker-controlled. Restricting it to
admin paths prevents open redirects and avoids sending users to unrelated
destinations after login.

**Alternatives considered**:
- Allow any relative path: still an open-redirect risk through protocol-relative
  values and ambiguous parsing.
- No `next` parameter: poor UX; users lose their place.

### D7 — Password reset without account enumeration

**Decision**: `/forgot-password` always returns the same success message after a
valid email submission, regardless of whether the account exists. It calls
`resetPasswordForEmail(email, { redirectTo: <site>/auth/callback?next=/reset-password })`.
The callback supports both PKCE `code` and `token_hash`/`type` flows.
`/reset-password` requires a recovery session.

**Rationale**: Revealing whether an email is registered leaks account existence.
Supporting both callback shapes keeps the flow compatible with Supabase's
current and legacy email templates.

**Alternatives considered**:
- Return "email not found": account enumeration.
- Token in a URL fragment handled client-side only: weaker and harder to verify.

### D8 — Preserve the incumbent visual system

**Decision**: Build auth screens from the existing neutral/amber palette, Plus
Jakarta Sans headings, Inter body, and the admin's square, restrained control
language. Use a split dark brand panel plus a white form panel on desktop, and a
stacked layout on mobile. Add only the identity and sign-out control to the
existing admin shell.

**Rationale**: The feature is an extension of an existing Operate surface, not a
redesign. The login page must feel like the same product while remaining a
focused, accessible form.

**Alternatives considered**:
- Redesign the admin shell: out of scope and risks the approved visual baseline.
- A generic centered card: less consistent with the showroom's editorial tone.

### D9 — Visual QA capture without a live auth service

**Decision**: A Playwright capture script starts the app, opens `/login`,
`/forgot-password`, and `/reset-password`, and captures desktop (1440×900) and
mobile (390×844) screenshots into `.visual-qa/screenshots/`. It also runs the
Impeccable detector over the changed auth UI and writes the report under
`.visual-qa/reports/`.

**Rationale**: The auth screens render without Supabase env, so visual QA does
not need a live Auth service. The admin page redirect is captured through the
login screen it lands on.

**Alternatives considered**:
- Screenshot only desktop: misses the mobile composition the spec requires.
- Skip visual QA because the feature is mostly logic: the feature is UI-touching
  and the spec requires it.

## Open questions

None. The roadmap specifies Supabase Auth and the scope boundaries. Tenant roles
and RLS are explicitly deferred to F005; Phase 4 authenticates identity only.
