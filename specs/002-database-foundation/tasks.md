---

description: "Task list for Database Foundation"
---

# Tasks: Database Foundation

**Input**: Design documents from `/specs/002-database-foundation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: The specification explicitly requires executable proof that the
migration runs from an empty database and that the seed works (FR-011), so test
tasks are included.

**Organization**: Tasks are grouped by user story so the schema, the seed, and
the no-external-service verification can be checked independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Database code lives in `db/`.
- Supabase client/config lives in `lib/supabase/` and `supabase/`.
- Database tests live in `tests/unit/db/`.
- Documentation lives in `docs/`.
- The existing `app/` and `components/` presentation files are out of scope.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the database, migration, seed, and embedded-test dependencies
plus the Supabase/environment configuration they need.

- [x] T001 Install `drizzle-orm`, `postgres`, and `@supabase/supabase-js` as dependencies and `drizzle-kit`, `@electric-sql/pglite`, `tsx`, and `dotenv` as dev dependencies; update `package.json` and `pnpm-lock.yaml`.
- [x] T002 [P] Add placeholder-only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `DATABASE_URL` entries to `.env.example` with comments that real credentials and the service-role key must never be committed.
- [x] T003 [P] Add a minimal `supabase/config.toml` describing the project id, API, database, and studio ports without introducing an auth flow.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Author the typed schema, client, migration configuration, generated
SQL, and package scripts. No story verification can run until this phase is
complete.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create `db/schema.ts` with the seven tables (`tenants`, `tenant_domains`, `profiles`, `tenant_members`, `showroom_settings`, `vehicles`, `vehicle_images`), UUID primary keys, tenant foreign keys, enums, indexes, relations, and inferred TypeScript types per `data-model.md`.
- [x] T005 [P] Create `db/client.ts` with a lazy server-only Drizzle client over `postgres`, `prepare: false`, and a clear missing-`DATABASE_URL` error; create `db/load-env.ts` to load `.env.local`/`.env` for CLI scripts.
- [x] T006 [P] Create `drizzle.config.ts` with PostgreSQL dialect, `db/schema.ts`, `db/migrations` output, and a placeholder-safe `DATABASE_URL`.
- [x] T007 Generate the initial checked-in PostgreSQL migration into `db/migrations/` with Drizzle Kit and inspect the SQL for all seven tables, enums, indexes, and foreign keys (depends on T004, T006).
- [x] T008 [P] Add `db:generate`, `db:migrate`, `db:seed`, `db:setup`, and `db:verify` scripts to `package.json` using `drizzle-kit` and `tsx` (depends on T001).
- [x] T009 [P] Create `lib/supabase/client.ts` with a lazy browser-safe Supabase client factory that reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and throws a clear error when either is missing (depends on T001).

**Checkpoint**: The typed schema, generated SQL, client, and scripts exist. User
story verification can now run.

---

## Phase 3: User Story 1 - Provision the production data store from an empty database (Priority: P1) 🎯 MVP

**Goal**: An empty PostgreSQL database can be migrated to the full seven-table
schema, and re-running the migration is safe.

**Independent Test**: Create a fresh PGlite database, apply the checked-in
migrations, and assert that all seven tables exist and the migration re-runs
without error.

### Tests for User Story 1

- [x] T010 [P] [US1] Add `tests/unit/db/database-foundation.test.ts` with a `node` environment, a fresh in-memory PGlite database, the real Drizzle migrator, and assertions that all seven required tables and the declared enum types exist after migrating from empty (depends on T001, T007).
- [x] T011 [US1] Add a migration re-run assertion to `tests/unit/db/database-foundation.test.ts` proving the second migration pass is a safe no-op (depends on T010).

### Implementation for User Story 1

- [x] T012 [US1] Create `db/migrate.ts` to load local environment, apply `db/migrations` over the production `DATABASE_URL` client, close the connection, and exit non-zero with a clear message when `DATABASE_URL` is missing (depends on T005, T007, T008).
- [x] T013 [US1] Run the migration test and the migration CLI against no database to verify the empty-database path and the missing-environment failure message; record the exact output (depends on T011, T012).

**Checkpoint**: US1 is independently verified: schema from empty plus safe
re-run.

---

## Phase 4: User Story 2 - Seed a realistic development showroom (Priority: P2)

**Goal**: A migrated database can be seeded with Prima Auto Gallery and Tenant B
Test Showroom, all twelve mock vehicles and images, and re-running the seed does
not duplicate rows.

**Independent Test**: Migrate a fresh PGlite database, run the seed function,
assert both tenants and all twelve vehicles/images exist with mock parity, run
the seed again, and confirm counts are unchanged.

### Tests for User Story 2

- [x] T014 [P] [US2] Extend `tests/unit/db/database-foundation.test.ts` to seed after migration and assert two tenants, two domains, two profiles, two memberships, two showroom-settings rows, twelve vehicles, and twelve images, including the exact display names Prima Auto Gallery and Tenant B Test Showroom (depends on T010).
- [x] T015 [US2] Add mock-parity assertions to `tests/unit/db/database-foundation.test.ts` matching every `data/index.ts` vehicle by slug and comparing brand, model, variant, year, price, featured flag, features, image URL, and mapped status (depends on T014).
- [x] T016 [US2] Add a second-seed assertion to `tests/unit/db/database-foundation.test.ts` proving row counts and IDs are unchanged after seeding twice (depends on T015).

### Implementation for User Story 2

- [x] T017 [US2] Create `db/seed-core.ts` with deterministic seed UUIDs, the two tenants, domains, profiles, memberships, showroom settings, and a mapping of all twelve `data/index.ts` vehicles and their images, using upserts for idempotency (depends on T004, T005).
- [x] T018 [US2] Create `db/seed.ts` as the CLI wrapper that loads local env, calls the seed, prints a concise summary, closes the connection, and is wired to `pnpm db:seed` (depends on T008, T017).
- [x] T019 [US2] Run the seed assertions and fix only database-layer issues until all seed, parity, status-mapping, and idempotency assertions pass (depends on T016, T018).

**Checkpoint**: US1 and US2 are independently verified.

---

## Phase 5: User Story 3 - Verify the database layer without external services (Priority: P3)

**Goal**: The normal test suite proves migration and seed without Docker, the
Supabase CLI, or a local PostgreSQL server; the build passes; the UI is
unchanged; no secrets are committed.

**Independent Test**: Run `npx tsc --noEmit`, `pnpm lint`, `pnpm typecheck`,
`pnpm test`, and `pnpm build` with no external database, then confirm no file
under `app/` or `components/` changed.

### Implementation for User Story 3

- [x] T020 [P] [US3] Write `docs/DATABASE.md` documenting the seven tables, relationships, enums, status mapping, seed contents, environment variables, migration/seed commands, the production Supabase path, the embedded PGlite verification path, and the explicitly deferred auth/RLS/leads work (depends on T004, T007, T017).
- [x] T021 [P] [US3] Verify the DB test is included in `pnpm test` and `npm test`, uses the `node` environment, and has a sufficient timeout for PGlite startup; document the single-file command in `quickstart.md` (depends on T010).
- [x] T022 [US3] Add a clear missing-`DATABASE_URL` failure assertion/test for `db/client.ts` and verify the CLI error text names `DATABASE_URL` (depends on T005, T012, T018).
- [x] T023 [US3] Run the full quality gates fresh: `npx tsc --noEmit`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; fix only database-layer or test issues, never presentation files (depends on T019, T020, T021, T022).
- [x] T024 [US3] Verify the UI baseline is untouched with `git diff --name-only` (no `app/` or `components/` entries) and confirm `.env.example` contains placeholders only and no real credential (depends on T023).
- [x] T025 [US3] Run `pnpm exec prettier --write` on the new database, Supabase, test, and documentation artifacts only, then re-run the affected checks (depends on T023).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final consistency and convergence checks.

- [x] T026 Validate `quickstart.md` commands against the implemented scripts and update any command or expected output that drifted (depends on T025).
- [x] T027 Run the converge assessment against `spec.md`, `plan.md`, and `tasks.md`; append no tasks if the database foundation is fully satisfied (depends on T026).

---

## Dependencies

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup; blocks all stories.
- **US1 (Phase 3)**: Depends on Foundational; delivers migration-from-empty.
- **US2 (Phase 4)**: Depends on Foundational and reuses the US1 test harness.
- **US3 (Phase 5)**: Depends on US1 and US2.
- **Polish (Phase 6)**: Depends on all stories.

### Within Each User Story

- Schema before migration generation.
- Migration before migration tests.
- Seed implementation before seed assertions.
- Assertions before the final quality gates.

### Parallel Opportunities

- T002/T003 can run in parallel with T001.
- T005/T006/T008/T009 can be authored in parallel after dependencies are installed.
- T010 can start once T007 exists.
- T014/T020/T021 are independent files and can run in parallel where their
  dependencies are already complete.

---

## Parallel Example: Foundational

```bash
# Author independent files together:
Task: "Create db/schema.ts"
Task: "Create db/client.ts and db/load-env.ts"
Task: "Create drizzle.config.ts"
Task: "Create lib/supabase/client.ts"
Task: "Add db:* scripts to package.json"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational.
2. Complete US1: a fresh database migrates to the seven-table schema.
3. Stop and verify US1 independently before seeding.

### Incremental Delivery

1. Setup + Foundational -> typed schema and migration output exist.
2. US1 -> migration from empty proven.
3. US2 -> two showrooms and twelve mock vehicles seeded idempotently.
4. US3 -> no-external-service verification, documentation, secrets check, and
   full quality gates.
5. Polish -> quickstart consistency and converge.

---

## Notes

- [P] tasks touch different files and have no unmet dependencies.
- Tests are required by FR-011; do not remove them to make a command green.
- No task changes `app/` or `components/`.
- No task introduces authentication, RLS, tenant enforcement, or a backend API.
- No task writes a real credential.
- Tick each task `[x]` only when its evidence is captured.
