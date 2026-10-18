# Tasks: Showroom Settings

**Input**: Design documents from `/specs/008-showroom-settings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — tenant isolation, validation, media reuse, public mapping,
and the save-to-public loop are explicit acceptance requirements.

**Organization**: Tasks are grouped by user story. Every task names exact file
paths.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3
- Dependencies are written as `(depends on T###, ...)`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Define the shared, client-safe showroom settings Zod schema plus URL/email/color/phone rules and social-handle normalizers in `lib/validation/showroom-settings.ts`
- [x] T002 [P] Implement pure color parsing, contrast foreground, accessible accent derivation, and CSS custom-property mapping in `lib/theme.ts`
- [x] T003 [P] Implement the tenant SEO metadata mapper (title, description, logo icon, safe fallbacks) in `lib/public/metadata.ts`
- [x] T004 Extend the `Showroom` view model with province/postal code and map every stored showroom column, including logo and social links, in `lib/types.ts` and `lib/public/queries.ts`
- [x] T009 [P] Add optional extra multipart fields to the shared browser uploader so settings uploads can send `kind` in `lib/media/client-upload.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: The editor, action, and public pages cannot be wired until this phase is complete.

- [x] T005 Implement the tenant-scoped showroom settings read/update service with defaults for a missing row, empty-to-null mapping, and insert-or-update behaviour in `lib/admin/showroom-settings-service.ts` (depends on T001)
- [x] T006 Implement the deterministic logo/hero media service and the authorized `POST /api/admin/settings/media` route using the F008 inspector, provider resolution, retry, and folder naming in `lib/admin/showroom-media-service.ts` and `app/api/admin/settings/media/route.ts` (depends on T005)
- [x] T007 Implement the `'use server'` save action with `manage_settings` authorization and public/admin path revalidation in `lib/admin/showroom-settings-actions.ts` (depends on T005)
- [x] T008 Resolve the tenant display name and city in the admin layout and expose them to the shell/page header through context instead of hard-coded Prima copy in `app/admin/layout.tsx` and `components/admin-shell.tsx` (depends on T005)

---

## Phase 3: User Story 1 — Edit the showroom profile (Priority: P1) 🎯 MVP

**Goal**: An authorized owner loads, edits, uploads media for, and saves every
roadmap field for the active tenant.

**Independent Test**: Change every field for the Prima fixture, upload logo and
hero images through the fake provider, save, reload, and assert the stored
values; submit invalid values and assert zero writes.

### Implementation for User Story 1

- [x] T010 [US1] Build the client `ShowroomSettingsForm` with database-loaded sections for identity, brand, contact, address, social links, opening hours, SEO, color fields, logo/hero upload progress, live preview, unsaved warning, field errors, and save toasts in `components/admin/showroom-settings-form.tsx` (depends on T001, T002, T006, T007, T009)
- [x] T011 [US1] Replace the static mock settings route with a server-rendered page that requires `manage_settings`, loads the tenant's stored row, and passes form values to the editor in `app/admin/settings/showroom/page.tsx` (depends on T005, T010)
- [x] T012 [US1] Add schema tests for required fields, length/email/URL/color/phone rules, social normalization, and empty-value handling in `tests/unit/validation/showroom-settings.test.ts` (depends on T001)
- [x] T013 [US1] Add service tests for full-field round-trip, empty-to-null, missing-row creation, updated timestamp, and public mapping after save in `tests/unit/admin/showroom-settings.test.ts` (depends on T005)
- [x] T014 [US1] Add media tests for tenant-scoped deterministic asset ids, logo/hero kinds, content validation rejection, provider upload, and no write without a file in `tests/unit/admin/showroom-media.test.ts` (depends on T006)
- [x] T015 [US1] Add the admin Playwright save-to-public test, including metadata and a reload assertion, and include the spec in `tests/e2e/admin-showroom-settings.spec.ts` and `playwright.admin.config.ts` (depends on T009, T011)

---

## Phase 4: User Story 2 — Public website reflects configuration (Priority: P2)

**Goal**: The public home, inventory, and detail surfaces render the saved
configuration and tenant-derived accents, with metadata, without a deployment.

**Independent Test**: Save a distinctive configuration, request the public
routes for both fixtures, and assert the rendered values, CSS accent variables,
and generated metadata differ per tenant and match the database.

### Implementation for User Story 2

- [x] T016 [US2] Apply tenant theme variables and render the logo, contact details, full address, opening hours, and social links across the public home, inventory, detail, and shared header components in `components/showroom.tsx`, `app/page.tsx`, `app/cars/page.tsx`, and `app/cars/[slug]/page.tsx` (depends on T002, T004)
- [x] T017 [US2] Call the tenant SEO metadata mapper from the public home, inventory, and detail routes in `app/page.tsx`, `app/cars/page.tsx`, and `app/cars/[slug]/page.tsx` (depends on T003, T004, T016)
- [x] T018 [US2] Add public mapping and theme tests covering all editable fields, per-tenant differences, metadata fallbacks, and accessible accent derivation in `tests/unit/public/showroom-settings.test.ts` and `tests/unit/theme.test.ts` (depends on T004, T016, T017)

---

## Phase 5: User Story 3 — Tenant-scoped settings and permissions (Priority: P3)

**Goal**: Settings and uploads are limited to the active tenant and
`manage_settings`; staff and cross-tenant requests are rejected.

**Independent Test**: As Tenant B, write settings and assert Prima is unchanged;
call the upload route without a session and as staff and assert zero provider
calls.

### Implementation for User Story 3

- [x] T019 [US3] Add explicit cross-tenant service assertions and upload-route authorization tests for no session, staff, and tenant mismatch in `tests/unit/admin/showroom-settings.test.ts` and `tests/unit/admin/showroom-settings-api.test.ts` (depends on T006, T007, T013)

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T020 [P] Document the settings fields, theming, media reuse, metadata, verification, and boundaries in `docs/SHOWROOM_SETTINGS.md` and update the settings/verification sections of `docs/ADMIN.md`, `docs/PUBLIC_SITE.md`, and `docs/DATABASE.md` (depends on T017, T019)
- [x] T021 Build and run the F009 desktop/mobile visual QA capture (admin editor + public site, per-tenant accents, save-without-deploy), run the Impeccable detector on changed UI, and record evidence in `scripts/visual-qa-showroom.mjs` and `.visual-qa/` (depends on T015, T016, T017)
- [x] T022 Run the converge pass, recompute waves if tasks are appended, and run the full validation checkpoint (`npx tsc --noEmit`, `npm test`) with fresh output (depends on T020, T021)

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (T001–T004, T009) has no cross-file dependencies and can run in parallel
  except T004, which depends only on the existing schema.
- Foundational (T005–T008) blocks every user story.
- US1 (T010–T015) is the MVP and produces the editor and save path.
- US2 (T016–T018) consumes the service and view model; it does not block US1.
- US3 (T019) hardens the boundary after the service, route, and action exist.
- Polish (T020–T022) completes documentation, visual evidence, convergence, and
  the checkpoint.

### Parallel opportunities

- T001, T002, T003, T004, T009 touch different files.
- T006, T007, T008 all depend on T005 but touch different files.
- T012, T013, T014 are independent test files once their implementations land.
- T016 and T017 are the same page files; sequence them.
- T018 and T019 are independent test files.
- T020 and T021 touch different paths.

### Suggested MVP

T001–T015 delivers the complete editor, uploads, validation, persistence, and
tenant-safe save path. T016–T019 makes the public reflection and boundaries
explicit; T020–T022 closes documentation, visual QA, and the checkpoint.

## Format Validation

Every task starts with a checkbox + `T###` id, uses `[P]` only where files are
independent, carries a `[USn]` label inside user-story phases, and names exact
file paths.
