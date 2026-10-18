---
description: "Task list for Authentication"
---

# Tasks: Authentication

**Input**: Design documents from `/specs/003-authentication/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: The specification explicitly requires executable proof of auth
behavior with an injected fake backend (FR-016) and no-registration checks
(FR-012), so test tasks are included.

**Organization**: Tasks are grouped by user story so sign-in/admin protection,
logout/expiry, password reset, and the no-registration guarantee can be verified
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Auth modules live in `lib/auth/`.
- The Next.js 16 proxy entry is the root `proxy.ts`.
- Auth routes live under `app/login/`, `app/forgot-password/`,
  `app/reset-password/`, and `app/auth/callback/`.
- Shared auth UI lives in `components/auth/`.
- Unit tests live in `tests/unit/auth/`; browser tests in `tests/e2e/`.
- Documentation lives in `docs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the Supabase SSR dependency and the provider/configuration
pieces the auth flows share.

- [x] T001 Install `@supabase/ssr@0.12.7` as a dependency and update `package.json` and `pnpm-lock.yaml`.
- [x] T002 [P] Extend `.env.example` with placeholder-only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` auth guidance (no service-role key, no real credential) and confirm `NEXT_PUBLIC_SITE_URL` is documented.
- [x] T003 [P] Add an `[auth]` section to `supabase/config.toml` with the local site URL, `/auth/callback` redirect allow-list, refresh-token rotation, and public signup disabled for operator-invited accounts.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the auth contracts, session helpers, Supabase adapters,
service orchestration, proxy, server guard, and server actions. No user story
can be verified until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Create `lib/auth/types.ts` with `AuthUser`, `AuthErrorCode`, `AuthResult`, `AuthBackend`, `AuthResolution`, and server-action state types per `contracts/auth-backend.md`.
- [x] T005 [P] Create `lib/auth/paths.ts` with `safeNextPath` (same-origin `/admin` or `/admin/*` only) and `loginUrlFor` preserving the original admin path and query.
- [x] T006 [P] Create `lib/auth/session.ts` with pure `isSessionActive({ user, expiresAt }, now)` and `resolveSessionUser(auth)` helpers that treat thrown errors as anonymous.
- [x] T007 [P] Create `lib/auth/validation.ts` with Zod schemas for email, sign-in, password-reset request, and new-password confirmation (minimum 8 characters, max 72, confirmation match).
- [x] T008 [P] Create `lib/auth/supabase-env.ts` (URL/anon-key reader with no Node-only imports), `lib/auth/supabase-user.ts` (Supabase `User` -> `AuthUser` mapper), and `lib/auth/site-url.ts` (safe callback base URL).
- [x] T009 Create `lib/auth/supabase-server.ts` with a fresh `@supabase/ssr` server client per call (async `cookies()` adapter) implementing `AuthBackend` with `getUser`, `signInWithPassword`, `signOut`, `requestPasswordReset`, and `updatePassword` (depends on T004, T008).
- [x] T010 Create `lib/auth/supabase-proxy.ts` with the edge-safe Supabase resolver that reads `NextRequest` cookies, collects refreshed cookies and cache headers from `setAll`, and returns an `AuthResolution`; missing env or provider errors fail closed (depends on T004, T008).
- [x] T011 Create `lib/auth/service.ts` with `signInWithPassword`, `signOut`, `requestPasswordReset`, and `updatePassword` orchestration over `AuthBackend`, including generic reset responses and session-required password updates (depends on T004).
- [x] T012 Create `lib/auth/admin-proxy.ts` (testable `createAdminProxy` factory with injected resolver, fail-closed redirect, and refreshed-cookie application) and the root `proxy.ts` entry with the `/admin/:path*` matcher (depends on T005, T010).
- [x] T013 Create `lib/auth/server.ts` with `getCurrentUser()` (returns null on any failure) and `requireAdminUser()` (redirects to `/login?next=/admin` when absent) using the Supabase server backend (depends on T009).
- [x] T014 Create `lib/auth/actions.ts` server actions for sign-in, sign-out, reset request, and password update; validate with the shared schemas, catch configuration/provider failures into user-facing states, and redirect only to `safeNextPath` destinations (depends on T005, T007, T008, T009, T011).

**Checkpoint**: Auth contracts, adapters, proxy, guard, and actions exist. User
story work can now proceed.

---

## Phase 3: User Story 1 - Sign in and reach the admin surface (Priority: P1) 🎯 MVP

**Goal**: An unauthenticated admin request is redirected to a polished sign-in
page; a valid sign-in reaches admin; admin requests without a valid session are
always blocked.

**Independent Test**: With the fake backend, assert anonymous `/admin` requests
redirect to `/login` with `next`, authenticated requests pass the proxy, invalid
credentials do not create a session, and the admin layout/server guard refuses
anonymous users.

### Implementation for User Story 1

- [x] T015 [P] [US1] Create `components/auth/auth-shell.tsx` (responsive split brand/form frame), `components/auth/form-field.tsx` (label/input/hint/error primitives), and `components/auth/auth-message.tsx` (`role="status"`/`role="alert"` messaging) using the incumbent neutral/amber design system and existing fonts.
- [x] T016 [US1] Create `app/login/page.tsx` (authenticated-user redirect, safe `next`, logout/callback notices) and `app/login/login-form.tsx` (email/password, show-password control, pending state, error state, "Lupa kata sandi?" link, no registration link) (depends on T014, T015).
- [x] T017 [US1] Update `app/admin/layout.tsx` to call `requireAdminUser()` and pass the user to `AdminShell`; keep the existing admin presentation intact (depends on T013).
- [x] T018 [US1] Update `components/admin-shell.tsx` to accept the authenticated user and display a safe display name/email with initials in the existing header; add no visual redesign (depends on T017).
- [x] T019 [P] [US1] Create `tests/unit/auth/fake-auth.ts` (controlled users, active/expired/invalid sessions, call recording) and `tests/unit/auth/session.test.ts` covering active, expired, invalid, and thrown-error session states (depends on T004, T006).
- [x] T020 [US1] Create `tests/unit/auth/admin-proxy.test.ts` proving anonymous `/admin` and nested/query requests redirect to `/login` with the full safe `next`, authenticated requests pass, resolver failures fail closed, and refreshed cookies are applied (depends on T012, T019).
- [x] T021 [US1] Create `tests/unit/auth/auth-flow.test.ts` proving valid sign-in establishes a session, invalid credentials do not, and `getUser` returns the signed-in identity through the service layer (depends on T011, T019).

**Checkpoint**: US1 is independently verified: admin is closed, sign-in works,
and sessions are recognized.

---

## Phase 4: User Story 2 - End a session and survive expiry (Priority: P2)

**Goal**: Sign-out clears the session; expired and invalid sessions are rejected
on the next admin request.

**Independent Test**: Sign in with the fake backend, confirm access, sign out,
confirm the next admin request redirects; configure an expired session and an
invalid/throwing session and confirm both redirect.

### Implementation for User Story 2

- [x] T022 [US2] Add a "Keluar" server-action form to `components/admin-shell.tsx` wired to `logoutAction`; ensure it clears cookies through the Supabase backend and redirects to `/login` (depends on T014, T018).
- [x] T023 [US2] Extend `tests/unit/auth/auth-flow.test.ts` to prove sign-out clears the session and that a signed-out user is anonymous, plus expired and invalid session rejection (depends on T021).
- [x] T024 [US2] Add a focused assertion to `tests/unit/auth/admin-proxy.test.ts` that a signed-out/expired session cannot reach admin and that refresh headers/cookies are attached to the allow response (depends on T020, T023).

**Checkpoint**: US2 is independently verified: logout works and expired/invalid
sessions are rejected.

---

## Phase 5: User Story 3 - Recover access with a password reset (Priority: P3)

**Goal**: An owner can request a reset link, the callback establishes a recovery
session, and the reset form updates the password only for a valid recovery
session.

**Independent Test**: With the fake backend, assert the request passes the
correct callback URL, the callback/token handler can establish a recovery
session, password update succeeds with a session and fails without one, and the
public screens render without a live auth service.

### Implementation for User Story 3

- [x] T025 [P] [US3] Create `app/forgot-password/page.tsx` and `app/forgot-password/forgot-password-form.tsx` with a single email field, generic non-enumerating success message, pending state, and a link back to sign-in (depends on T014, T015).
- [x] T026 [US3] Create `app/reset-password/page.tsx` (recovery-session check with invalid-link state) and `app/reset-password/reset-password-form.tsx` (new password + confirmation, pending/error/success states) (depends on T013, T014, T015).
- [x] T027 [US3] Create `app/auth/callback/route.ts` to exchange a Supabase `code` (PKCE) or `token_hash`/`type` (email OTP) for a session, apply cookies/headers to the response, and redirect to the safe `next` or `/login?error=callback` (depends on T005, T008, T009).
- [x] T028 [US3] Extend `tests/unit/auth/auth-flow.test.ts` to prove reset requests carry `<site>/auth/callback?next=/reset-password`, update-password succeeds only with a session, and the generic reset response is identical for unknown emails (depends on T023, T025, T026, T027).

**Checkpoint**: US3 is independently verified: reset request, callback, and
password update are covered.

---

## Phase 6: User Story 4 - Keep public registration closed (Priority: P4)

**Goal**: No public registration route or link exists, and the conventional
registration paths return 404.

**Independent Test**: Scan the `app/` route tree for registration/sign-up
segments and assert none exist; run a browser request for `/register` and
`/signup` and assert 404; inspect the auth screens.

### Implementation for User Story 4

- [x] T029 [US4] Create `tests/unit/auth/no-registration.test.ts` that walks `app/` and asserts no `register`, `signup`, `sign-up`, or `daftar` route segment exists, and that `/login`, `/forgot-password`, and `/reset-password` pages are present (depends on T016, T025, T026).
- [x] T030 [US4] Create `tests/e2e/auth.spec.ts` covering unauthenticated `/admin` redirect to `/login` with `next`, login-page fields and the forgot-password link, absence of registration copy/links, and 404 responses for `/register` and `/signup` (depends on T012, T016, T025).

**Checkpoint**: US4 is independently verified: registration is closed at the
route and UI levels.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Document the feature, capture visual evidence, and prove the full
quality gates fresh.

- [x] T031 [P] Create `docs/AUTH.md` documenting the routes, Supabase setup, environment variables, session/refresh behavior, safe redirects, password reset, operator-invited accounts, the fake-backend test strategy, and the deferred F005 tenant/role work.
- [x] T032 [P] Update the Phase 4 authentication rows in `docs/IMPLEMENTATION_STATUS.md` (and the Phase 3 row already delivered by F003) with the delivered capabilities and evidence paths.
- [x] T033 Create `scripts/visual-qa.mjs` and a `visual:qa` script in `package.json` that starts the app, captures `/login`, `/forgot-password`, and `/reset-password` at 1440×900 and 390×844 into `.visual-qa/screenshots/`, and writes detector/report artifacts under `.visual-qa/reports/` (depends on T016, T025, T026).
- [x] T034 Run `pnpm visual:qa`, inspect the desktop and mobile screenshots, run `impeccable detect` on the changed auth UI, and write a `PASS`/`FAIL` report to `.visual-qa/reports/auth-visual-qa.md`; fix only visual defects found, then confirm once (depends on T033).
- [x] T035 Run the full configured and roadmap gates fresh: `npx tsc --noEmit`, `npm test`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; fix only auth/test issues and never weaken a check (depends on T024, T028, T030, T031, T032, T034).
- [x] T036 Run `pnpm exec prettier --write` on the new auth, test, script, and documentation files only, then re-run the affected checks (depends on T035).
- [x] T037 Run the converge assessment against `spec.md`, `plan.md`, and `tasks.md`; append no tasks if authentication is fully satisfied (depends on T036).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T002/T003 are independent of T001.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories. T004–T008 are independent files; T009/T010 depend on T004/T008; T011 depends on T004; T012 depends on T005/T010; T013 depends on T009; T014 depends on T005/T007/T008/T009/T011.
- **US1 (Phase 3)**: Depends on Foundational; delivers the MVP.
- **US2 (Phase 4)**: Depends on US1's admin shell and actions.
- **US3 (Phase 5)**: Depends on Foundational; can proceed in parallel with US2 once Foundational is complete.
- **US4 (Phase 6)**: Depends on the auth pages existing.
- **Polish (Phase 7)**: Depends on all stories.

### Within Each User Story

- Contracts/helpers before adapters.
- Adapters/actions before pages.
- Pages before page tests.
- Tests prove behavior; do not weaken them to make a command green.

### Parallel Opportunities

- T002/T003 can run in parallel with T001.
- T004–T008 can be authored in parallel.
- T015, T019, T025, T031, and T032 are independent files and can run in parallel
  where their dependencies are complete.
- US2 and US3 implementations can proceed in parallel after Foundational, while
  US1 remains the first deliverable.

---

## Parallel Example: Foundational Auth Contracts

```bash
# Author independent contracts/helpers together:
Task: "Create lib/auth/types.ts"
Task: "Create lib/auth/paths.ts"
Task: "Create lib/auth/session.ts"
Task: "Create lib/auth/validation.ts"
Task: "Create lib/auth/supabase-env.ts + supabase-user.ts + site-url.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational.
2. Complete US1: admin redirect, login page, session recognition, admin guard.
3. Stop and verify US1 independently before logout/reset work.

### Incremental Delivery

1. Setup + Foundational -> auth contracts, adapters, proxy, actions exist.
2. US1 -> authenticated admin access is closed/opened correctly.
3. US2 -> logout and expired/invalid sessions are rejected.
4. US3 -> password reset request/callback/update.
5. US4 -> no registration route or link.
6. Polish -> docs, visual QA, full gates, converge.

---

## Notes

- [P] tasks touch different files and have no unmet dependencies.
- Tests are required by FR-016 and FR-012; do not remove them to make a command
  green.
- No task changes existing public presentation beyond adding auth controls.
- No task implements tenant roles, RLS, admin CRUD, or registration.
- No task writes a real credential.
- Tick each task `[x]` only when its evidence is captured.

---

## Phase 8: Convergence

- [x] T038 Fix `/auth/callback` so a recovery link carrying `next=/reset-password` lands on the reset form (allow only that extra same-origin path, keep `/admin` fallback for everything else) and add unit coverage for the callback redirect decision per FR-010, US3/AC3 (contradicts).
- [x] T039 [P] Fix the Playwright auth spec's ambiguous `Kata sandi` locator so `pnpm test:e2e` passes per SC-007 and quickstart (partial).
