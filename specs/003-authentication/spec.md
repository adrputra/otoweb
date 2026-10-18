# Feature Specification: Authentication

**Feature Branch**: `003-authentication`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Authentication: implement Supabase Auth for the OtoWeb admin surface. Required components: email/password login, logout, password reset, authenticated admin routes, session handling, and an auth callback route. Do not implement public registration; showroom accounts are created/invited by platform operators. Acceptance: unauthenticated admin access is blocked; an authenticated owner can access admin; logout works; expired or invalid sessions are rejected; no registration route exists. Exclude multi-tenant enforcement/RLS, admin CRUD, and public registration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and reach the admin surface (Priority: P1)

A showroom owner with an account created by a platform operator visits the
admin surface, is sent to a sign-in page because they are not authenticated,
enters their email and password, and lands on the admin dashboard. The session
is then carried across requests by secure cookies.

**Why this priority**: Every later admin capability depends on knowing who is
making the request. Until the admin surface is closed to anonymous visitors and
open to a valid signed-in user, the product cannot be operated safely.

**Independent Test**: With authentication configured (or a controlled fake auth
backend in tests), request `/admin` without a session and observe a redirect to
`/login` with the requested path preserved; sign in with valid credentials and
observe the admin dashboard; repeat a request with the resulting session and
observe it is allowed.

**Acceptance Scenarios**:

1. **Given** no authenticated session, **When** a visitor requests `/admin` or
   any nested admin route, **Then** the request is redirected to `/login` and
   the original path is preserved as a safe `next` parameter.
2. **Given** a valid account and correct credentials, **When** the owner submits
   the sign-in form, **Then** a session is established and the owner is taken to
   the requested admin page (or `/admin` when no safe destination is given).
3. **Given** a valid session, **When** the owner requests an admin route,
   **Then** the admin page renders and identifies the signed-in account.
4. **Given** invalid credentials, **When** the sign-in form is submitted,
   **Then** a clear, non-enumerating error is shown, no session is created, and
   the admin surface remains inaccessible.

---

### User Story 2 - End a session and survive expiry (Priority: P2)

A signed-in owner can sign out from the admin shell. Signing out clears the
session, and any later admin request is redirected to sign-in. Separately, if a
session has expired or been invalidated remotely, the next admin request is
treated as unauthenticated rather than trusting stale client state.

**Why this priority**: A login that cannot be ended, or that keeps working after
expiry, is a security defect. Logout and expiry handling are required for the
roadmap acceptance criteria.

**Independent Test**: Establish a session with the controlled fake backend,
assert an admin request is allowed, sign out, then assert the next admin request
is redirected. Repeat with an expired or invalidated session and assert the
request is redirected.

**Acceptance Scenarios**:

1. **Given** a signed-in owner, **When** they activate "Keluar" in the admin
   shell, **Then** the session is cleared, auth cookies are removed, and they are
   returned to the sign-in page.
2. **Given** a signed-in owner who has just signed out, **When** they request an
   admin route, **Then** the request is blocked and redirected to sign-in.
3. **Given** a session whose expiry time has passed, **When** an admin route is
   requested, **Then** the session is rejected and the request is redirected.
4. **Given** a tampered, malformed, or remotely invalidated session, **When** an
   admin route is requested, **Then** the session is rejected and the request is
   redirected.

---

### User Story 3 - Recover access with a password reset (Priority: P3)

An owner who has forgotten their password can request a reset link, follow the
emailed link back into the application, and choose a new password. Accounts are
never created through this flow.

**Why this priority**: Without password recovery, a locked-out owner needs a
platform operator to intervene, which does not satisfy the roadmap's password
reset requirement.

**Independent Test**: With the controlled fake backend, request a reset for a
known account and assert the reset call carries the correct callback URL; open
the reset page with a recovery session and assert a new password can be set; open
it without a valid recovery session and assert the update is refused with a clear
message.

**Acceptance Scenarios**:

1. **Given** the sign-in page, **When** the owner follows "Lupa kata sandi?",
   **Then** a password reset request form is shown.
2. **Given** a submitted email address, **When** the reset request is processed,
   **Then** the response does not reveal whether the address exists, and a reset
   email is requested through Supabase Auth with a callback URL pointing at the
   application.
3. **Given** a valid recovery link, **When** the callback is opened, **Then** a
   recovery session is established and the owner is sent to the reset form.
4. **Given** a valid recovery session, **When** the owner submits a new password
   that meets the minimum policy, **Then** the password is updated and the owner
   can use it to sign in.
5. **Given** no recovery session, **When** the reset form is opened or
   submitted, **Then** the update is refused and the owner is guided back to
   request a new link.

---

### User Story 4 - Keep public registration closed (Priority: P4)

Platform operators invite showroom accounts directly in Supabase Auth. The
application exposes no public registration or account-creation surface, and no
admin screen links to one.

**Why this priority**: The roadmap explicitly forbids public registration.
Open sign-up would let unknown visitors create accounts and reach the admin
surface.

**Independent Test**: Enumerate the application's route segments and assert no
registration/sign-up route exists; request the conventional registration paths
against the running application and assert they return 404; inspect the login
screens for registration links.

**Acceptance Scenarios**:

1. **Given** the delivered application, **When** the route tree is inspected,
   **Then** no `register`, `sign-up`, or equivalent public account-creation route
   exists.
2. **Given** the running application, **When** a visitor requests `/register` or
   `/signup`, **Then** the response is 404.
3. **Given** the login, forgot-password, and reset-password screens, **When** a
   visitor reads them, **Then** no control or link offers public registration.

---

### Edge Cases

- A visitor requests a deeply nested admin URL with a query string: the full
  original path and query are preserved in `next`, but the redirect target is
  restricted to same-origin admin paths to prevent open redirects.
- A visitor supplies an external or protocol-relative `next` value: the
  application falls back to `/admin` instead of redirecting off-site.
- Supabase environment variables are absent or the auth service is unreachable:
  admin requests fail closed (redirect to sign-in) instead of exposing admin
  content or crashing the route.
- The auth service returns a server error during sign-in: the form shows a
  recoverable error and does not create a session.
- A session cookie is present but expired, malformed, or signed with an invalid
  token: it is not trusted; the request is treated as unauthenticated.
- A refreshed session writes new cookies during a request: the refreshed cookies
  are attached to the response so the next request does not bounce the user back
  to sign-in.
- A reset request is submitted for an unknown email: the response is the same as
  for a known email to avoid account enumeration.
- A reset page is loaded without a recovery session: it does not allow a
  password change.
- The login page is opened by an already-authenticated user: it redirects to the
  admin surface instead of showing a redundant form.
- The app runs without a live Supabase Auth service (local development and CI):
  the public login/reset screens still render, admin routes fail closed, and the
  automated suite proves auth behavior with an injected fake backend.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST integrate Supabase Auth as the production
  identity provider, using cookie-based server sessions (access + refresh
  tokens) suitable for Next.js App Router server rendering, route handlers, and
  proxy/middleware.
- **FR-002**: The application MUST provide an email/password sign-in page at
  `/login` with accessible labels, autocomplete hints, client-submitted form
  state, a pending state, and a clear error state for invalid credentials.
- **FR-003**: All `/admin` routes MUST be protected by the application's request
  proxy (`/admin/:path*` matcher) and backed by a server-side guard in the admin
  layout. An unauthenticated request MUST be redirected to `/login` with the
  original admin path and query preserved in a `next` parameter.
- **FR-004**: The `next` redirect target MUST be validated as a same-origin
  path; external, protocol-relative, and non-admin destinations MUST fall back
  to `/admin`.
- **FR-005**: An authenticated request MUST be allowed to reach the admin
  surface. The signed-in account's email (or a safe display name) MUST be shown
  in the admin shell.
- **FR-006**: The application MUST provide a sign-out action in the admin shell
  that calls Supabase Auth sign-out, clears the session cookies, and redirects
  to `/login`.
- **FR-007**: Session validation MUST use the provider's server-verified user
  lookup (not unverified client state). Expired, malformed, tampered, or
  remotely invalidated sessions MUST be rejected and MUST NOT grant admin
  access.
- **FR-008**: Session refresh performed during proxy or server requests MUST be
  written back to the response as secure, HTTP-only cookies so subsequent
  requests remain authenticated.
- **FR-009**: The application MUST provide a password reset request page at
  `/forgot-password` that asks only for an email address, calls the provider's
  reset-password API with a callback URL, and returns the same response whether
  or not the email is registered.
- **FR-010**: The application MUST provide an auth callback route at
  `/auth/callback` that exchanges a provider code or token hash for a recovery
  session and redirects to the safe `next` destination.
- **FR-011**: The application MUST provide a reset form at `/reset-password`
  that is usable only with a recovery session, validates the new password
  (minimum 8 characters and confirmation match), updates the password through
  Supabase Auth, and provides a clear success or failure state.
- **FR-012**: The application MUST NOT implement public registration: no
  register/sign-up route, no account-creation form, and no link or control that
  leads to one. Account creation remains a platform-operator action in Supabase
  Auth.
- **FR-013**: The auth UI MUST match the existing design system (Tailwind CSS 4,
  existing neutral/amber palette, Plus Jakarta Sans headings and Inter body),
  MUST be responsive at desktop and mobile widths, and MUST NOT redesign existing
  public or admin screens beyond adding auth controls.
- **FR-014**: Auth screens MUST meet basic accessibility expectations: visible
  focus states, associated labels, `aria-live` error/status messaging, sufficient
  contrast, and keyboard-operable controls.
- **FR-015**: The feature MUST commit only placeholder environment values in
  `.env.example` (Supabase URL and anon key). No service-role key, real
  credential, or secret may be written.
- **FR-016**: The automated suite MUST prove the auth behavior with an injected
  fake auth backend: unauthenticated admin requests redirect, authenticated
  requests pass, sign-out clears the session, expired/invalid sessions are
  rejected, password reset calls the provider correctly, password update
  requires a session, and no registration route exists.
- **FR-017**: The feature MUST NOT implement tenant membership enforcement,
  role-based authorization, row-level security, tenant context resolution, admin
  CRUD, or any public registration. Those belong to later roadmap phases.

### Key Entities

- **Auth identity**: A Supabase Auth user (id, email, metadata). The application
  consumes the identity for session display; it does not create accounts.
- **Session**: The cookie-backed access/refresh token pair plus the verified
  user lookup. It has a validity state: active, expired, invalid, or signed out.
- **Password reset request**: The email address and callback destination sent to
  Supabase Auth. It never reveals whether an account exists.
- **Recovery session**: The short-lived authenticated state created by following
  a reset link, used only to set a new password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unauthenticated requests to `/admin` and nested admin
  routes are redirected to `/login` with the requested admin path preserved.
- **SC-002**: A valid authenticated request to `/admin` returns the admin surface
  (HTTP 200) and shows the signed-in account.
- **SC-003**: After sign-out, 100% of subsequent admin requests are redirected to
  `/login`; the session cookies are cleared.
- **SC-004**: Expired and invalid sessions are rejected: 100% of such admin
  requests are redirected to `/login` and no admin content is returned.
- **SC-005**: Password reset can be requested, the callback establishes a
  recovery session, and a new password can be set and used to sign in.
- **SC-006**: `/register` and `/signup` return 404, and the route tree contains
  no public registration surface.
- **SC-007**: The automated test suite proves SC-001 through SC-006 with an
  injected fake auth backend, with no live Supabase Auth server or Docker
  required.
- **SC-008**: `npx tsc --noEmit`, `npm test`, `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, and `pnpm build` all exit 0 on the delivered repository.
- **SC-009**: Auth surfaces are captured at desktop (1440×900) and mobile
  (390×844) widths with a passing visual QA report under `.visual-qa/`.
- **SC-010**: `.env.example` contains only placeholders, and no real credential
  is present in the repository.

## Assumptions

- Supabase Auth is the identity provider, per the roadmap. Email/password is the
  only sign-in method in this phase; OAuth, magic links, MFA, and SSO are out of
  scope.
- Showroom accounts are created or invited by platform operators through
  Supabase Auth. The application does not implement self-service registration,
  invitations, or user administration.
- Phase 4 authenticates identity only. Tenant membership, roles
  (`platform_admin`/`owner`/`staff`), and tenant isolation are enforced in Phase
  5 (F005). The roadmap's "authenticated owner can access admin" is satisfied in
  this phase by any valid Supabase Auth user; F005 narrows that to authorized
  tenant members.
- The sign-in route is `/login`; the password reset request route is
  `/forgot-password`; the reset form is `/reset-password`; the auth callback is
  `/auth/callback`. The `next` parameter is restricted to same-origin admin
  paths.
- Supabase's default email delivery is used for reset links; configuring a
  production SMTP provider and email templates is deployment configuration, not
  part of this feature.
- The local environment has no Docker daemon and no live Supabase Auth server.
  Production integration is implemented against `@supabase/ssr`, while automated
  verification uses an injected fake auth backend with the same interface.
- The minimum password policy for the reset form is 8 characters, matching
  Supabase's default. The confirmation field must match.
- The proxy/middleware runs on the Next.js edge-compatible surface, so the
  Supabase proxy resolver must not import Node-only modules.
- The existing `lib/supabase/client.ts` factory remains the browser-safe
  Supabase project client; auth uses dedicated server/proxy factories.
