---
description: "Task list for Connect Public Website to Database"
---

# Tasks: Connect Public Website to Database

**Input**: Design documents from `/specs/005-public-website-database/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: The specification explicitly requires automated proof for tenant scope,
filtering, sorting, featured selection, detail/related lookup, and the mock-import
boundary, so test tasks are included. Visual QA is mandatory for the changed public
surfaces.

**Organization**: Tasks follow the user stories in priority order. The shared data
layer is built first; each public surface then gets its own wiring and proof.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Include exact file paths in descriptions

## Path Conventions

- Public data access: `lib/public/`, `lib/repositories.ts`, `lib/db/runtime.ts`
- Public pages/components: `app/`, `components/showroom.tsx`
- Tests: `tests/unit/public/`, `tests/e2e/`
- Visual QA: `scripts/visual-qa.mjs`, `.visual-qa/`
- Documentation: `docs/PUBLIC_SITE.md`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the tenant lookup, local database runtime, and configuration the
public data layer needs.

- [x] T001 [P] Add `findTenantBySlug(db, slug)` to `lib/tenant/memberships.ts` returning only usable tenants and `null` for unknown slugs.
- [x] T002 [P] Create `lib/db/runtime.ts` exporting `getAppDatabase()`: use `DATABASE_URL` via `db/client.ts`, otherwise use a cached in-memory PGlite database with committed migrations and seed in development only, and throw in production.
- [x] T003 [P] Configure `next.config.mjs` with `serverExternalPackages: ['@electric-sql/pglite']` and update `.env.example` plus `scripts/validate-env.mjs` so the development showroom slug matches the seeded `prima-auto-gallery` tenant.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the tenant resolver and the pure tenant-scoped query/mapping
layer that every public surface uses.

**⚠️ CRITICAL**: No public page work can begin until this phase is complete.

- [x] T004 [P] Create `lib/public/queries.ts` with `normalizeVehicleFilters`, `listPublicVehicles`, `listFeaturedVehicles`, `listPublicVehicleBrands`, `getPublicVehicleBySlug`, `listRelatedPublicVehicles`, and `getShowroomForTenant`; every function must call `requireTenantId` and filter by tenant id (depends on T001).
- [x] T005 [P] Create `lib/public/tenant.ts` with injectable `resolvePublicTenant({ db?, hostname? })` and cached `getPublicTenant()`: verified-hostname resolution first, development-only configured-slug fallback, no production fallback, server-only guard (depends on T001, T002).
- [x] T006 Rewrite `lib/repositories.ts` as the page-facing public facade over `lib/public/queries.ts`: `getShowroom`, `listVehicles`, `listVehicleBrands`, `getVehicleBySlug`, `getRelatedVehicles`; no mock-catalogue import (depends on T004, T005).
- [x] T007 [P] Move `app/admin/page.tsx` back to the legacy `data/index.ts` arrays it used before this feature, so the public repository has no admin/mock dependency (depends on T006 for the removed exports).

**Checkpoint**: The tenant resolver, query layer, and repository facade exist and compile.

---

## Phase 3: User Story 1 - Tenant showroom backed by real settings (Priority: P1) 🎯 MVP

**Goal**: The home, inventory, and detail pages receive the resolved tenant's
showroom from `showroom_settings` and guard the no-tenant case.

**Independent Test**: Open the home through the Prima and Tenant B hostnames; each
renders its own stored name, tagline, hero, contact, and address.

### Implementation for User Story 1

- [x] T008 [US1] Update `app/page.tsx` to resolve the showroom and vehicles from the repository, call `notFound()` when no tenant resolves, use the stored hero image directly, and derive the about heading from the showroom name (depends on T006).
- [x] T009 [US1] Update `app/cars/page.tsx` to resolve the showroom, guard the no-tenant case, and use the stored showroom name in the header (depends on T006).
- [x] T010 [US1] Update `app/cars/[slug]/page.tsx` to guard the showroom before rendering and keep the existing detail markup and status/WhatsApp behaviour (depends on T006).

**Checkpoint**: US1 renders stored showroom settings for each tenant.

---

## Phase 4: User Story 2 - Inventory filters and sorting (Priority: P2)

**Goal**: Inventory filtering and sorting operate on database rows and the public
brand options come from the tenant's inventory.

**Independent Test**: Apply each filter and sort option to the seeded Prima
inventory and assert the returned rows match the predicate and order.

### Implementation for User Story 2

- [x] T011 [US2] Update `components/showroom.tsx` so `QuickSearch` and `Filters` accept tenant-derived `brands` plus current filter values; replace the hardcoded brand arrays without changing markup or classes (depends on T006).
- [x] T012 [US2] Wire `listVehicleBrands()` and the current search params into `app/page.tsx` and `app/cars/page.tsx` so quick search and inventory selects reflect the tenant's real brands and active filters (depends on T008, T009, T011).

**Checkpoint**: Filtering, sorting, counts, and empty state work on tenant data.

---

## Phase 5: User Story 3 - Vehicle detail and related units (Priority: P3)

**Goal**: Detail lookup and related units are tenant-scoped and public-status-aware.

**Independent Test**: Request a seeded slug, a draft slug, a cross-tenant slug, and
the related set; assert exact data, not-found behaviour, body-type matching,
current-unit exclusion, and the three-unit limit.

### Tests for User Story 3

- [x] T013 [P] [US3] Create `tests/unit/public/repositories.test.ts` using the existing PGlite tenant harness to prove showroom mapping, listing, featured selection, every filter, every sort, public-status exclusion, detail lookup, cross-tenant not-found, related selection, and tenant-B isolation (depends on T004).
- [x] T014 [P] [US3] Create `tests/unit/public/no-mock-catalogue.test.ts` scanning the public runtime modules for `@/data`, `../data`, or `data/index` imports (depends on T006, T008, T009, T010, T011).

**Checkpoint**: US3 is independently verified at the SQL/mapping layer.

---

## Phase 6: User Story 4 - Featured units from the database (Priority: P4)

**Goal**: The home featured grid is driven by the stored `featured` flag for public
tenant vehicles.

**Independent Test**: Toggle a stored vehicle's featured flag and assert the home
query result changes, including tenant and status isolation.

### Implementation for User Story 4

- [x] T015 [US4] Add the featured-grid query to `app/page.tsx` via `listFeaturedVehicles()` instead of filtering the full listing in the page, and prove it in `tests/unit/public/repositories.test.ts` (depends on T008, T013).

**Checkpoint**: Featured units are demonstrably database-driven.

---

## Phase 7: User Story 5 - Preserve the visual design (Priority: P5)

**Goal**: The changed public surfaces keep the incumbent design and receive a fresh
desktop + mobile Visual QA pass.

**Independent Test**: Run the public Visual QA capture and compare the screenshots
against the incumbent layout.

### Tests for User Story 5

- [x] T016 [P] [US5] Update `scripts/visual-qa.mjs` to capture the public home, inventory, vehicle detail, and Tenant B home at desktop 1440×900 and mobile 390×844 using Chromium host-resolver rules for `prima.otoweb.id` and `tenant-b.otoweb.id`, checking a visible heading, no horizontal overflow, and the expected tenant name.
- [x] T017 [P] [US5] Update `playwright.config.ts` with the same Chromium host-resolver rule and update `tests/e2e/home.spec.ts` to assert database-backed Prima content through the Prima hostname.
- [x] T018 [P] [US5] Create `docs/PUBLIC_SITE.md` documenting the public data path, tenant resolution, public status model, development PGlite fallback, and how to run the public tests and Visual QA.

### Implementation for User Story 5

- [x] T019 [US5] Run `npx tsc --noEmit`, `npm test`, and the affected Playwright home test; fix only in-scope failures and capture fresh output (depends on T013, T014, T015, T016, T017).
- [x] T020 [US5] Run `pnpm visual:qa` and the impeccable mechanical detector on the changed UI; store screenshots and reports under `.visual-qa/` and require a PASS verdict (depends on T016, T019).

**Checkpoint**: The feature is complete only with a fresh passing Visual QA verdict.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: T001, T002, T003 can run in parallel.
- **Foundational (Phase 2)**: T004 and T005 depend on T001/T002; T006 depends on both; T007 depends on T006.
- **US1 (Phase 3)**: T008–T010 depend on T006 and can run in parallel with each other.
- **US2 (Phase 4)**: T011 depends on T006; T012 depends on T008, T009, T011.
- **US3 (Phase 5)**: T013 depends on T004; T014 depends on T006 and the page/component wiring.
- **US4 (Phase 6)**: T015 depends on T008 and T013.
- **US5 (Phase 7)**: T016–T018 can run in parallel after the UI wiring; T019 depends on tests; T020 depends on T016 and T019.

## Parallel Opportunities

- T001, T002, T003
- T004, T005
- T008, T009, T010
- T013, T014
- T016, T017, T018

## Implementation Strategy

1. Build the shared database runtime and tenant resolver.
2. Build the pure query/mapping layer and the repository facade.
3. Wire the showroom surfaces (P1), then inventory filters/sorting (P2), then
   detail/related (P3), then featured (P4).
4. Prove the data boundary with PGlite tests and the source scan.
5. Run the full gates, the affected e2e smoke test, and one Visual QA capture.
