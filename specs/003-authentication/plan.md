# Implementation Plan: Authentication

**Branch**: `003-authentication` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-authentication/spec.md`

## Summary

Add Supabase Auth to the existing Next.js 16 App Router application and close the
admin surface to anonymous visitors. The feature delivers an email/password
sign-in page, a Next.js 16 request proxy (`proxy.ts`) that protects every
`/admin` route, a server-side admin-layout guard as defense in depth, cookie-based
session refresh through `@supabase/ssr`, sign-out from the admin shell, a
password reset request/callback/update flow, and an explicit "no registration"
surface. Authentication logic is expressed behind a small `AuthBackend`
interface so the complete flow — including expired and invalid sessions — is
verified in Vitest with an injected fake backend, because this environment has
no Docker daemon and no live Supabase Auth server. The new auth screens follow
the incumbent neutral/amber design system and are verified with Playwright
screenshots at desktop and mobile widths.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16.4.0, React 19.

**Primary Dependencies**: `@supabase/supabase-js` (already installed) and
`@supabase/ssr@0.12.7` (new) for cookie-based server sessions; `zod` for form
validation; `lucide-react` for icons; Tailwind CSS 4 for the auth UI.

**Storage**: Supabase Auth (hosted identity service) with session state in
HTTP-only cookies. No new database tables or migrations. The existing
`profiles.id` is intended to match a Supabase Auth user id in a later phase;
Phase 4 does not write profile rows.

**Testing**: Vitest + Testing Library for unit/contract tests, with a
`FakeAuthBackend` that implements the production `AuthBackend` interface and
tracks active/expired/invalid sessions. Playwright for unauthenticated admin
redirect, login-page rendering, and no-registration checks. A Playwright capture
script produces desktop/mobile screenshots for Visual QA.

**Target Platform**: Node.js 24 / pnpm 12.3.4; local development, CI, and
Supabase/Vercel production. The proxy path must remain edge-compatible.

**Project Type**: Single Next.js App Router application.

**Performance Goals**: No measurable regression to existing public pages. Proxy
auth validation runs only on `/admin/:path*`; public routes are untouched. Auth
screens render as server components with small client form islands.

**Constraints**: No Docker, no local PostgreSQL, no live Supabase Auth service in
this environment. No public registration. No tenant/role enforcement, RLS, or
admin CRUD. No real credentials. Existing public and admin visual design must be
preserved; only auth controls are added to the admin shell.

**Scale/Scope**: One application, four auth routes (`/login`,
`/forgot-password`, `/reset-password`, `/auth/callback`), one protected route
tree (`/admin/**`), one shared auth shell, one fake backend for tests, one
visual-QA capture script.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled project template (no
ratified principles). Per the Spec Kit plan/converge guidance, constitution
checks are skipped gracefully rather than failing. No constitution bootstrap
exists in `.sdd-toolbox/roadmap.json` for this feature.

**Result**: PASS (no ratified constraints to violate).

## Project Structure

### Documentation (this feature)

```text
specs/003-authentication/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth-backend.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by the tasks capability
```

### Source Code (repository root)

```text
proxy.ts                              # Next.js 16 request proxy entry + /admin matcher
lib/auth/
├── types.ts                          # AuthUser, AuthResult, AuthBackend, AuthResolution
├── paths.ts                          # safeNextPath + login redirect URL construction
├── session.ts                        # pure session-validity helpers
├── service.ts                        # sign-in/sign-out/reset/update orchestration
├── validation.ts                     # Zod schemas shared by server actions
├── supabase-env.ts                   # read Supabase URL/anon key (never service role)
├── supabase-user.ts                  # map Supabase User -> AuthUser
├── supabase-proxy.ts                 # edge-safe Supabase resolver + cookie refresh
├── supabase-server.ts                # server/action Supabase backend via next/headers
├── admin-proxy.ts                    # testable proxy factory (injected resolver)
├── server.ts                         # getCurrentUser + requireAdminUser
├── actions.ts                        # server actions: login/logout/reset/update
└── site-url.ts                       # safe public site URL for callback links

app/
├── login/
│   ├── page.tsx                      # server page, redirects authenticated users
│   └── login-form.tsx                # client form island
├── forgot-password/
│   ├── page.tsx
│   └── forgot-password-form.tsx
├── reset-password/
│   ├── page.tsx
│   └── reset-password-form.tsx
├── auth/callback/route.ts            # code/token_hash -> recovery session
└── admin/layout.tsx                  # server guard + user passed to AdminShell

components/
├── auth/
│   ├── auth-shell.tsx                # shared responsive auth frame
│   ├── form-field.tsx                # shared label/input/error primitives
│   └── auth-message.tsx              # aria-live status/error message
└── admin-shell.tsx                   # adds identity + sign-out control

tests/
├── unit/auth/
│   ├── fake-auth.ts                  # controlled fake backend
│   ├── session.test.ts               # valid/expired/invalid session helpers
│   ├── admin-proxy.test.ts           # unauthenticated/authenticated proxy behavior
│   ├── auth-flow.test.ts             # login/logout/reset/update service behavior
│   └── no-registration.test.ts       # route-tree assertion
└── e2e/auth.spec.ts                  # redirect, login UI, no /register

scripts/
└── visual-qa.mjs                     # server + desktop/mobile auth captures

docs/
└── AUTH.md                           # architecture, setup, security, testing
```

**Structure Decision**: Auth code is grouped under `lib/auth/` with a strict
split between pure/testable modules, edge-safe proxy modules (no `next/headers`),
and server-only modules. UI lives under `app/` for routes and
`components/auth/` for shared presentation. The proxy entry is root-level
`proxy.ts`, the Next.js 16 replacement for `middleware.ts`. Existing public pages
and repository/data code are untouched.

## Complexity Tracking

No constitution violations. The only added complexity is the injectable
`AuthBackend` plus fake backend, required because no live Supabase Auth service
is available; it exercises the same orchestration, session, and proxy code paths
used in production.
