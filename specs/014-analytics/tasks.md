---
description: "Task list for analytics"
---

# Tasks: Analytics

**Input**: Design documents from `/specs/014-analytics/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. Analytics touches public rendering, lead capture, tenant
isolation, and an admin surface, so each story carries focused tests and the
feature requires fresh visual evidence.

**Organization**: Tasks are grouped by user story. US1 is public event tracking,
US2 is the admin dashboard metrics, and US3 is isolation and non-blocking
safety. Setup and foundational work must finish first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the additive analytics schema and public transport foundation.

- [x] T001 Add `analyticsEventType` and the `analyticsEvents` table (tenant, event type, nullable vehicle, jsonb metadata, path, created_at, indexes) to `db/schema.ts`, including `tenants`/`vehicles` relation entries.
- [x] T002 Generate `db/migrations/0004_analytics.sql` and the Drizzle meta snapshot from `db/schema.ts`, then append the forced tenant-isolation RLS policy for `analytics_events` following the `0001`/`0002` pattern (depends on T001).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared event contract and a recorder that can never break a caller.

- [x] T003 Create `lib/analytics/events.ts` with the six event types, the four public event types, recognized inventory/filter keys, payload size limits, and pure normalization helpers for event, vehicle slug, path, filters, and share method (depends on T001).
- [x] T004 Create `lib/analytics/record.ts` with `recordAnalyticsEvent(db, tenantId, input): Promise<boolean>` that validates the tenant, resolves an optional same-tenant vehicle by slug or id, inserts the event, and swallows every error (depends on T002, T003).
- [x] T005 [P] Add normalization and rejection tests in `tests/unit/analytics/events.test.ts` for all six types, supported/unknown filter keys, oversized values, invalid paths, and public/server-only event separation (depends on T003).
- [x] T006 [P] Add recorder tests in `tests/unit/analytics/recording.test.ts` covering all event types, same-tenant vehicle linking, foreign/missing slug handling, bounded metadata, tenant rejection, and a failing insert returning `false` without throwing (depends on T004).
- [x] T007 Create `app/api/public/analytics/route.ts` (public beacon, quiet 204 responses, 405 for non-POST) and `lib/analytics/client.ts` (`sendBeacon` with `fetch` keepalive fallback, never throws) (depends on T004).

**Checkpoint**: Schema, recorder, and public beacon exist; event production can start.

---

## Phase 3: User Story 1 - Record showroom interactions (Priority: P1) 🎯 MVP

**Goal**: Every public interaction records the correct tenant-scoped event, and lead-backed events reuse the existing lead writes.

**Independent Test**: Drive all six interactions against the seeded Prima tenant and confirm one event of each type, with WhatsApp and contact events appearing only after their leads exist.

### Implementation for User Story 1

- [x] T008 [US1] Create `components/analytics/page-trackers.tsx` with a once-per-mount `VehicleViewTracker` and an `InventoryTracker` that emits `inventory_search` and/or `filter_use`, then mount them in `app/cars/[slug]/page.tsx` and `app/cars/page.tsx` (depends on T007).
- [x] T009 [US1] Create `components/analytics/vehicle-share-button.tsx` using the Web Share API with a clipboard fallback and a `vehicle_share` event on success, and replace the inert share button in `app/cars/[slug]/page.tsx` (depends on T007).
- [x] T010 [US1] Record `contact_submit` in `lib/public/lead-actions.ts` after `createContactLead` succeeds, without changing the returned result when analytics fails (depends on T004).
- [x] T011 [US1] Record `whatsapp_click` in `app/api/public/whatsapp/route.ts` after `createWhatsappLead` succeeds, reusing the lead's vehicle id and preserving the existing redirect behavior (depends on T004).
- [x] T012 [P] [US1] Add `tests/unit/analytics/beacon-route.test.ts` covering valid storage, unknown tenant, invalid JSON/event, oversized payload, analytics failure, and 405 (depends on T007).
- [x] T013 [P] [US1] Add `tests/unit/analytics/lead-events.test.ts` and extend `tests/unit/public/whatsapp-tracking.test.ts` to prove `contact_submit`/`whatsapp_click` are recorded only after successful leads and never block lead capture (depends on T010, T011).
- [x] T014 [P] [US1] Add `tests/unit/analytics/trackers.test.tsx` for once-per-mount trackers, search/filter classification, native share, clipboard fallback, share cancellation, and swallowed tracker errors (depends on T008, T009).
- [x] T015 [P] [US1] Create `docs/ANALYTICS.md` documenting the six events, payload contract, non-blocking guarantee, privacy boundary, metrics definitions, and limitations, and add the new table to `docs/DATABASE.md` (depends on T002, T007).

**Checkpoint**: All six events can be produced end-to-end for one tenant.

---

## Phase 4: User Story 2 - Admin dashboard metrics (Priority: P1)

**Goal**: The authenticated tenant sees the five required metrics with deterministic ordering and a zero-safe conversion value.

**Independent Test**: Seed events and leads for two tenants, open the dashboard as each owner, and confirm only that tenant's metrics, most-viewed ordering, and conversion percentage appear.

### Implementation for User Story 2

- [x] T016 [US2] Create `lib/admin/analytics-queries.ts` with `getAdminAnalyticsSummary(db, tenantId)` returning vehicle views, WhatsApp clicks, new leads via the existing lead stats, one-decimal conversion, and the top-five most viewed vehicles ordered by views desc then deterministic vehicle tie-breakers (depends on T004).
- [x] T017 [US2] Add the analytics section to `app/admin/page.tsx`: metric cards for views, WhatsApp clicks, new leads, and conversion, plus a most-viewed list with an empty state, using the incumbent neutral/amber admin styling and Indonesian copy (depends on T016).
- [x] T018 [P] [US2] Add `tests/unit/analytics/dashboard.test.ts` for totals, most-viewed ordering and ties, foreign-tenant exclusion, empty-tenant zeros, and the `0.0%` zero-view conversion case (depends on T016).
- [x] T019 [P] [US2] Add `tests/e2e/admin-analytics.spec.ts` and include `admin-analytics` in `playwright.admin.config.ts` to verify the dashboard section renders for the authenticated Prima owner (depends on T017).

**Checkpoint**: Dashboard metrics are available and tenant-scoped.

---

## Phase 5: User Story 3 - Isolation and non-blocking safety (Priority: P2)

**Goal**: Analytics cannot leak across tenants and cannot break public rendering or lead capture.

**Independent Test**: Run restricted-role cross-tenant reads/writes and force analytics failures during each public flow; the database rejects the cross-tenant access and every public flow still succeeds.

### Implementation for User Story 3

- [x] T020 [US3] Add `tests/unit/analytics/rls.test.ts` using the existing tenant harness and restricted role to prove forced RLS, cross-tenant read isolation, and cross-tenant insert rejection for `analytics_events` (depends on T002).
- [x] T021 [P] [US3] Add failure-path coverage in `tests/unit/analytics/failure-safety.test.ts` proving recorder, beacon, contact action, and WhatsApp route failures never throw or alter the public response (depends on T007, T010, T011).
- [x] T022 [P] [US3] Link the analytics contract and non-blocking guarantee from `docs/PUBLIC_SITE.md` and `docs/LEADS.md` (depends on T015).

**Checkpoint**: Analytics is isolated, private, and non-blocking.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Evidence, affected e2e, and visual verification.

- [x] T023 [P] Add `scripts/visual-qa-analytics.mjs` and a `visual:qa:analytics` package script capturing the authenticated admin dashboard and the public vehicle detail share control at desktop 1440×900 and mobile 390×844 (depends on T009, T017).
- [x] T024 Run the affected admin e2e suite and the full configured validation (`npx tsc --noEmit`, `npm test`) fresh, fixing any failure within scope (depends on T001-T023).
- [x] T025 Run the analytics visual QA capture, inspect desktop and mobile screenshots, run the mechanical detector on the changed UI, write the report under `.visual-qa/reports/`, and confirm no layout regression to the incumbent design (depends on T023, T024).

---

## Dependencies & Execution Order

- **Setup**: T001 -> T002.
- **Foundational**: T003 -> T004; T005 after T003; T006 after T004; T007 after T004.
- **US1**: T008, T009, T010, T011 after T007; tests T012-T014 after their targets; docs T015 after T007.
- **US2**: T016 after T004; T017 after T016; T018 after T016; T019 after T017.
- **US3**: T020 after T002; T021 after T007/T010/T011; T022 after T015.
- **Polish**: T023 after T009/T017; T024 after all code tasks; T025 after T023/T024.

## Parallel Opportunities

- T005 and T006 are independent test files.
- T012, T013, and T014 cover different surfaces and can run together.
- T018, T019, T020, T021, and T022 are independent files.
- T023 is independent of the test files.

## Implementation Strategy

MVP is US1 plus the schema foundation: all six events recorded without blocking
public behavior. US2 adds the required dashboard read surface. US3 hardens the
isolation and failure contract. Polish produces the fresh tsc/test/e2e and
visual evidence required before the checkpoint.
