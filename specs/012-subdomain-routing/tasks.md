---
description: "Task list for subdomain routing"
---

# Tasks: Subdomain Routing

**Input**: Design documents from `/specs/012-subdomain-routing/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. Hostname resolution is security-sensitive and the roadmap
acceptance is a cross-host rendering proof, so unit, raw-HTTP e2e, and visual
checks are part of the feature.

**Organization**: Tasks are grouped by user story. US1 is production routing,
US2 is local development testing, and US3 is fail-closed safety.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configure the single new deployment input.

- [x] T001 [P] Add optional `TENANT_ROOT_DOMAIN` to `.env.example` and validate it as an optional DNS hostname in `scripts/validate-env.mjs` (server-only, default `otoweb.id`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core hostname helpers and the exact-then-wildcard resolver. No user story work starts until these are complete.

- [x] T002 Implement `normalizeRootDomain`, `platformSubdomainLabel`, `isLoopbackHostname`, and `resolvePlatformRootDomains` in `lib/tenant/hostname.ts`; production defaults to `otoweb.id`, while development/test also accepts `localhost` (depends on T001).
- [x] T003 Extend `findTenantByHostname` in `lib/tenant/hostname.ts` with exact-record precedence, single-label wildcard slug resolution, and development alias lookup; preserve `unknown_hostname` and `tenant_unavailable` and never fall through after an exact domain row (depends on T002).
- [x] T004 Wire `resolvePublicTenant` in `lib/public/tenant.ts` to the wildcard resolver and restrict the `NEXT_PUBLIC_SHOWROOM_SLUG` fallback to bare loopback hosts in development (depends on T003).

**Checkpoint**: One resolution path serves exact hosts, wildcard hosts, and bare-loopback development hosts.

---

## Phase 3: User Story 1 - Reach the right showroom from a tenant hostname (Priority: P1) 🎯 MVP

**Goal**: A production-shaped hostname resolves to exactly one showroom, and two hostnames from one deployment show different branding, inventory, and contact details.

**Independent Test**: Start one server and request `prima.otoweb.id`, `tenant-b.otoweb.id`, and two wildcard slug hosts; compare the returned showroom name, vehicle inventory, and contact details.

### Tests for User Story 1

- [x] T005 [P] [US1] Add unit coverage in `tests/unit/tenant/hostname.test.ts` for exact-domain precedence, slug wildcard, multi-label hosts, suffix spoofing, inactive domains without fallback, unknown hosts, and suspended tenants (depends on T003).
- [x] T006 [P] [US1] Add unit coverage in `tests/unit/public/tenant-resolution.test.ts` for wildcard public hosts and production fail-closed behavior (depends on T004).
- [x] T007 [P] [US1] Add `tests/e2e/subdomain-routing.spec.ts` with a raw-HTTP host matrix proving `prima.otoweb.id` and `tenant-b.otoweb.id` return distinct branding, inventory, and contact details from one server, plus wildcard slug hosts and an unknown-host 404 (depends on T004).

### Documentation for User Story 1

- [x] T008 [P] [US1] Create `docs/SUBDOMAIN_ROUTING.md` documenting the production wildcard root, exact-domain precedence, resolution order, fail-closed rules, and verification commands (depends on T004).
- [x] T009 [P] [US1] Update the hostname/request-flow sections of `docs/TENANCY.md` and `docs/PUBLIC_SITE.md` for wildcard resolution and the loopback-only development fallback (depends on T004).

**Checkpoint**: US1 is independently testable through unit and raw-HTTP e2e checks.

---

## Phase 4: User Story 2 - Test multiple tenants locally without manual host mapping (Priority: P2)

**Goal**: `prima.localhost` and `tenant-b.localhost` render their own seeded showrooms, and desktop/mobile captures prove the two-host acceptance.

**Independent Test**: Run `pnpm dev`, open the two localhost hosts, and compare the rendered showrooms; then run the focused visual script and inspect its PASS report.

### Tests for User Story 2

- [x] T010 [P] [US2] Add `tests/unit/tenant/development-hosts.test.ts` covering `prima.localhost`, `tenant-b.localhost`, slug-based `*.localhost`, unknown local subdomain failure, bare-loopback default behavior, production exclusion of `localhost`, and ambiguous aliases (depends on T004).

### Implementation and evidence for User Story 2

- [x] T011 [P] [US2] Add `scripts/visual-qa-subdomain.mjs` and the `visual:qa:subdomain` script in `package.json`; capture desktop 1440×900 and mobile 390×844 screenshots for the two acceptance hostnames and write JSON/markdown evidence under `.visual-qa/` (depends on T004).
- [x] T012 [US2] Run `node scripts/visual-qa-subdomain.mjs` against the seeded development server and verify a PASS verdict with no cross-tenant leak or horizontal overflow; record the report and screenshot paths (depends on T011).

**Checkpoint**: The roadmap's two-hostname acceptance is demonstrated in a browser at both viewports.

---

## Phase 5: User Story 3 - Keep hostname resolution safe and predictable (Priority: P3)

**Goal**: Wildcard inference cannot bypass disabled domains, suspended tenants, non-platform hosts, or alias ambiguity.

**Independent Test**: Exercise inactive exact domains, suspended tenants, custom/non-platform hosts, a configured root override, and duplicate development aliases; every unsafe case fails closed.

### Tests for User Story 3

- [x] T013 [P] [US3] Add `tests/unit/tenant/wildcard-safety.test.ts` covering disabled/suspended tenants, inactive exact domains without wildcard fallback, non-platform and custom domains, configured root override, suffix spoofing, and ambiguous aliases (depends on T003).

### Documentation for User Story 3

- [x] T014 [P] [US3] Update the subdomain section of `docs/PLATFORM.md` to state that wildcard routing is implemented in F013 while custom-domain verification, DNS instructions, and SSL remain F014 (depends on T004).

**Checkpoint**: All unsafe hostname cases are covered by tests and documented boundaries.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final evidence and consistency checks before the feature checkpoint.

- [x] T015 Run focused verification and record fresh output for the checkpoint: `npx tsc --noEmit`; `npx vitest run tests/unit/tenant/hostname.test.ts tests/unit/tenant/development-hosts.test.ts tests/unit/tenant/wildcard-safety.test.ts tests/unit/public/tenant-resolution.test.ts`; `npx playwright test tests/e2e/subdomain-routing.spec.ts`; and `npm run visual:qa:subdomain` (depends on T005, T006, T007, T008, T009, T010, T012, T013, T014).
- [x] T016 [P] Re-read `docs/SUBDOMAIN_ROUTING.md` and the updated tenancy/public/platform docs against the implemented behavior; correct any drift without weakening a check (depends on T015).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: No dependencies.
- **Foundational (T002–T004)**: T002 depends on T001; T003 depends on T002; T004 depends on T003. This phase blocks every user story.
- **US1 (T005–T009)**: Depends on T004. T005 and T006/T007 can run in parallel; the two documentation tasks touch different files.
- **US2 (T010–T012)**: Depends on T004 and the US1 phase. T010 and T011 can run in parallel; T012 runs the script after T011.
- **US3 (T013–T014)**: Depends on T003/T004 and the preceding story phases.
- **Polish (T015–T016)**: T015 depends on all implementation, test, script, and documentation tasks; T016 depends on T015.

### Within Each User Story

- Core resolver behavior lands before tests that assert it.
- Tests and documentation for different files run in parallel.
- The visual script lands before it is executed.
- No task weakens an existing tenant-isolation or exact-host test.

### Parallel Opportunities

- T005, T006, and T007 are independent test files.
- T008, T009, T010, and T011 are independent documentation/test/script files.
- T013 is an independent safety test file.
- T016 is a read-and-correct pass after verification.

---

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational (T001–T004).
2. Complete US1 (T005–T009) and run the unit plus raw-HTTP checks.
3. Confirm two production-shaped hostnames return different showrooms.

### Incremental Delivery

1. Add wildcard resolution and public wiring.
2. Add production and development tests.
3. Add the visual capture for the roadmap acceptance.
4. Add safety tests and documentation.
5. Run the focused checkpoint, then the full `npx tsc --noEmit` and `npm test` pass owned by the driver.

## Notes

- [P] tasks use different files and can run together.
- `tasks.md` checkboxes are ticked as each task completes.
- Exact registered hostnames remain authoritative; custom-domain work is deferred to F014.
- No database migration is expected. If implementation needs one, stop and report the conflict rather than inventing schema.
