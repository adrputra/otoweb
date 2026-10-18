# Quickstart: Database Foundation

**Feature**: `002-database-foundation`  
**Purpose**: Runnable validation guide for the schema, migrations, seeds, and
embedded verification delivered by this feature.

## Prerequisites

- Node.js 24 and pnpm 12.3.4
- For the production/Supabase path: a Supabase project (or any PostgreSQL 17
  database) and its connection string
- No Docker, Supabase CLI, or local PostgreSQL server is required for the test
  path

## Install

```bash
pnpm install --frozen-lockfile
```

## Environment

Copy the template and replace the placeholders:

```bash
cp .env.example .env.local
```

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SHOWROOM_SLUG=prima
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

`DATABASE_URL` is server-only. Never commit a real value or a service-role key.
Real `.env*` files are git-ignored; only `.env.example` is tracked.

## Embedded verification (works in this environment)

```bash
pnpm test
```

The `tests/unit/db/database-foundation.test.ts` case starts a fresh in-memory
PostgreSQL-compatible database (PGlite), applies the checked-in migration SQL
from empty, runs the real seed function, and asserts the seven tables, both
tenants, all twelve mock vehicles, their images, status mapping, and seed
idempotency. The configured `npm test` runs the same suite.

Run only the database proof:

```bash
pnpm exec vitest run tests/unit/db/database-foundation.test.ts
```

## Generate migrations after a schema change

```bash
pnpm db:generate
```

This writes SQL and metadata under `db/migrations/`. Commit both the schema and
the generated migration.

## Apply migrations to a PostgreSQL/Supabase database

```bash
pnpm db:migrate
```

Expected: the command applies any unapplied migration and exits 0. Re-running is
safe; already-applied migrations are skipped through Drizzle's journal.

## Seed a development database

```bash
pnpm db:seed
```

Expected: the command upserts Prima Auto Gallery, Tenant B Test Showroom, their
domains, profiles, memberships, showroom settings, and the twelve Prima vehicles
with images, then exits 0. Re-running does not duplicate rows.

One-shot setup:

```bash
pnpm db:setup
```

## Manual verification on Supabase

In the Supabase SQL editor (or any PostgreSQL client), run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'tenants', 'tenant_domains', 'profiles', 'tenant_members',
    'showroom_settings', 'vehicles', 'vehicle_images'
  )
order by table_name;

select name, slug, status, plan from tenants order by name;

select count(*) from vehicles;
select count(*) from vehicle_images;

select v.slug, v.status, v.featured, v.price
from vehicles v
join tenants t on t.id = v.tenant_id
where t.slug = 'prima-auto-gallery'
order by v.slug;
```

Expected: seven table names; two tenants; 12 vehicles and 12 images; the draft
vehicle has status `draft`, two reserved vehicles have status `reserved`, and the
sold vehicle has status `sold`.

## Supabase CLI path (optional, requires Docker)

`supabase/config.toml` is committed for local CLI use. When a Docker daemon is
available:

```bash
supabase start
supabase db reset   # applies migrations if configured, then seeds
```

This environment has no Docker daemon or Supabase CLI, so that path is
documented but not executed here. The embedded test path proves the committed
SQL and seed logic without it.

## Quality gates

```bash
npx tsc --noEmit
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: each command exits 0. The UI files under `app/` and `components/` are
unchanged, so the existing visual baseline remains identical.

## Negative check

With `DATABASE_URL` unset, the migration/seed CLI must fail clearly:

```bash
env -u DATABASE_URL pnpm db:migrate
```

Expected: non-zero exit with a message naming `DATABASE_URL`. The test suite does
not need `DATABASE_URL` because it uses PGlite.

## Roadmap acceptance mapping

| Roadmap requirement | Command / artifact |
|---|---|
| Supabase configured | `supabase/config.toml`, `lib/supabase/client.ts`, `.env.example` |
| Drizzle configured | `db/schema.ts`, `drizzle.config.ts`, `db/client.ts` |
| PostgreSQL migrations | `db/migrations/**`, `pnpm db:migrate` |
| Seven tables | `db/schema.ts`, `db/migrations/**`, `tests/unit/db/database-foundation.test.ts` |
| Two seed showrooms | `db/seed-core.ts`, `pnpm db:seed` |
| Mock vehicles in DB | `db/seed-core.ts`, database test parity assertions |
| Migration from empty | PGlite test in `tests/unit/db/database-foundation.test.ts` |
| Seed works | `pnpm db:seed`, PGlite test |
| Schema documented | `docs/DATABASE.md`, `specs/002-database-foundation/data-model.md` |
| Build passes | `pnpm build` |
| UI unchanged | No changes under `app/` or `components/` |
