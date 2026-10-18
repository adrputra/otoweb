---
description: "Task list for Multi-Tenant Security"
---

# Tasks: Multi-Tenant Security

**Input**: Design documents from `/specs/004-multi-tenant-security/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: The specification explicitly requires executable tenant isolation proof
(FR-012, FR-013), so test tasks are included. Isolation tests are mandatory and may
not be weakened or skipped.

**Organization**: Tasks are grouped by user story so context resolution, hostname
resolution, query/RLS isolation, permission enforcement, and the service-role
boundary can be verified independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

- Tenant server modules live in `lib/tenant/`.
- The RLS SQL lives in `db/migrations/`.
- Isolation tests live in `tests/unit/tenant/` (node environment, PGlite).
- Documentation lives in `docs/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the RLS migration and the deterministic database test fixture used
by every isolation proof.

- [x] T001 Fill in the generated `db/migrations/0001_tenant-isolation.sql` with the `app` schema helpers (`current_tenant_id`, `current_user_id`, `is_platform_admin`, `is_tenant_owner`), enable and force row-level security on the seven tenant-owned tables, and add SELECT/INSERT/UPDATE/DELETE policies with matching `USING`/`WITH CHECK` clauses; keep the generated journal entry.
- [x] T002 [P] Create `tests/unit/tenant/fixtures.ts` re-exporting the deterministic prima and tenant-b tenant/profile/membership/domain identifiers from `db/seed-core.ts`, plus fixture rows and cross-tenant attack constants.
- [x] T003 [P] Create `tests/unit/tenant/database.ts` with a reusable PGlite harness that applies `db/migrations`, runs `seedDatabase`, creates a restricted `tenant_app` role (no `BYPASSRLS`), grants table/schema privileges, and exposes helpers to set tenant/user GUCs and reset the role.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the shared contracts and the transaction-scoped database session
helper. No user story can be verified until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Create `lib/tenant/types.ts` with `TenantRole`, `TenantStatus`, `TenantCapability`, `TenantIdentity`, `TenantMembership`, `TenantContext`, `TenantDenialCode`, `TenantContextResult`, and `HostnameTenantResult` per `contracts/tenant-security.md`.
- [x] T005 [P] Create `lib/tenant/session.ts` with `withTenantSession(db, { tenantId, userId, isPlatformAdmin }, callback)` that validates identifiers, opens a transaction, and sets transaction-local `app.tenant_id`, `app.user_id`, and `app.is_platform_admin` via `set_config(..., true)` (depends on T004).

**Checkpoint**: Types and the RLS session helper exist. User story work can proceed.

---

## Phase 3: User Story 1 - Resolve a safe tenant context (Priority: P1) 🎯 MVP

**Goal**: Resolve an authenticated user's tenant context from active memberships and
deny missing, inactive, mismatched, unavailable, or ambiguous cases.

**Independent Test**: With the prima and tenant-b fixtures, resolve each member's
context, then attempt missing membership, inactive membership, suspended tenant,
tenant mismatch, and multiple-membership ambiguity. Every unsafe case is denied.

### Implementation for User Story 1

- [x] T006 [P] [US1] Create `lib/tenant/memberships.ts` with `listMembershipsForUser(db, userId)` (all memberships joined to tenants) and `findTenantById(db, tenantId)` (depends on T004).
- [x] T007 [US1] Create `lib/tenant/context.ts` with the pure `resolveTenantContext(input)` implementing precedence explicit tenant → hostname → single active membership, active/trial tenant rules, and every denial code (depends on T004).
- [x] T008 [US1] Create `lib/tenant/server.ts` with `assertServerOnly`, a dependency-injectable `resolveRequestTenantContext(user, deps?)` that reads the request host, loads memberships, and fails closed on database/configuration errors, and `requireTenantContext(user)` that redirects to `/` on denial (depends on T005, T006, T007).
- [x] T009 [US1] Extend `lib/auth/server.ts` so `requireAdminUser()` requires a valid tenant context after authentication and redirects to `/` when it is denied, without changing any presentation file (depends on T008).

### Tests for User Story 1

- [x] T010 [P] [US1] Create `tests/unit/tenant/context.test.ts` proving the resolution precedence and every denial code, including prima/tenant-b fixtures, inactive membership, suspended tenant, mismatch, ambiguity, and explicit platform-administrator access (depends on T007, T002).
- [x] T011 [US1] Create `tests/unit/tenant/server-context.test.ts` proving `resolveRequestTenantContext` uses the hostname, denies when the directory throws, never returns a tenant on failure, and `assertServerOnly` rejects a browser-like context (depends on T008, T002).

**Checkpoint**: US1 is independently verified: only a valid, unambiguous tenant
context survives.

---

## Phase 4: User Story 2 - Resolve tenants from hostnames (Priority: P2)

**Goal**: Normalize hostnames and resolve only active, verified domains for
active/trial tenants, never with a default fallback.

**Independent Test**: Resolve both fixture hostnames, mixed-case/port/trailing-dot
variants, an unknown host, a malformed host, and a suspended tenant's host. Only the
two fixtures resolve.

### Implementation for User Story 2

- [x] T012 [P] [US2] Create `lib/tenant/hostname.ts` with `normalizeHostname(input)` and `findTenantByHostname(db, hostname)` returning a typed result and requiring active domain status, a non-null `verified_at`, and an active/trial tenant (depends on T004).
- [x] T013 [US2] Create `lib/tenant/directory.ts` with `createTenantDirectory(db)` composing `findTenantByHostname`, `findTenantById`, and `listMembershipsForUser` behind one injectable interface (depends on T006, T012).
- [x] T014 [US2] Wire `lib/tenant/server.ts` to use `createTenantDirectory` by default while keeping the injected-directory seam for tests (depends on T008, T013).

### Tests for User Story 2

- [x] T015 [P] [US2] Create `tests/unit/tenant/hostname.test.ts` proving normalization, both fixture domains, unknown/malformed hosts, unverified domains, and suspended/disabled tenant handling, with no default tenant (depends on T012, T013, T002).

**Checkpoint**: US2 is independently verified: hostnames resolve the correct fixture or
nothing.

---

## Phase 5: User Story 3 - Isolate tenant data in queries and RLS (Priority: P3)

**Goal**: Every tenant-owned read/write is tenant-scoped, and PostgreSQL RLS
independently blocks cross-tenant SELECT/INSERT/UPDATE/DELETE.

**Independent Test**: Insert a tenant-b vehicle, run all scoped reads under prima and
tenant-b contexts, then repeat the attacks under a restricted database role. No
cross-tenant row is returned or mutated.

### Implementation for User Story 3

- [x] T016 [P] [US3] Create `lib/tenant/scoped-queries.ts` with `TenantScopeError`, `requireTenantId`, `getTenantById`, `getShowroomSettings`, `listTenantVehicles`, `getTenantVehicleBySlug`, `listTenantVehicleImages`, and `listTenantMembers`; every function requires and filters by tenant id (depends on T004).
- [x] T017 [US3] Create `lib/tenant/guards.ts` with `authorizeTenantAccess(result, tenantId, capability)` and `assertContextTenant(context, tenantId)` that reject mismatches before any capability evaluation (depends on T004).

### Tests for User Story 3

- [x] T018 [P] [US3] Create `tests/unit/tenant/scoped-queries.test.ts` proving prima sees no tenant-b vehicle/settings/image/membership, exact-id cross-tenant lookups return empty/null, missing/invalid tenant ids throw `TenantScopeError`, and a tenant-b vehicle inserted through a privileged setup path never appears in prima queries (depends on T003, T016, T002).
- [x] T019 [P] [US3] Create `tests/unit/tenant/rls.test.ts` proving that under the restricted `tenant_app` role a prima tenant setting selects only prima rows and that cross-tenant SELECT, INSERT, UPDATE, and DELETE on vehicles/settings/memberships fail safely with tenant-b data unchanged; also prove that no tenant setting returns no rows (depends on T001, T003, T002).

**Checkpoint**: US3 is independently verified at both the application and database
layers.

---

## Phase 6: User Story 4 - Enforce role permissions (Priority: P4)

**Goal**: Apply the owner/staff/platform-administrator capability matrix after the
tenant match check.

**Independent Test**: Evaluate every capability for owner, staff, platform admin,
inactive membership, and mismatched membership. The matrix matches the documentation
and mismatches deny before role evaluation.

### Implementation for User Story 4

- [x] T020 [P] [US4] Create `lib/tenant/permissions.ts` with the `ROLE_CAPABILITIES` matrix, `can(context, capability)`, and the result-union `assertCapability(context, capability)` (depends on T004).

### Tests for User Story 4

- [x] T021 [P] [US4] Create `tests/unit/tenant/permissions.test.ts` proving the full owner/staff/platform-administrator matrix, inactive membership denial, cross-tenant denial before role evaluation, and `authorizeTenantAccess` propagation of context denials (depends on T017, T020, T002).

**Checkpoint**: US4 is independently verified: roles cannot exceed their tenant or
capability.

---

## Phase 7: User Story 5 - Keep the service role out of the browser (Priority: P5)

**Goal**: Prove that no service-role credential or server-only tenant/database module
is reachable from browser code.

**Independent Test**: Scan source/environment files, assert the browser Supabase
client excludes server-only imports, and evaluate a server-only module under a
browser-like global.

### Implementation for User Story 5

- [x] T022 [P] [US5] Create `tests/unit/tenant/service-role.test.ts` scanning the repository for `NEXT_PUBLIC_*SERVICE_ROLE*` and real service-role values, asserting `.env.example` contains placeholders only, asserting `lib/supabase/client.ts` and `'use client'` files do not import `lib/tenant/*` or `db/client`, and asserting `assertServerOnly` throws with a defined `window` (depends on T008).

**Checkpoint**: US5 is independently verified: the elevated credential cannot reach the
browser.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, scripts, and the final full validation pass.

- [x] T023 [P] Create `docs/TENANCY.md` documenting the tenant model, context precedence, hostname rules, permission matrix, RLS settings/policies, restricted-role proof, service-role boundary, and how to run the isolation suite.
- [x] T024 [P] Update `docs/DATABASE.md` (RLS is now implemented, not deferred), `docs/AUTH.md` (admin access now requires a tenant context), and `package.json` with a `test:tenant` script that runs only `tests/unit/tenant`.
- [x] T025 Run every scenario in `specs/004-multi-tenant-security/quickstart.md`, then run `npx tsc --noEmit` and `npm test` fresh and record the output.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; starts immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on Foundational and the US1 membership query.
- **US3 (Phase 5)**: Depends on Foundational; independent of US1/US2 behavior.
- **US4 (Phase 6)**: Depends on Foundational and the US3 guard file.
- **US5 (Phase 7)**: Depends on the US1 server guard.
- **Polish (Phase 8)**: Depends on all stories.

### Within each user story

- Types/contracts before services.
- Services before the request guard.
- Tests after the functions they exercise; isolation tests must pass before the
  feature can be reported complete.

### Parallel Opportunities

- T001, T002, T003 can run in parallel.
- T004, T005 can run in parallel.
- T006 and T007 can run in parallel; T008 depends on both.
- T012 and T015 (test) can be written in parallel with US1 work after T004.
- T018, T019, T021, T022 are independent test files and can run in parallel.
- T023 and T024 are independent documentation tasks.

---

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup + Foundational.
2. Complete US1 (memberships, context, server guard, auth wiring).
3. **STOP and VALIDATE**: run `tests/unit/tenant/context.test.ts` and
   `tests/unit/tenant/server-context.test.ts`.

### Incremental Delivery

1. US1 — safe context resolution.
2. US2 — hostname resolution.
3. US3 — scoped queries + RLS.
4. US4 — capability matrix.
5. US5 — service-role boundary.
6. Polish — docs, scripts, full gates.

Each increment must leave `npx tsc --noEmit` and `npm test` green. Any failing tenant
isolation test stops the run.

---

## Notes

- [P] tasks touch different files and have no incomplete dependency.
- [USn] maps every task to its specification user story.
- Do not weaken, skip, or mark an isolation test pending to make the suite pass.
- Do not modify the existing F003 tables, seed shape, or public/admin presentation.
- Report exact task checkbox state on any interruption.
