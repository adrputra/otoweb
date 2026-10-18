# Tasks: Platform Administration

**Input**: Design documents from `/specs/011-platform-administration/`

**Prerequisites**: plan.md (required), spec.md (required), research.md,
data-model.md, contracts/, quickstart.md

**Tests**: Included because authorization isolation, atomic mutations, and the
operator-only surface are explicit acceptance requirements.

**Organization**: Tasks are grouped by user story so inspection, tenant
configuration, and access isolation remain independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3
- Dependencies are written as `(depends on T###, ...)`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared types, validation, the platform RLS helper, and
the deterministic operator fixture.

- [x] T001 [P] Define serializable platform view models and the client-safe validation contracts (tenant name/slug/plan/status, hostname normalization, UUIDs) in `lib/platform/types.ts` and `lib/platform/validation.ts`
- [x] T002 [P] Add `withPlatformSession` with transaction-local `app.user_id`/`app.is_platform_admin` settings to `lib/tenant/session.ts`
- [x] T003 [P] Add the deterministic platform-operator profile and active `platform_admin` Prima membership to `db/seed-core.ts`, and export its identifiers from `tests/unit/tenant/fixtures.ts`
- [x] T004 Update seed-count, role, and Prima member-count assertions for the new fixture in `tests/unit/db/database-foundation.test.ts` and `tests/unit/tenant/scoped-queries.test.ts` (depends on T003)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Authorization, service, actions, and the request guard that every
platform route depends on.

**⚠️ CRITICAL**: No platform route or form can be built until this phase is
complete.

- [x] T005 Implement explicit platform-operator authorization (active `platform_admin` membership lookup, injectable session resolution, page and action guards) in `lib/platform/auth.ts` (depends on T001, T002)
- [x] T006 Implement cross-tenant list/detail reads and atomic create/assign-owner/set-subdomain/set-plan/set-status/disable mutations with in-transaction membership re-checks in `lib/platform/tenant-service.ts` (depends on T001, T002)
- [x] T007 Implement the `'use server'` actions with authorization, result mapping, and path revalidation in `lib/platform/actions.ts` (depends on T005, T006)
- [x] T008 Protect `/platform` with the session proxy and allow safe `/platform` post-login `next` paths in `proxy.ts` and `lib/auth/paths.ts` (depends on T005)
- [x] T009 [P] Add validation tests for slug, hostname, plan, status, and UUID contracts in `tests/unit/platform/validation.test.ts` (depends on T001)
- [x] T010 [P] Add authorization tests for operator success, owner/staff/inactive/unknown denial, and injected session resolution in `tests/unit/platform/auth.test.ts` (depends on T003, T005)
- [x] T011 [P] Add service tests for list/detail counts, atomic create and conflicts, owner upsert/profile provisioning, subdomain conflict, plan/status persistence, disable preventing hostname resolution, restricted-role RLS behavior, and non-operator denial in `tests/unit/platform/tenant-service.test.ts` (depends on T003, T006)

**Checkpoint**: Authorization, data operations, server actions, and the proxy
guard are complete and proven without any UI.

---

## Phase 3: User Story 1 — Inspect every tenant (Priority: P1) 🎯 MVP

**Goal**: A platform operator sees a complete tenant list and can inspect one
tenant's identity, domains, owners, and counts.

**Independent Test**: Sign in as the operator, open `/platform`, confirm both
seeded tenants and their summaries, open Prima, and confirm its domains,
owners, and counts.

### Implementation for User Story 1

- [x] T012 [US1] Build the separate platform shell (dark neutral rail, operator identity, logout, no admin navigation) in `components/platform-shell.tsx` (depends on T005)
- [x] T013 [US1] Build the operator-only layout and tenant list with summary cards, status/plan/subdomain columns, counts, and an instructive empty state in `app/platform/layout.tsx` and `app/platform/page.tsx` (depends on T006, T012)
- [x] T014 [US1] Build the tenant detail page showing identity, domains, owners/members, counts, and not-found handling in `app/platform/tenants/[id]/page.tsx` (depends on T006, T012)

**Checkpoint**: The full inspection journey works independently.

---

## Phase 4: User Story 2 — Create and configure a tenant (Priority: P1)

**Goal**: A platform operator creates a tenant and assigns an owner, sets the
subdomain, sets plan/status, and disables a tenant.

**Independent Test**: Create a tenant, assign an owner, change the subdomain,
plan, and status, then disable it; re-open the detail view and confirm every
value persisted.

### Implementation for User Story 2

- [x] T015 [US2] Build the create-tenant form and route with name, slug, plan, status, subdomain, optional owner user id, pending/error states, and success navigation in `components/platform/create-tenant-form.tsx` and `app/platform/tenants/new/page.tsx` (depends on T007, T012)
- [x] T016 [US2] Build tenant controls for plan/status, assign owner, set subdomain, and the explicit disable action, then wire them into the detail page in `components/platform/tenant-controls.tsx` and `app/platform/tenants/[id]/page.tsx` (depends on T007, T014)
- [x] T017 [US2] Add the operator Playwright acceptance flow (list, detail, create, assign owner, subdomain, plan/status, disable) and configure the fake auth server as the platform operator in `tests/e2e/platform.spec.ts` and `playwright.platform.config.ts` (depends on T008, T013, T015, T016)

**Checkpoint**: Every roadmap capability is available and demonstrable.

---

## Phase 5: User Story 3 — Keep the platform away from showroom users (Priority: P1)

**Goal**: Showroom owners and staff can neither render the platform surface nor
invoke its actions, and no platform link appears in showroom navigation.

**Independent Test**: Request `/platform` anonymously and as a showroom owner;
assert the redirect/not-found behavior, then invoke service actions as the owner
and assert denial with no writes.

### Implementation for User Story 3

- [x] T018 [US3] Extend proxy and safe-path tests for `/platform` redirects in `tests/unit/auth/admin-proxy.test.ts` (depends on T008)
- [x] T019 [US3] Add a static navigation-isolation assertion that the showroom admin shell contains no `/platform` link and add anonymous redirect + owner-denial coverage in `tests/e2e/platform.spec.ts` (depends on T010, T017)
- [x] T020 [US3] Add restricted-role assertions proving a showroom owner cannot run platform reads or writes and that a real operator can in `tests/unit/platform/tenant-service.test.ts` (depends on T011)

**Checkpoint**: The cross-tenant surface is not exposed to showroom roles.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, detector evidence, visual QA, convergence, and the
full checkpoint.

- [x] T021 [P] Document the platform surface, authorization model, capabilities, data behavior, and verification commands in `docs/PLATFORM.md`, and cross-reference it from `docs/ADMIN.md`, `docs/TENANCY.md`, and `docs/DATABASE.md` (depends on T013, T016)
- [x] T022 Build and run the F012 desktop/mobile visual QA capture for `/platform`, `/platform/tenants/new`, and the seeded Prima detail view in `scripts/visual-qa-platform.mjs` and `.visual-qa/` (depends on T013, T015, T016)
- [x] T023 Run the Impeccable detector over the changed platform UI and record the output under `.visual-qa/reports/` (depends on T022)
- [x] T024 Run the converge pass, append any missing work, and run the full validation checkpoint (`npx tsc --noEmit`, `npm test`) with fresh output (depends on T017, T019, T020, T021, T023)

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (T001–T004) establishes shared contracts, the platform RLS helper, and
  the operator fixture.
- Foundational (T005–T011) blocks every route and form.
- US1 (T012–T014) delivers inspection and is the MVP.
- US2 (T015–T017) delivers the roadmap mutations.
- US3 (T018–T020) hardens access isolation and may run alongside US2 after the
  proxy and authorization exist.
- Polish (T021–T024) completes docs, visual evidence, convergence, and the
  checkpoint.

### Within each story

- Contracts and service before routes.
- Routes before forms.
- Forms before Playwright acceptance.
- Authorization tests before claiming isolation.

### Parallel opportunities

- T001, T002, and T003 touch different files.
- T009, T010, and T011 are independent test files once their subjects exist.
- T012 can start as soon as T005 lands.
- T013 and T014 share the shell but touch different routes.
- T015 and T016 touch different components.
- T018/T019 and T020 can run alongside final US2 e2e work.
- T021 and T022 touch different paths.

### Suggested MVP

T001–T014 delivers the authorization substrate and the inspection surface.
T015–T017 completes the roadmap capabilities. T018–T020 proves isolation.

## Format Validation

Every task starts with a checkbox plus `T###` id, uses `[P]` only where files
are independent, carries a `[USn]` label inside user-story phases, and names
exact file paths.
