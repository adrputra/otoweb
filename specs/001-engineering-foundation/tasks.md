---
description: "Task list for Engineering Foundation"
---

# Tasks: Engineering Foundation

**Input**: Design documents from `/specs/001-engineering-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: The specification explicitly requires a real unit/component test suite
and a Playwright smoke test, so test tasks are included.

**Organization**: Tasks are grouped by user story so the quality gates, test
harness, browser smoke test, and CI/configuration work can be verified
independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Single Next.js project at the repository root.
- Configuration files live at the repository root.
- Unit/component tests live in `tests/unit/`.
- Playwright tests live in `tests/e2e/`.
- Tooling scripts live in `scripts/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the development dependencies and the environment files that all
quality gates share.

- [x] T001 Install the engineering dev dependencies with pnpm (ESLint 9 + `eslint-config-next@16.4.0` + `eslint-config-prettier`, Prettier 3, Vitest 5 + `@vitejs/plugin-react` + `jsdom`, Testing Library packages, and `@playwright/test`) and update `package.json` and `pnpm-lock.yaml`.
- [x] T002 [P] Add `.env.example` with non-secret placeholders for `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_SHOWROOM_SLUG`, plus a comment that real credentials never belong in the file.
- [x] T003 [P] Update `.gitignore` to ignore real environment files (`.env`, `.env.*`) while keeping `!.env.example`, and ignore `*.tsbuildinfo`, `coverage/`, `playwright-report/`, and `test-results/`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the lint, format, test, browser-test, environment, and CI
configuration. No user story verification can run until this phase is complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Create `scripts/validate-env.mjs` with a Zod schema for `NODE_ENV`, `NEXT_PUBLIC_SITE_URL` (URL, default `http://localhost:3000`), and `NEXT_PUBLIC_SHOWROOM_SLUG` (lowercase kebab-case, default `prima`); export `validateEnv` and `env`, print a success line when run directly, and exit non-zero with a clear message on invalid input.
- [x] T005 [P] Create `eslint.config.mjs` using ESLint 9 flat config with `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and `eslint-config-prettier` last; ignore `node_modules/`, `.next/`, `coverage/`, `playwright-report/`, `test-results/`, `.specify/`, `specs/`, `.sdd-toolbox/`, and `public/` (depends on T001).
- [x] T006 [P] Create `.prettierrc.json` and `.prettierignore` matching the existing style (no semicolons, single quotes, trailing commas) and ignoring generated, dependency, documentation, and Spec Kit directories (depends on T001).
- [x] T007 [P] Create `vitest.config.ts` (React plugin, jsdom, `tests/unit/**/*.test.{ts,tsx}`, `@` alias, `vitest.setup.ts`) and `vitest.setup.ts` (jest-dom matchers) (depends on T001).
- [x] T008 [P] Create `playwright.config.ts` with a Chromium project, a `pnpm dev` web server on port 3000, `reuseExistingServer` outside CI, and `tests/e2e/**/*.spec.ts` (depends on T001).
- [x] T009 [P] Update `tsconfig.json` to exclude generated test/build artifacts (`node_modules`, `playwright-report`, `test-results`, `coverage`) while preserving Next.js type support.
- [x] T010 Add the `lint`, `lint:fix`, `format`, `format:check`, `typecheck`, `test`, `test:watch`, `test:e2e`, and `validate:env` scripts to `package.json` (depends on T001).
- [x] T011 Update `next.config.mjs` to import and execute `scripts/validate-env.mjs` and remove `typescript.ignoreBuildErrors` so the production build enforces type checking (depends on T004).
- [x] T012 [P] Create `.github/workflows/ci.yml` for pull requests and pushes to `main`, using pnpm 12.3.4, Node.js 24, `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` (depends on T010).
- [x] T013 [P] Add pure unit tests in `tests/unit/format.test.ts` for `formatRupiah`, `formatKm`, `formatDate`, and `whatsappLink` (depends on T007).
- [x] T014 [P] Add a Testing Library component test in `tests/unit/vehicle-card.test.tsx` that renders `VehicleCard` from `components/showroom.tsx` with a typed fixture and asserts the brand, model, price, status badge, and detail link (depends on T007).
- [x] T015 [P] Add a Playwright smoke test in `tests/e2e/home.spec.ts` that opens `/` and asserts the showroom heading and a visible link to `/cars` (depends on T008).

**Checkpoint**: Tooling configuration exists. User story verification can now run
in parallel.

---

## Phase 3: User Story 1 - Run trustworthy source-quality gates (Priority: P1) 🎯 MVP

**Goal**: `pnpm lint` and `pnpm typecheck` are real, green commands.

**Independent Test**: Run `pnpm lint` and `pnpm typecheck` from the repository
root; both exit 0.

### Implementation for User Story 1

- [x] T016 [US1] Run `pnpm lint`; resolve every ESLint error left in the existing source without changing rendered output (for example remove unused imports rather than restyling), and keep warnings at zero or document any intentional warning (depends on T005, T010).
- [x] T017 [US1] Run `pnpm typecheck`; resolve any TypeScript errors introduced by the test/config files (depends on T010).
- [x] T018 [US1] Run `pnpm exec prettier --check` on the new tooling and test files and apply `pnpm exec prettier --write` to those files until the check passes; do not reformat existing presentation files (depends on T006, T010, T013, T014, T015).

**Checkpoint**: US1 is independently verified.

---

## Phase 4: User Story 2 - Run unit and component tests locally (Priority: P2)

**Goal**: `pnpm test` executes real Vitest + Testing Library tests and exits 0.

**Independent Test**: Run `pnpm test` and confirm at least one unit test and one
component test execute with a passing summary.

### Implementation for User Story 2

- [x] T019 [US2] Run `pnpm test`; fix any Vitest, jsdom, Testing Library, alias, or fixture failures until the suite passes and reports at least two passing tests (depends on T010, T013, T014).

**Checkpoint**: US2 is independently verified.

---

## Phase 5: User Story 3 - Prove the app boots in a real browser (Priority: P3)

**Goal**: `pnpm test:e2e` starts the app and passes the homepage smoke test.

**Independent Test**: Install Chromium and run `pnpm test:e2e`; the smoke test
passes.

### Implementation for User Story 3

- [x] T020 [US3] Install the Playwright Chromium browser (`pnpm exec playwright install chromium`) and run `pnpm test:e2e`; fix only test/config issues until the homepage smoke test passes (depends on T008, T010, T015).

**Checkpoint**: US3 is independently verified.

---

## Phase 6: User Story 4 - Enforce the gates in CI and fail fast on bad configuration (Priority: P4)

**Goal**: CI contains the required gates, environment validation rejects bad
values, and `.env.example` is credential-free.

**Independent Test**: Inspect `.github/workflows/ci.yml`, run `pnpm validate:env`
with valid and invalid values, and confirm `.env` is ignored while `.env.example`
is tracked.

### Implementation for User Story 4

- [x] T021 [US4] Verify `pnpm validate:env` succeeds with defaults, fails with `NEXT_PUBLIC_SITE_URL=not-a-url`, and fails with a malformed `NEXT_PUBLIC_SHOWROOM_SLUG`; confirm `next.config.mjs` imports the validator (depends on T002, T004, T011).
- [x] T022 [US4] Verify `.env.example` contains no real credentials and that `git check-ignore .env` succeeds while `git check-ignore -q .env.example` fails (depends on T002, T003).
- [x] T023 [US4] Verify `.github/workflows/ci.yml` contains checkout, pnpm setup, Node 24, frozen install, lint, typecheck, test, and build steps (depends on T010, T012).

**Checkpoint**: US4 is independently verified.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Prove the configured validation and roadmap acceptance commands pass
fresh, and record the completed foundation.

- [x] T024 Run the configured validation commands from `.sdd-toolbox/config.json` (`npx tsc --noEmit` and `npm test`) and capture the fresh results (depends on T016, T017, T019, T020, T021, T022, T023).
- [x] T025 Run the roadmap acceptance commands `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` fresh and capture the results (depends on T016, T017, T019, T020, T021, T022, T023).
- [x] T026 Update `docs/IMPLEMENTATION_STATUS.md` Phase 2 capability statuses and validation evidence to reflect the delivered tooling (depends on T024, T025).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; T001 updates the shared manifest/lockfile, T002/T003 touch separate files.
- **Foundational (Phase 2)**: Depends on Setup. T005–T008 and T010 depend on T001; T011 depends on T004; T012 depends on T010; T013/T014 depend on T007; T015 depends on T008.
- **User Stories (Phase 3+)**: Depend on Foundational. US1 and US2 can run in parallel; US3 depends on the Playwright config/test; US4 depends on the environment validator and CI workflow.
- **Polish (Phase 7)**: Depends on all user story verification tasks.

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational; no dependency on other stories.
- **US2 (P2)**: Depends on Foundational; no dependency on other stories.
- **US3 (P3)**: Depends on Foundational; no dependency on other stories.
- **US4 (P4)**: Depends on Foundational; no dependency on other stories.

### Within Each User Story

- Configuration before verification.
- Test files before running the suite.
- Fix only the failing scope; never weaken a check.
- Stop and report on any remaining failure.

### Parallel Opportunities

- T002/T003 can run in parallel with T001.
- T005–T009 and T010 can be authored in parallel once dependencies are installed.
- T013/T014/T015 can be authored in parallel.
- T024/T025 can run in parallel; T026 follows both.

---

## Parallel Example: Foundational Configuration

```bash
# Author independent configuration files together:
Task: "Create eslint.config.mjs"
Task: "Create .prettierrc.json and .prettierignore"
Task: "Create vitest.config.ts and vitest.setup.ts"
Task: "Create playwright.config.ts"
Task: "Update tsconfig.json excludes"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational.
2. Complete US1: `pnpm lint` and `pnpm typecheck` green.
3. Stop and validate US1 independently before moving on.

### Incremental Delivery

1. Setup + Foundational -> toolchain ready.
2. US1 -> lint/typecheck gates verified.
3. US2 -> real unit/component tests verified.
4. US3 -> browser smoke test verified.
5. US4 -> CI and environment safety verified.
6. Polish -> full configured and roadmap acceptance commands pass fresh.

---

## Notes

- [P] tasks touch different files and have no unmet dependencies.
- Tests are required by the spec (FR-004, FR-005); do not remove them to make a
  command green.
- No task introduces a database, auth provider, storage provider, or backend
  integration.
- No task reformats existing presentation files; formatting is applied to new
  tooling/test files.
- Tick each task `[x]` only when its evidence is captured.
