---

description: "Task list for production hardening"
---

# Tasks: Production Hardening

**Input**: Design documents from `/specs/015-production-hardening/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Included. This is an audit-and-fix feature; every fixed defect carries
a regression test and every audit category leaves command evidence.

**Organization**: Tasks are grouped by user story. US1 is security/RLS/
authorization, US2 is dependency/build remediation, US3 is two-showroom
desktop/mobile/SEO/accessibility/performance/failure-state QA, and US4 is the
durable report and final evidence.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, or US4
- Every task names the exact file path

## Phase 1: Setup (Shared Audit Infrastructure)

**Purpose**: Deterministic audit and capture tooling used by the stories.

- [x] T001 Create `scripts/hardening-audit.mjs` performing offline checks (tenant-table RLS coverage in migrations, required security headers, secret/unsafe-HTML scan, seeded-showroom readiness) and emitting JSON.
- [x] T002 Add `audit:hardening` and `visual:qa:hardening` scripts to `package.json` (depends on T001).
- [x] T003 [P] Create `scripts/visual-qa-hardening.mjs` capturing Prima and Tenant B home/inventory/detail plus an unknown-host 404 at desktop 1440×900 and mobile 390×844, with tenant-isolation and overflow assertions.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared failure and identity primitives.

- [x] T004 Create `lib/public/branding.ts` resolving the request showroom name for auth screens with a `OtoWeb` fallback and no throw on database failure.
- [x] T005 Create `app/not-found.tsx` and `app/error.tsx` with tenant-aware/neutral failure UI and a retry action (depends on T004).

---

## Phase 3: User Story 1 - Security, RLS, and authorization (Priority: P1)

**Goal**: Prove tenant isolation and authorization with database-backed tests, and close HTTP/SEO/auth-identity gaps.

**Independent Test**: Run `tests/unit/tenant/rls.test.ts`, `tests/unit/security/authorization.test.ts`, `tests/unit/security/hardening-config.test.ts`, and the auth branding e2e checks; inspect the fresh output.

### Implementation for User Story 1

- [x] T006 [US1] Harden `next.config.mjs`: add frame/permissions/COOP/CSP-subset headers, production-only HSTS, and `poweredByHeader: false`.
- [x] T007 [US1] Add `/platform/` (and `/platform`) to the private paths in `app/robots.ts`.
- [x] T008 [US1] Add a `tablePolicyCount` helper to `tests/unit/tenant/database.ts`, include `analytics_events` in the RLS table matrix, and assert every tenant-scoped table has at least one policy in `tests/unit/tenant/rls.test.ts`.
- [x] T009 [US1] Add `tests/unit/security/authorization.test.ts` covering the role/capability matrix, tenant mismatch, platform-operator independence, and anonymous denial.
- [x] T010 [US1] Make auth branding tenant-aware: add a `brandName` prop to `components/auth/auth-shell.tsx`, use `resolveAuthBrandName()` in `app/login/page.tsx`, `app/forgot-password/page.tsx`, and `app/reset-password/page.tsx`, and generate tenant metadata (depends on T004).
- [x] T011 [P] [US1] Add `tests/unit/security/hardening-config.test.ts` asserting the security headers, `poweredByHeader`, robots private paths, and the branding fallback (depends on T006, T007, T004).
- [x] T012 [P] [US1] Add a Tenant B sign-in branding assertion to `tests/e2e/auth.spec.ts` (depends on T010).

**Checkpoint**: Security, RLS, authorization, headers, robots, and auth identity are proven.

---

## Phase 4: User Story 2 - Dependency and build audit (Priority: P1)

**Goal**: Remove production-reachable high/critical advisories where a safe fix exists and prove the build remains clean.

**Independent Test**: Run `pnpm audit --prod --json`, `pnpm audit --json`, `npx tsc --noEmit`, `npm test`, `pnpm lint`, and `pnpm build`.

### Implementation for User Story 2

- [x] T013 [US2] Move `shadcn` from `dependencies` to `devDependencies` in `package.json`, add safe version-scoped pnpm overrides for `fast-uri`, `postcss`, and `nanoid`, and refresh `pnpm-lock.yaml` with `pnpm install`.
- [x] T014 [US2] Record before/after dependency audit summaries in `.visual-qa/reports/f016-dependency-audit-before.json` and `.visual-qa/reports/f016-dependency-audit-after.json` (depends on T013).
- [x] T015 [US2] Re-run typecheck, unit tests, lint, and build after the dependency change; fix any in-scope regression (depends on T013).

**Checkpoint**: Dependency reachability is known and the build is green.

---

## Phase 5: User Story 3 - Two-showroom QA (Priority: P1)

**Goal**: Make Tenant B a realistic second showroom and prove desktop/mobile, SEO, accessibility, performance, and failure-state behavior on both hosts.

**Independent Test**: Run `pnpm test:e2e -- hardening.spec.ts accessibility.spec.ts`, the affected existing e2e suites, and `pnpm visual:qa:hardening`.

### Implementation for User Story 3

- [x] T016 [US3] Seed two deterministic Tenant B vehicles and cover images in `db/seed-core.ts`, featured so both showroom homes render inventory.
- [x] T017 [US3] Update seed/ownership expectations in `tests/unit/db/database-foundation.test.ts`, `tests/unit/tenant/rls.test.ts`, `tests/unit/tenant/scoped-queries.test.ts`, `tests/unit/public/repositories.test.ts`, and `tests/unit/platform/tenant-service.test.ts` (depends on T016).
- [x] T018 [US3] Update `tests/e2e/subdomain-routing.spec.ts` and `scripts/visual-qa-subdomain.mjs` to expect Tenant B inventory instead of the empty state (depends on T016).
- [x] T019 [US3] Add `tests/e2e/hardening.spec.ts`: two-host home/inventory/detail at desktop and mobile, tenant isolation, no overflow, tenant SEO/robots/sitemap, unknown host/vehicle/route, malformed analytics, and warm-route performance measurements (depends on T016, T007).
- [x] T020 [US3] Add `tests/e2e/accessibility.spec.ts`: language, single primary heading, image alt, accessible control names, icon-button labels, landmarks, and contact-form error association on both showrooms (depends on T022, T019).
- [x] T021 [US3] Fix public accessibility wiring in `components/showroom.tsx` (search/filter labels, mobile-menu `aria-expanded`/`aria-controls`) and `components/public-contact-form.tsx` (`id`/`aria-describedby` for field errors).
- [x] T022 [P] [US3] Add `tests/unit/public/failure-pages.test.tsx` rendering the new not-found and error boundaries for visible, recoverable copy (depends on T005).

**Checkpoint**: Both showrooms pass the QA matrix and every failure state is safe.

---

## Phase 6: User Story 4 - Findings report and final evidence (Priority: P2)

**Goal**: Publish the ten-category audit report and the fresh checkpoint evidence.

**Independent Test**: Read `docs/PRODUCTION_HARDENING.md` and confirm every category, fix, residual, and capture link is present.

### Implementation for User Story 4

- [x] T023 [US4] Write `docs/PRODUCTION_HARDENING.md` with methodology, per-category verdicts, findings (fixed/accepted/deferred), two-showroom QA matrix, commands, and evidence paths (depends on T006, T007, T008, T009, T010, T011, T012, T013, T015, T016, T017, T018, T019, T020, T021, T022).
- [x] T024 [P] [US4] Link the hardening report from `docs/IMPLEMENTATION_STATUS.md` and `docs/CURRENT_STATE.md` (depends on T023).
- [x] T025 [US4] Run `node scripts/hardening-audit.mjs`, `pnpm audit --prod --json`, and `pnpm visual:qa:hardening`; store fresh outputs under `.visual-qa/reports/` (depends on T001, T003, T016, T021, T022).
- [x] T026 [US4] Run the affected e2e suites and the full configured validation fresh (`npx tsc --noEmit`, `npm test`, `pnpm lint`, `pnpm build`); fix any in-scope failure (depends on T023, T025).
- [x] T027 [US4] Run the converge assessment against `spec.md`/`plan.md`/`tasks.md` and append any genuinely remaining work (depends on T026).

---

## Dependencies & Execution Order

- **Setup**: T001 -> T002; T003 independent.
- **Foundational**: T004 -> T005.
- **US1**: T006, T007, T008, T009 independent; T010 after T004; T011 after T006/T007/T004; T012 after T010.
- **US2**: T013 -> T014, T015.
- **US3**: T016 -> T017, T018, T019; T021 independent; T020 after T021; T022 after T005.
- **US4**: T023 after all fixes; T024 after T023; T025 after setup and seed/UI fixes; T026 after all implementation; T027 after T026.

## Implementation Strategy

1. Build the audit/capture tooling and shared branding/failure primitives.
2. Close US1 and US2 while the baseline suites are green.
3. Seed Tenant B, update count-based expectations, then add the two-showroom e2e/a11y/perf coverage.
4. Write the report from fresh evidence, run the full checkpoint validation, and converge.
