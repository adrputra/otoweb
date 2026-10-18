# Implementation Plan: Multi-Tenant Security

**Branch**: `004-multi-tenant-security` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-multi-tenant-security/spec.md`

## Summary

Add the tenant-security layer that sits between F004 authentication and every
tenant-owned read or write. The feature delivers: tenant membership lookup,
deterministic tenant-context resolution (explicit tenant → hostname → single
membership), a fail-closed hostname resolver over `tenant_domains`, role-based
permission helpers, tenant-scoped Drizzle query functions, a transaction-scoped
database session helper, PostgreSQL row-level security policies for all seven
tenant-owned tables, and an isolation suite that attempts cross-tenant attacks from
both the application layer and a restricted database role. The existing F003 schema
and seed fixtures are reused unchanged; a new RLS-only migration is added. No public
or admin screen is restyled: the admin layout's existing auth guard is extended in a
server library to require a valid tenant context, so failing requests are redirected
before any tenant data renders.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16.4.0, React 19.

**Primary Dependencies**: Drizzle ORM 0.45 with `postgres` (server), Zod 4 for input
validation, `@electric-sql/pglite` for the embedded PostgreSQL proof, Vitest 5. No new
runtime dependency is required.

**Storage**: PostgreSQL (Supabase in production, PGlite in tests). Existing tables:
`tenants`, `tenant_domains`, `profiles`, `tenant_members`, `showroom_settings`,
`vehicles`, `vehicle_images`. New migration `0001_tenant-isolation.sql` adds RLS
helper functions and policies only; no table or column changes.

**Testing**: Vitest unit suites under `tests/unit/tenant/` in the `node` environment
(PGlite) plus pure-function suites. The full gate remains `npx tsc --noEmit` and
`npm test`.

**Target Platform**: Next.js App Router server runtime, Node.js 24, Supabase
PostgreSQL. The tenant modules are server-only; nothing in `lib/tenant/` is imported
by a client component.

**Project Type**: Single Next.js application with server libraries and an embedded
database test harness.

**Performance Goals**: Constant-cost resolution per request: one membership query and
at most one hostname lookup. No N+1 queries; admin context resolution runs once per
request in the layout guard.

**Constraints**: No live Supabase or Docker in this environment; the database proof
uses PGlite. Production may connect with an elevated credential, so application-level
scoping is mandatory in addition to RLS. The browser never receives the service role.
No UI redesign, no F006 public queries, no F007 CRUD.

**Scale/Scope**: Two seed tenants (prima, tenant-b), seven tenant-owned tables, one
migration, roughly seven tenant library modules, seven isolation test files, and one
documentation file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unfilled project template (no ratified
principles). Per the plan/converge guidance, constitution checks are skipped
gracefully rather than failing. No constitution bootstrap exists for this feature.

**Result**: PASS (no ratified constraints to violate).

## Project Structure

### Documentation (this feature)

```text
specs/004-multi-tenant-security/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── tenant-security.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by the tasks capability
```

### Source Code (repository root)

```text
db/
├── migrations/
│   └── 0001_tenant-isolation.sql      # RLS helper functions + policies
├── migrations/meta/                   # journal + snapshot for 0001
└── schema.ts                           # unchanged F003 schema

lib/tenant/
├── types.ts                            # tenant, membership, context, denial, capability types
├── hostname.ts                         # hostname normalization + directory lookup
├── memberships.ts                      # membership queries over Drizzle
├── context.ts                          # pure, deterministic context resolution
├── permissions.ts                      # role → capability matrix + checks
├── scoped-queries.ts                   # tenant-scoped reads; mandatory tenant id
├── session.ts                          # transaction-local app.tenant_id/user/admin settings
├── guards.ts                           # API/data-layer authorization guards
└── server.ts                           # production resolver, admin requirement, server-only guard

lib/auth/
└── server.ts                           # requireAdminUser() now also requires tenant context

tests/unit/tenant/
├── fixtures.ts                         # deterministic prima / tenant-b fixtures
├── hostname.test.ts
├── context.test.ts
├── permissions.test.ts
├── scoped-queries.test.ts              # PGlite: application-layer isolation
├── rls.test.ts                         # PGlite: restricted-role RLS attacks
└── service-role.test.ts                # source/env/client-boundary scans

docs/
└── TENANCY.md                          # model, precedence, matrix, RLS, how to run tests
```

**Structure Decision**: Single-project layout matching the existing repository. Tenant
logic lives in a dedicated `lib/tenant/` server-only module; tests mirror it under
`tests/unit/tenant/`; the only SQL change is an RLS migration generated as a custom
Drizzle migration. No presentation files change.

## Phase 0 — Research decisions

See [research.md](./research.md). Key decisions:

1. **Context precedence**: explicit requested tenant → hostname → single active
   membership. Conflicts and ambiguity fail closed; platform administrators may cross
   tenants only with an explicit request.
2. **Active tenant states**: `active` and `trial` are usable; `suspended` and
   `disabled` deny access. Tenant B is `trial`, so this is required.
3. **RLS model**: server-controlled GUCs (`app.tenant_id`, `app.user_id`,
   `app.is_platform_admin`) read through stable SQL helpers; policies use both `USING`
   and `WITH CHECK`. A `SECURITY DEFINER` owner check avoids recursive membership
   policies.
4. **Enforcement layering**: application scoping is primary; RLS is the independent
   database boundary. The RLS proof runs under a restricted, non-owning role because a
   superuser/table owner bypasses RLS.
5. **Service-role boundary**: no public env prefix, no client import, and a runtime
   browser guard in server modules, backed by a source scan test.

## Phase 1 — Design

- [data-model.md](./data-model.md) defines the context, membership, denial, and
  capability models.
- [contracts/tenant-security.md](./contracts/tenant-security.md) pins the public
  library contracts and failure semantics.
- [quickstart.md](./quickstart.md) lists the runnable isolation scenarios.
- The RLS migration is `db/migrations/0001_tenant-isolation.sql`.

### Post-design Constitution Check

Still no ratified principles; no violation introduced. **Result: PASS.**

## Complexity Tracking

No constitution violations. Two deliberate design choices:

| Choice | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Application scoping **and** RLS | Production may use an elevated connection; RLS must still protect tenant-facing/direct access | RLS alone is bypassed by privileged connections; application scoping alone provides no database boundary |
| Restricted role in the RLS test | Superusers and table owners bypass RLS even with `FORCE` | Testing as the owner would pass vacuously and prove nothing |
