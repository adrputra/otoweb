# Implementation Plan: Database Foundation

**Branch**: `002-database-foundation` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-database-foundation/spec.md`

## Summary

Add the production data foundation to the existing Next.js repository without
changing the approved UI: a typed Drizzle schema and checked-in PostgreSQL
migrations for `tenants`, `tenant_domains`, `profiles`, `tenant_members`,
`showroom_settings`, `vehicles`, and `vehicle_images`; Supabase project
configuration and non-secret environment placeholders; an idempotent
development seed for Prima Auto Gallery and Tenant B Test Showroom that migrates
all twelve existing mock vehicles and images; schema documentation; and an
executable Vitest verification that applies the real migration SQL and seed
logic to a fresh embedded PostgreSQL database (`@electric-sql/pglite`) so the
gates run without Docker, the Supabase CLI, or a local PostgreSQL server.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16.4.0.

**Primary Dependencies**: `drizzle-orm` and `postgres` (PostgreSQL driver for
the application and production migrations), `@supabase/supabase-js` (Supabase
project client configuration), `drizzle-kit` (migration generation), `tsx` and
`dotenv` (migration/seed CLI scripts), and `@electric-sql/pglite` (embedded
PostgreSQL for tests). Vitest 5 already exists.

**Storage**: PostgreSQL. Supabase is the production platform; the application
uses a server-only `DATABASE_URL`. Tests use an in-memory PGlite database that
executes the checked-in migration SQL.

**Testing**: Vitest. The existing `tests/unit` suite continues to run under
jsdom; the new database test opts into the `node` environment per file. The test
migrates an empty PGlite instance, runs the seed, and asserts schema, data
parity, status mapping, and idempotency.

**Target Platform**: Node.js 24 / pnpm 12.3.4; local development and CI. No
Docker daemon, Supabase CLI, or `psql` binary is available in this environment.

**Project Type**: Single Next.js App Router application with a new `db/`
persistence layer and schema documentation.

**Performance Goals**: No runtime performance change to the existing UI. The
seed inserts a small deterministic fixture set (2 tenants, 12 vehicles, 12
images). The database test must finish within the normal unit-test budget.

**Constraints**: Preserve `app/` and `components/` byte-for-byte; no
authentication, RLS, tenant authorization, or API integration beyond the
database layer; no real credentials; only the seven required tables; the test
path must genuinely execute migration and seed SQL.

**Scale/Scope**: One repository, one feature, seven tables, two seeded tenants,
twelve seeded vehicles. `leads` and RLS are deferred to later roadmap phases.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled project template (no
ratified principles). Per the Spec Kit converge/plan guidance, constitution
checks are skipped gracefully rather than failing. No constitution bootstrap
exists in `.sdd-toolbox/roadmap.json` for this feature.

**Result**: PASS (no ratified constraints to violate).

## Project Structure

### Documentation (this feature)

```text
specs/002-database-foundation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md             # created by the tasks capability
```

### Source Code (repository root)

```text
db/
├── schema.ts            # typed Drizzle schema for the seven tables
├── client.ts            # lazy server-only Drizzle client over postgres.js
├── load-env.ts          # local .env.local/.env loading for CLI scripts
├── migrate.ts           # CLI: apply checked-in migrations
├── seed-core.ts         # pure, injectable seed function + mock-data mapping
├── seed.ts              # CLI: migrate-compatible seed entry point
└── migrations/
    ├── 0000_*.sql       # generated PostgreSQL migration(s)
    └── meta/            # Drizzle Kit journal + snapshots

lib/supabase/
└── client.ts            # browser-safe Supabase client factory (no auth flow)

supabase/
└── config.toml          # minimal Supabase CLI project configuration

tests/unit/db/
└── database-foundation.test.ts

drizzle.config.ts
docs/DATABASE.md
.env.example             # placeholder-only additions
package.json             # db:* scripts + dependencies
pnpm-lock.yaml
```

**Structure Decision**: Database code lives in a top-level `db/` directory,
separate from the presentation layer, matching Drizzle conventions and keeping
the schema/migrations discoverable. Tests stay in `tests/unit/db/` so the
existing Vitest include pattern runs them. The existing `app/`, `components/`,
`lib/repositories.ts`, and `data/` files are not modified, so the approved UI
and its in-memory data source remain untouched until the later public-website
migration phase.

## Complexity Tracking

No constitution violations. The only added complexity is the embedded PGlite
test path, required because this environment cannot run Docker, the Supabase
CLI, or a local PostgreSQL server; it executes the same migration SQL and seed
logic as production.
