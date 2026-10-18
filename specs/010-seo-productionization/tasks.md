# Tasks: SEO Productionization

**Input**: Design documents from `/specs/010-seo-productionization/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because the acceptance criterion requires verification of generated HTML, not client-rendered metadata.

**Organization**: Tasks are grouped by user story so each crawl/metadata surface remains independently testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the SEO module layout and documentation target.

- [x] T001 Create the `lib/seo/` module and `components/seo/` directory per plan (documented in `specs/010-seo-productionization/plan.md`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure builders and request primitives used by every story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Implement request origin and absolute URL helpers in `lib/seo/origin.ts`, including `x-forwarded-host`/`host`, `x-forwarded-proto`, host validation, and `NEXT_PUBLIC_SITE_URL` fallback.
- [x] T003 [P] Implement JSON-LD builders (`AutoDealer`, `Vehicle`, `Offer`) and the safe serializer in `lib/seo/structured-data.ts`.
- [x] T004 Implement tenant-aware metadata builders for home, inventory, and vehicle detail in `lib/seo/metadata.ts` (depends on T002).
- [x] T005 Implement the server-only JSON-LD component in `components/seo/json-ld.tsx` (depends on T003).

**Checkpoint**: Pure SEO builders exist and compile.

---

## Phase 3: User Story 1 - Tenant-aware metadata in server HTML (Priority: P1) 🎯 MVP

**Goal**: Home, inventory, and vehicle detail responses contain tenant-correct title, description, canonical, and OpenGraph tags.

**Independent Test**: Raw HTTP requests to both tenant hostnames contain only that tenant's metadata, and filtered inventory is canonicalized to `/cars`.

### Tests for User Story 1

- [x] T006 [P] [US1] Add unit tests for origin parsing and absolute URL resolution in `tests/unit/seo/origin.test.ts` (depends on T002).
- [x] T007 [P] [US1] Add unit tests for title/description/canonical/OpenGraph builders in `tests/unit/seo/metadata.test.ts` (depends on T004).

### Implementation for User Story 1

- [x] T008 [US1] Update `lib/public/metadata.ts` to expose the tenant-aware facade used by pages (depends on T004).
- [x] T009 [US1] Replace hard-coded tenant metadata in `app/layout.tsx` with a generic root fallback that cannot identify another tenant.
- [x] T010 [US1] Wire home metadata through `generateMetadata` in `app/page.tsx` (depends on T008).
- [x] T011 [P] [US1] Wire inventory metadata and clean `/cars` canonicalization in `app/cars/page.tsx` (depends on T008).
- [x] T012 [P] [US1] Wire vehicle-detail metadata, roadmap title pattern, description, canonical, and OpenGraph image in `app/cars/[slug]/page.tsx` (depends on T008).

**Checkpoint**: Metadata is tenant-correct on all three public routes.

---

## Phase 4: User Story 2 - Tenant-specific crawl surfaces (Priority: P1)

**Goal**: `robots.txt` and `sitemap.xml` are generated per request and never leak another tenant's URLs.

**Independent Test**: Fetch both crawl surfaces on each seeded hostname and assert origin-scoped URLs and sitemap references.

### Implementation for User Story 2

- [x] T014 [US2] Implement the pure tenant sitemap entry builder in `lib/seo/sitemap.ts` (depends on T002).
- [x] T015 [US2] Implement dynamic `app/sitemap.ts` using request headers, tenant resolution, and public vehicle rows (depends on T014).
- [x] T016 [US2] Implement dynamic `app/robots.ts` with public allow rules, admin/API/auth disallows, and the tenant sitemap URL (depends on T002).
- [x] T017 [US2] Ensure unresolved tenants produce no sitemap URLs and no sitemap reference in robots (depends on T015, T016).

### Tests for User Story 2

- [x] T013 [P] [US2] Add unit tests for sitemap entry building, public vehicle inclusion, and unresolved-tenant behavior in `tests/unit/seo/sitemap.test.ts` (depends on T015, T016).

**Checkpoint**: Both tenants receive distinct crawl surfaces.

---

## Phase 5: User Story 3 - Structured data (Priority: P2)

**Goal**: Home emits `AutoDealer`/`LocalBusiness` JSON-LD; vehicle detail emits `Vehicle` + `Offer` with status-mapped availability.

**Independent Test**: Parse every JSON-LD block from raw HTML responses and assert required types and values.

### Tests for User Story 3

- [x] T018 [P] [US3] Add unit tests for `AutoDealer`/`Vehicle`/`Offer` builders, status mapping, and script-escaping in `tests/unit/seo/structured-data.test.ts` (depends on T003).

### Implementation for User Story 3

- [x] T019 [US3] Render showroom JSON-LD from `app/page.tsx` (depends on T004, T005).
- [x] T020 [US3] Render vehicle and offer JSON-LD from `app/cars/[slug]/page.tsx`, including `SoldOut` for sold rows (depends on T003, T005, T012).

**Checkpoint**: Structured data is present and valid on both entity surfaces.

---

## Phase 6: User Story 4 - Deliberate sold-listing handling (Priority: P2)

**Goal**: Sold pages remain reachable, self-canonical, indexable, in the sitemap, with “Terjual”, `SoldOut`, and related non-sold vehicles.

**Independent Test**: Fetch a sold vehicle URL and its tenant sitemap; assert the policy end to end.

### Implementation for User Story 4

- [x] T021 [US4] Restrict related-vehicle queries to `available` and `reserved` statuses in `lib/public/queries.ts` while preserving tenant scope.
- [x] T022 [US4] Add regression tests for related-vehicle status filtering in `tests/unit/public/repositories.test.ts`.

**Checkpoint**: Sold listings follow the documented policy.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Real-HTTP verification, documentation, and the full checkpoint validation.

- [x] T023 Add the raw-HTTP SEO verification suite in `tests/e2e/seo-html.spec.ts`, covering metadata, OpenGraph, canonical, sitemap, robots, JSON-LD, sold handling, and tenant isolation (depends on T010, T011, T012, T017, T019, T020, T022).
- [x] T024 [P] Document the SEO output contract, sold policy, and raw-HTML verification workflow in `docs/SEO.md`; update `docs/PUBLIC_SITE.md` and `docs/SHOWROOM_SETTINGS.md` to point at the completed implementation.
- [x] T025 Run `npx tsc --noEmit`, `npm test`, and `npx playwright test tests/e2e/seo-html.spec.ts`; record fresh output (depends on T023, T024).
- [x] T026 Run the visual QA capture against the public routes only if a visible presentation file changed; otherwise record the `n/a` justification in the completion report (depends on T025).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on Foundational.
- **US3 (Phase 5)**: Depends on Foundational, and shares the page files with US1 (T012 for detail).
- **US4 (Phase 6)**: Depends on Foundational; independent of metadata wiring.
- **Polish (Phase 7)**: Depends on US1–US4.

### Within Each Story

- Pure builders before route wiring.
- Route wiring before end-to-end verification.
- Tests may be authored alongside their builder; the e2e suite runs last.

### Parallel Opportunities

- T002 and T003 are independent and can run in parallel.
- T006 and T007 are independent test files.
- T011 and T012 touch different page files and can run in parallel after T008.
- T013 is independent once T014 exists.
- T024 can run while T023 is being finalized, but the final validation (T025) waits for both.

---

## Implementation Strategy

### MVP First

1. Complete Foundational (T001–T005).
2. Complete US1 (T006–T012) and validate metadata with raw HTTP.
3. Complete US2 (T013–T017); the roadmap's explicit acceptance is satisfied once both tenants have distinct crawl surfaces.

### Incremental Delivery

1. Foundational + US1 → tenant metadata.
2. US2 → tenant sitemap/robots.
3. US3 → structured data.
4. US4 → sold policy.
5. Polish → raw-HTTP suite, docs, full validation.

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies.
- All crawl and metadata output is server-side; no client component is added.
- `tests/e2e/seo-html.spec.ts` uses raw Node HTTP with an explicit `Host` header, not `page.goto` or a hydrated DOM.
- Do not weaken the configured validation commands.
