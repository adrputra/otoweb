# Tasks: Lead Capture

**Input**: Design documents from `/specs/009-lead-capture/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included — tenant isolation, validation, status persistence, the
public-inquiry-to-dashboard loop, and WhatsApp tracking are explicit acceptance
requirements.

**Organization**: Tasks are grouped by user story. Every task names exact file
paths.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US3
- Dependencies are written as `(depends on T###, ...)`

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Add the `lead_source` and `lead_status` enums, the tenant-owned `leads` table with nullable contact fields and optional vehicle reference, indexes, relations, and inferred types in `db/schema.ts`
- [x] T002 [P] Define the client-safe lead contact input schema, contact-form field rules (name 1–120, phone 6–32, optional email ≤254, message 1–2,000), UUID/status schemas, and status option metadata in `lib/validation/lead.ts`
- [x] T003 Generate the `leads` table migration with Drizzle Kit and append `ENABLE`/`FORCE ROW LEVEL SECURITY` plus a tenant-isolation `FOR ALL` policy to `db/migrations/0002_*.sql` (depends on T001)
- [x] T004 [P] Replace the legacy `Lead` view type with source/status unions and vehicle label, and remove the mock lead array and `updateLead` action from `lib/types.ts`, `data/index.ts`, and `lib/actions.ts` (depends on T001)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: The public form, WhatsApp route, and admin dashboard cannot be
wired until this phase is complete.

- [x] T005 Implement tenant-scoped public lead creation (contact submission and WhatsApp inquiry with optional same-tenant vehicle association) and the `'use server'` contact action that resolves the public tenant in `lib/public/lead-service.ts` and `lib/public/lead-actions.ts` (depends on T001, T002)
- [x] T006 Implement the tenant-scoped lead mapper, admin list/summary queries, and status-update service with `withTenantSession` and cross-tenant rejection in `lib/admin/lead-mapper.ts`, `lib/admin/lead-queries.ts`, and `lib/admin/lead-service.ts` (depends on T001, T002, T004)
- [x] T007 Implement the `'use server'` status-update action with `manage_leads` authorization and admin path revalidation in `lib/admin/lead-actions.ts` (depends on T006)

**Checkpoint**: The lead data path, public creation service, and admin service
are ready for the interface tasks.

---

## Phase 3: User Story 1 — Submit an inquiry and create a tenant lead (Priority: P1) 🎯 MVP

**Goal**: A public contact submission becomes a `new` lead for the hostname's
tenant, with validation and a clear success state.

**Independent Test**: Submit a distinctive contact entry on the Prima hostname,
assert one Prima `contact_form` lead exists with the submitted values, assert
Tenant B has none, and assert invalid input writes nothing.

### Implementation for User Story 1

- [x] T008 Build the public contact form with name, phone, optional email, message, client validation, pending/success/error states, and wire it into the existing home contact section in `components/public-contact-form.tsx` and `app/page.tsx` (depends on T002, T005)
- [x] T009 Add validation and public lead-service tests for valid submission, invalid input, anonymous WhatsApp lead creation, same-tenant vehicle association, and foreign-slug rejection in `tests/unit/validation/lead.test.ts` and `tests/unit/public/lead-capture.test.ts` (depends on T002, T005)

**Checkpoint**: The customer inquiry half of the acceptance loop is complete and
independently testable.

---

## Phase 4: User Story 2 — Review and update leads in the admin dashboard (Priority: P2)

**Goal**: An authorized member sees only the tenant's leads, filters them, and
persists any of the five roadmap statuses; the dashboard home shows real counts.

**Independent Test**: Open `/admin/leads` as the Prima owner, change a lead from
`new` to `contacted`, reload, and assert the status and summary counts; assert
Tenant B data is absent and a cross-tenant id update writes nothing.

### Implementation for User Story 2

- [x] T010 Build the server-rendered admin lead page and client dashboard table with summary cards, search, status/source filters, vehicle context, WhatsApp reply, empty state, and status updates in `app/admin/leads/page.tsx` and `components/admin/lead-table.tsx` (depends on T006, T007)
- [x] T011 Wire the admin dashboard home to real tenant lead counts and recent leads instead of the mock array in `app/admin/page.tsx` (depends on T006)
- [x] T012 Add admin query/service tests for tenant scoping, summary counts, status round-trip, invalid status, unknown id, and cross-tenant update rejection in `tests/unit/admin/leads.test.ts` (depends on T006, T007)
- [x] T013 Add the admin Playwright acceptance test for contact submission, dashboard visibility, and status persistence, and include it in `playwright.admin.config.ts` (depends on T008, T010, T011)

**Checkpoint**: The full inquiry -> tenant lead -> admin dashboard acceptance
loop is demonstrable.

---

## Phase 5: User Story 3 — Track WhatsApp inquiries (Priority: P3)

**Goal**: WhatsApp actions record a durable tenant lead before redirecting to the
tenant's configured number, with optional vehicle context.

**Independent Test**: Request the Prima vehicle WhatsApp route, assert a
`whatsapp` lead tied to that vehicle and a `wa.me` redirect, and assert a foreign
vehicle slug or another tenant creates no cross-tenant association.

### Implementation for User Story 3

- [x] T014 Implement the public WhatsApp tracking redirect with tenant resolution, optional same-tenant vehicle lookup, durable lead insert, configured-number redirect, and no-number fallback in `app/api/public/whatsapp/route.ts` (depends on T005)
- [x] T015 Point the vehicle-detail and footer WhatsApp CTAs at the tracking route with vehicle context where applicable in `app/cars/[slug]/page.tsx` and `components/public-footer.tsx` (depends on T014)
- [x] T016 Extend the restricted-role RLS suite and lead isolation tests to cover `leads` reads, inserts, updates, deletes, and cross-tenant ids in `tests/unit/tenant/rls.test.ts` (depends on T003, T005, T006)
- [x] T017 Add WhatsApp route/service tests for tenant resolution, vehicle association, foreign-slug fallback, missing-number fallback, and no-tenant rejection in `tests/unit/public/whatsapp-tracking.test.ts` (depends on T014)

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T018 [P] Document the lead model, sources/statuses, public form, WhatsApp tracking, dashboard, isolation, and verification in `docs/LEADS.md` and cross-reference it from `docs/DATABASE.md`, `docs/ADMIN.md`, and `docs/PUBLIC_SITE.md` (depends on T010, T011, T015)
- [x] T019 Build and run the F010 desktop/mobile visual QA capture for the public contact form and admin lead dashboard, run the Impeccable detector on changed UI, and record evidence in `scripts/visual-qa-leads.mjs` and `.visual-qa/` (depends on T013, T015)
- [x] T020 Run the converge pass, append any missing work, and run the full validation checkpoint (`npx tsc --noEmit`, `npm test`) with fresh output (depends on T018, T019)

---

## Dependencies & Execution Order

### Phase dependencies

- Setup (T001–T004) establishes the schema, validation contract, migration/RLS,
  and the shared view model.
- Foundational (T005–T007) blocks all three user stories.
- US1 (T008–T009) is the MVP and produces the public inquiry path.
- US2 (T010–T013) consumes the admin service and proves the dashboard loop.
- US3 (T014–T017) adds WhatsApp tracking and hardens isolation.
- Polish (T018–T020) completes documentation, visual evidence, convergence, and
  the checkpoint.

### Parallel opportunities

- T001 and T002 touch different files; T004 depends only on T001.
- T005 and T006 can run in parallel once T001/T002/T004 land.
- T008 and T009 can run in parallel once T005 lands.
- T010, T011, T012 can run in parallel once T006/T007 land.
- T014 and T016 can run in parallel once T005/T006 land.
- T018 and T019 touch different paths.

### Suggested MVP

T001–T009 delivers the schema, tenant-safe public inquiry, and validation proof.
T010–T013 completes the admin acceptance loop; T014–T017 adds WhatsApp tracking;
T018–T020 closes docs, visual QA, and validation.

## Format Validation

Every task starts with a checkbox + `T###` id, uses `[P]` only where files are
independent, carries a `[USn]` label inside user-story phases, and names exact
file paths.
