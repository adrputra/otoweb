# Tasks: Admin Vehicle CRUD

**Input**: Design documents from `/specs/006-admin-vehicle-crud/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the roadmap requires server-side validation and the
end-to-end create → publish → public acceptance path needs proof.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1–US4)
- Exact file paths are included.

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Create the shared Zod vehicle schema, input type, id/lifecycle schemas, and `slugifyVehicle` in `lib/validation/vehicle.ts`
- [x] T002 [P] Add `getTenantVehicleById` to `lib/tenant/scoped-queries.ts` with UUID validation and tenant filtering
- [x] T003 [P] Add `lib/admin/context.ts` (`requireAdminTenantContext`) and switch `lib/tenant/server.ts` to the runtime `getAppDatabase()` so the admin surface works with the dev PGlite fallback

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story UI can be wired until these are complete.

- [x] T004 [US2] Implement the DB → admin `Vehicle` mapper and tenant-scoped read helpers in `lib/admin/vehicle-mapper.ts` and `lib/admin/vehicle-queries.ts` (depends on T002)
- [x] T005 [US1] Implement validated create/edit/lifecycle/duplicate/delete service functions with `withTenantSession` in `lib/admin/vehicle-service.ts` (depends on T001, T002)
- [x] T006 [US1] Implement the `'use server'` actions with tenant authorization and `revalidatePath` in `lib/admin/vehicle-actions.ts` (depends on T003, T005)
- [x] T007 [P] Write shared-schema unit tests in `tests/unit/validation/vehicle.test.ts` and service integration tests (create → publish → public, edit, reserve, sell, archive, duplicate, delete, cross-tenant, invalid input) in `tests/unit/admin/vehicle-service.test.ts` (depends on T001, T005)

---

## Phase 3: User Story 1 — Create and publish a vehicle (Priority: P1) 🎯 MVP

**Goal**: An admin can create a draft, publish it, and see it on the public site.

**Independent Test**: Create through the service/UI, assert the stored draft,
publish, then read `/cars` and `/cars/{slug}` for the same tenant.

### Implementation for User Story 1

- [x] T008 [US1] Rewire `components/vehicle-form.tsx` to the shared schema and real actions, add the required engine capacity, plate region, location, original price, owner count, and document fields, and keep the existing photo/preview styling (depends on T001, T006)
- [x] T009 [US1] Replace the new-vehicle page and edit page with server components that authorize and load from the database, rendering `VehicleForm` (depends on T004, T006, T008)
- [x] T010 [US1] Replace the mock admin vehicle list with a server page feeding a new client table that exposes publish and edit, preserving the existing table/mobile markup (depends on T004, T006)

---

## Phase 4: User Story 2 — Edit an existing vehicle (Priority: P2)

**Goal**: An admin can edit stored fields and publication state without breaking
the public URL.

**Independent Test**: Load a seeded vehicle, change price/description, save, and
re-read the row and public detail.

### Implementation for User Story 2

- [x] T011 [US2] Wire edit defaults and the stable existing slug into `VehicleForm` and surface server field errors without optimistic writes (depends on T008, T009)
- [x] T012 [US2] Remove the mock vehicle actions from `lib/actions.ts` and update the dashboard vehicle counts/recent list to the tenant-scoped read helpers (depends on T004, T010)

---

## Phase 5: User Story 3 — Manage lifecycle states (Priority: P3)

**Goal**: Reserve, sell, archive, duplicate, and delete persist correctly.

**Independent Test**: Apply each lifecycle action to a tenant vehicle and assert
stored status/timestamps, copy, and deletion; repeat against another tenant.

### Implementation for User Story 3

- [x] T013 [US3] Wire reserve, sell, archive, duplicate, and delete actions in the admin client table with error toasts and in-place updates (depends on T006, T010)
- [x] T014 [US3] Add the publish action for draft/archived rows and hide public preview for non-public rows (depends on T006, T010)

---

## Phase 6: User Story 4 — Tenant and permission boundaries (Priority: P4)

**Goal**: No cross-tenant or unauthorized access to the new write surface.

**Independent Test**: Run the service tests as Prima and Tenant B; assert
cross-tenant mutations return `not_found` and capabilities are enforced.

### Implementation for User Story 4

- [x] T015 [US4] Cover cross-tenant create/edit/publish/duplicate/delete denial and capability enforcement in `tests/unit/admin/vehicle-service.test.ts` (depends on T005, T007)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Browser acceptance, visual QA, documentation, and the checkpoint.

- [x] T016 [P] Add the QA fake GoTrue endpoint and Playwright admin config, and write `tests/e2e/admin-vehicles.spec.ts` covering UI create → publish → public visibility (depends on T008, T009, T010, T013, T014)
- [x] T017 [P] Add `scripts/visual-qa-admin.mjs` (desktop + mobile admin list/create/edit screenshots) and the `visual:qa:admin` package script (depends on T009, T010)
- [x] T018 [P] Document the admin CRUD data path, status transitions, and QA provider in `docs/ADMIN.md` and reference it from `docs/IMPLEMENTATION_STATUS.md` (depends on T001, T005, T011, T013)
- [x] T019 Run the full checkpoint: `npx tsc --noEmit`, `npm test`, the admin e2e spec, `impeccable detect` on changed UI, and the admin Visual QA capture; fix only in-scope defects (depends on T015, T016, T017, T018)

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1): starts immediately; T001–T003 are parallel.
- Foundational (Phase 2): T004/T005 depend on Setup; T006 depends on T003/T005;
  T007 depends on T001/T005.
- US1 (Phase 3): T008 depends on T001/T006; T009 on T004/T006/T008; T010 on
  T004/T006.
- US2 (Phase 4): T011 on T008/T009; T012 on T004/T010.
- US3 (Phase 5): T013/T014 on T006/T010.
- US4 (Phase 6): T015 extends T007 after the service exists.
- Polish (Phase 7): T016/T017 after the UI; T018 after the service/UI; T019
  after everything.

### Within each story

Validation/service first, then actions, then client wiring, then tests. No story
starts before its listed dependencies are ticked.

### Parallel opportunities

- T001, T002, T003 (different files).
- T007 can run alongside the US1 UI once T005 is green.
- T016, T017, T018 are independent files once the UI is stable.
