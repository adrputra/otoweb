# Tasks: Image Management

**Input**: Design documents from `/specs/007-image-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — the roadmap requires the full workflow to be proven with
approximately 15 high-resolution images, and media policy correctness needs
explicit coverage.

**Organization**: Tasks are grouped by user story. Every task names exact file
paths.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4
- Dependencies are written as `(depends on T###, ...)`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Define client-safe media limits, provider types/errors, and the Cloudinary/Unsplash/local responsive URL builder in `lib/media/limits.ts`, `lib/media/types.ts`, and `lib/media/urls.ts`
- [x] T002 [P] Implement magic-byte and dimension inspection for JPEG/PNG/WebP with size and resolution validation in `lib/media/inspect.ts`
- [x] T003 [P] Implement the signed Cloudinary REST provider (upload, destroy, error classification, timeout, injectable fetch) in `lib/media/cloudinary.ts`
- [x] T004 [P] Implement the deterministic local fake provider and bounded transient retry helper in `lib/media/fake.ts` and `lib/media/retry.ts`
- [x] T005 [P] Create deterministic high-resolution PNG test-image helpers (3000×2000, distinct colors, CRC-valid) in `tests/helpers/image-fixtures.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: The service, routes, and UI cannot be wired until this phase is complete.

- [x] T006 Implement environment-based provider resolution (Cloudinary complete config, explicit dev fake, production error) and validate partial credentials in `lib/media/provider.ts`, `scripts/validate-env.mjs`, and `.env.example` (depends on T001, T003, T004)
- [x] T007 Implement the tenant-scoped vehicle image service (list, upload with deterministic identity and dedupe, reorder, cover, delete with compaction) and the alt/reorder/cover Zod schemas in `lib/admin/vehicle-image-service.ts` and `lib/validation/vehicle-image.ts` (depends on T001, T002, T004, T006)
- [x] T008 Implement reference-counted best-effort media cleanup and extend `deleteVehicle` to capture candidates before the cascade and report a cleanup summary in `lib/admin/media-cleanup.ts` and `lib/admin/vehicle-service.ts` (depends on T007)
- [x] T009 Add a non-redirecting `requireAdminApiContext` and the upload/reorder/cover/delete route handlers in `lib/admin/context.ts`, `app/api/admin/vehicles/[id]/images/route.ts`, and `app/api/admin/vehicles/[id]/images/[imageId]/route.ts` (depends on T006, T007)

---

## Phase 3: User Story 1 — Upload with progress (Priority: P1) 🎯 MVP

**Goal**: An admin uploads one or many high-resolution photos with per-file
progress, server validation, and reliable retries.

**Independent Test**: Upload 15 generated 3000×2000 images to one vehicle with
an injected fake provider; all rows store, progress reaches 100, a transient
failure retries without duplication, and invalid files are rejected.

### Implementation for User Story 1

- [x] T010 [US1] Implement the browser XHR uploader with per-file progress, bounded transient retry, abort timeout, and structured errors in `lib/media/client-upload.ts` (depends on T001)
- [x] T011 [US1] Build `VehicleImageManager` with selection, per-file progress, client validation, retry, and empty state, and wire it into `components/vehicle-form.tsx` including queued-upload-after-create in `components/admin/vehicle-image-manager.tsx` and `components/vehicle-form.tsx` (depends on T009, T010)
- [x] T012 [US1] Add media unit tests for inspection/validation, Cloudinary signing/error classification, URL optimization, provider resolution, and client progress/retry in `tests/unit/media/inspect.test.ts`, `tests/unit/media/cloudinary.test.ts`, `tests/unit/media/urls.test.ts`, `tests/unit/media/provider.test.ts`, and `tests/unit/media/client-upload.test.ts` (depends on T002, T003, T010)
- [x] T013 [US1] Add the 15-high-resolution-image integration test plus upload validation, dedupe, retry, and tenant fixtures in `tests/unit/admin/vehicle-images.test.ts` (depends on T005, T007)

---

## Phase 4: User Story 2 — Reorder and cover (Priority: P2)

**Goal**: Persisted ordering and cover selection visible on reload and on the
public detail page.

**Independent Test**: Upload three photos, change order and cover, reload, and
read the public vehicle; positions are contiguous and the cover is first.

### Implementation for User Story 2

- [x] T014 [US2] Persist drag/up-down reordering and cover selection in `VehicleImageManager` with optimistic updates and rollback on failure in `components/admin/vehicle-image-manager.tsx` (depends on T011)
- [x] T015 [US2] Add provider-aware optimized thumbnail URLs, cover-first public ordering, the extended `VehicleImage` view type, and use the thumbnail in public cards in `lib/types.ts`, `lib/admin/vehicle-mapper.ts`, `lib/public/queries.ts`, and `components/showroom.tsx` (depends on T001, T007)
- [x] T016 [US2] Add reorder/cover persistence, invalid-set atomicity, dedupe, optimized-URL, and public-cover tests in `tests/unit/admin/vehicle-images.test.ts` and `tests/unit/media/urls.test.ts` (depends on T014, T015)

---

## Phase 5: User Story 3 — Deletion and media policy (Priority: P3)

**Goal**: Photo and vehicle deletion removes DB rows, compacts positions,
promotes a cover, and destroys provider assets only when unreferenced.

**Independent Test**: Delete a cover photo, delete a duplicated vehicle and its
original, and assert shared assets survive until the last reference is removed;
seed/external assets are never destroyed and provider failures do not block.

### Implementation for User Story 3

- [x] T017 [US3] Wire photo deletion and vehicle-deletion media summaries into the form and admin table, including failure messaging in `components/admin/vehicle-image-manager.tsx` and `components/admin/vehicle-table.tsx` (depends on T008, T014)
- [x] T018 [US3] Add deletion, cover-promotion, shared-reference, external-asset, cleanup-failure, and vehicle-cascade tests in `tests/unit/admin/vehicle-images.test.ts` and `tests/unit/admin/vehicle-service.test.ts` (depends on T013, T017)
- [x] T019 [US3] Add the admin Playwright image workflow (15 uploads, reorder, cover, delete) and enable the spec in `tests/e2e/admin-vehicle-images.spec.ts` and `playwright.admin.config.ts` (depends on T014, T017)

---

## Phase 6: User Story 4 — Tenant boundaries (Priority: P4)

**Goal**: Every image operation is tenant- and capability-scoped.

**Independent Test**: As Tenant B, attempt upload/reorder/cover/delete on a
Prima vehicle and assert rejection with zero provider calls and zero writes.

### Implementation for User Story 4

- [x] T020 [US4] Add cross-tenant service assertions and API authorization tests for unauthenticated, forbidden, and mismatched-tenant requests in `tests/unit/admin/vehicle-images.test.ts` and `tests/unit/admin/vehicle-image-api.test.ts` (depends on T013, T018)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T021 Document production Cloudinary configuration, provider selection, limits, media policy, and verification in `docs/MEDIA.md`, and update the images/verification sections of `docs/ADMIN.md` and `docs/DATABASE.md` (depends on T018)
- [x] T022 Extend the admin Visual QA capture for the image manager, run the Impeccable detector, fix findings in one batch, and record desktop/mobile evidence under `.visual-qa/` in `scripts/visual-qa-admin.mjs` (depends on T019, T021)
- [x] T023 Run the converge pass, recompute waves if it appends tasks, and run the full validation checkpoint (`npx tsc --noEmit`, `npm test`) with fresh output (depends on T022)

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (T001–T005) has no dependencies and can run in parallel.
- Foundational (T006–T009) blocks every user story.
- US1 (T010–T013) is the MVP and blocks US2's UI work.
- US2 (T014–T016), US3 (T017–T019), and US4 (T020) build on the service and UI.
- Polish (T021–T023) completes documentation, visual QA, and the checkpoint.

### Parallel opportunities

- T001–T005: different files, all parallel.
- T008 and T009: both depend on T007 but touch different files.
- T012 and T013: test files are independent once their implementations land.
- T015 and T014: mapper and UI files are independent.
- T018 and T019: unit and E2E test files can be authored independently.

### Suggested MVP

T001–T013 delivers upload with progress, validation, reliability, and 15-image
proof. T014–T020 add ordering, cover, deletion policy, and boundaries; T021–T023
close documentation, visual QA, and the checkpoint.

## Format Validation

Every task starts with a checkbox + `T###` id, uses `[P]` only where files are
independent, carries a `[USn]` label inside user-story phases, and names exact
file paths.

---

## Phase 8: Convergence

- [x] T024 Clean up the uploaded provider asset when the post-upload database insert fails or the vehicle disappears, without deleting an asset another row already references, per `plan: media policy` (partial)
