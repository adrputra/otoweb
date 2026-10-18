# Quickstart: Multi-Tenant Security

**Feature**: `004-multi-tenant-security`

## Prerequisites

- Node.js 24 and the repository dependencies (`pnpm install`).
- No Docker, live Supabase, or network access is required.
- The embedded database proof uses `@electric-sql/pglite` and the committed
  migrations.

## Run the isolation suite

```bash
npx vitest run tests/unit/tenant
```

Expected: hostname, context, permissions, scoped-query, RLS, and service-role suites
all pass. The RLS suite runs under a restricted database role; a pass means
PostgreSQL — not just application code — rejected the cross-tenant attempts.

## Run the full gates

```bash
npx tsc --noEmit
npm test
```

Both must exit 0. Do not proceed if any tenant isolation test fails.

## Scenarios proven by the suite

1. **Hostname resolution** — `prima.otoweb.id` → prima, `tenant-b.otoweb.id` →
   tenant-b, mixed case/port/trailing dot remain correct, unknown and inactive hosts
   resolve to nothing.
2. **Context resolution** — single membership resolves; missing/inactive membership
   denies; tenant mismatch denies; ambiguous multi-membership denies; platform admin
   crosses tenants only explicitly; suspended/disabled tenants deny.
3. **Permissions** — owner allows all; staff allows view/vehicles/leads and denies
   staff/settings; inactive and mismatched memberships deny before role evaluation.
4. **Application isolation** — a prima-scoped query cannot see a tenant-b vehicle,
   settings row, image, or membership; exact-id lookups return nothing; missing tenant
   id fails closed.
5. **RLS isolation** — under a restricted role, a prima tenant setting selects only
   prima rows; a tenant-b row cannot be selected, inserted, updated, or deleted; no
   tenant setting returns no rows.
6. **Service-role boundary** — scans find no browser-reachable service-role reference,
   `.env.example` has placeholders only, and server-only modules reject a browser-like
   context.

## Manual database check (optional, production-like)

After applying migrations to a database with the `authenticated` role:

```sql
set local app.tenant_id = '11111111-1111-4111-8111-111111111111';
set local app.user_id = '50000000-0000-4000-8000-000000000001';
select count(*) from vehicles;          -- prima count only
set local app.tenant_id = '22222222-2222-4222-8222-222222222222';
select count(*) from vehicles;          -- tenant-b count only
```

Run as a role without `BYPASSRLS`; the table owner/superuser bypasses RLS by design.

## Expected evidence

- `.sdd-toolbox/waves/004-multi-tenant-security.json` — computed wave plan.
- Vitest summary lines for every suite.
- `npx tsc --noEmit` exit 0.
- `docs/TENANCY.md` — model and operations reference.
- `VISUAL_QA: n/a` — no presentation surface changes.
