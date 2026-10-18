# Implementation Plan: Platform Administration

**Branch**: `011-platform-administration` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-platform-administration/spec.md`

## Summary

Add a dedicated `/platform` operations surface, separate from `/admin`, that is
available only to identities holding an active explicit platform-operator
(`platform_admin`) membership. The surface lists every tenant and links to a
tenant detail view where an operator can inspect identity, domains, owners, and
counts, and can create a tenant, assign an owner, set or change the platform
subdomain, set plan and lifecycle status, and disable a tenant.

The feature reuses the existing `tenants`, `tenant_domains`, `profiles`, and
`tenant_members` tables. No schema migration is required: `tenants.status`,
`tenants.plan`, `tenant_domains`, and the `platform_admin` role already exist.
Platform reads and writes run in a transaction with transaction-local RLS
settings and an explicit membership re-check, so authorization is enforced both
at the request boundary and at the data boundary. Showroom admin navigation never
links to `/platform`, and the surface returns not-found to authenticated
showroom users.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Next.js 16.4 App Router

**Primary Dependencies**: Next.js server components/server actions, Drizzle ORM
0.45, zod 4, lucide-react, sonner

**Storage**: Existing PostgreSQL/Supabase schema. No migration. Uses
`tenants`, `tenant_domains`, `profiles`, `tenant_members`, `showroom_settings`,
`vehicles`, and `leads` for inspection counts.

**Testing**: Vitest 5 for authorization, validation, and service transactions;
Playwright 1.64 with the QA-only fake auth server for the operator surface;
Impeccable detector and a dedicated desktop/mobile visual QA capture.

**Target Platform**: Server-rendered Next.js deployment. `/platform` is an
internal operations route on the deployment origin, independent of tenant
hostnames.

**Project Type**: Web application (single Next.js project)

**Performance Goals**: Tenant list and detail each use a bounded set of
aggregate queries; no per-tenant query loop. Mutations are single transactions.

**Constraints**: Cross-tenant data is visible only to platform operators. No
service-role key is read or exposed. No schema change and no weakening of
existing tenant isolation. `/platform` must not appear in showroom admin
navigation. The incumbent neutral, square, thin-border design language is
preserved; the platform shell is visually distinct through a dark navigation
surface, not a new design system.

**Scale/Scope**: One operations surface (list, create, detail), five operator
capabilities plus disable, four platform modules, one QA fixture, one visual QA
capture, and documentation.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is an unfilled template (placeholder
principles, sections, and governance), so there are no project-specific MUST
principles to evaluate. The feature still honors the repository's documented
invariants: explicit authorization, tenant isolation, server-only data access,
no service-role exposure, atomic writes, and no weakened validation.

## Project Structure

### Documentation (this feature)

```text
specs/011-platform-administration/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── platform.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── platform/
│   ├── layout.tsx                 # operator-only shell
│   ├── page.tsx                   # tenant list + summary
│   └── tenants/
│       ├── new/page.tsx           # create tenant
│       └── [id]/page.tsx          # inspect + configure tenant
└── admin/                         # unchanged; never links to /platform

components/
├── platform-shell.tsx             # separate platform navigation + account
└── platform/
    ├── create-tenant-form.tsx     # create tenant client form
    └── tenant-controls.tsx        # plan/status, owner, subdomain, disable

lib/
├── platform/
│   ├── auth.ts                    # explicit platform-operator authorization
│   ├── validation.ts              # client-safe zod contracts
│   ├── tenant-service.ts          # cross-tenant reads + atomic mutations
│   ├── types.ts                   # serializable view models
│   └── actions.ts                 # 'use server' boundary + revalidation
└── tenant/session.ts              # add withPlatformSession RLS helper

db/seed-core.ts                    # deterministic platform-operator QA fixture

proxy.ts                           # protect /platform with the session proxy
lib/auth/paths.ts                  # allow safe /platform next paths

tests/
├── unit/platform/
│   ├── auth.test.ts
│   ├── validation.test.ts
│   └── tenant-service.test.ts
└── e2e/platform.spec.ts

playwright.platform.config.ts      # QA fake auth configured as platform operator
scripts/visual-qa-platform.mjs     # desktop/mobile capture for /platform

docs/PLATFORM.md                   # operations + authorization + verification
```

**Structure Decision**: Keep the single-project layout. Platform logic lives in
`lib/platform/`, mirroring `lib/admin/` and `lib/tenant/`. The surface is a thin
App Router layer over testable service functions. The platform shell is a
separate component so showroom admin navigation cannot accidentally expose it.

## Phase 0: Research and Decisions

See [research.md](./research.md). Key decisions:

1. Authorization is an active `platform_admin` membership, checked
   independently of showroom tenant context.
2. No migration: the existing schema already models status, plan, domains, and
   the platform-admin role.
3. Owner assignment accepts a stable user UUID and provisions a minimal profile
   only when one is missing.
4. Subdomains are full hostnames normalized and validated before write; the
   existing primary platform subdomain is updated in place.
5. Mutations use one transaction with `withPlatformSession` plus an in-session
   membership re-check.
6. A deterministic platform-operator seed fixture enables development and QA
   without changing production authorization behavior.

## Phase 1: Design and Contracts

See [data-model.md](./data-model.md) and
[contracts/platform.md](./contracts/platform.md).

### Route and navigation design

```text
/platform                    Tenant list (operator only)
/platform/tenants/new        Create tenant
/platform/tenants/[id]       Inspect tenant + controls
/login?next=/platform        Unauthenticated entry
```

`/platform` is not added to `components/admin-shell.tsx`. The platform shell
uses a dark neutral navigation rail and the incumbent typography, borders,
spacing, and form vocabulary. It is a separate world in route and navigation,
not in component language.

### Authorization flow

```text
request
  -> proxy: server-verified session for /platform
  -> platform layout: getCurrentUser + active platform_admin membership
  -> page: same check, then cross-tenant read
  -> action: same check, then service transaction re-check
```

An unauthenticated request redirects to `/login?next=/platform`. An
authenticated non-operator receives not-found, so the surface is not exposed.
The data layer re-checks the membership inside the platform RLS transaction.

### Mutation rules

- Create tenant: tenant + default showroom profile + optional domain + optional
  owner in one transaction.
- Assign owner: create the minimal profile if missing, then upsert membership.
  Preserve an existing `platform_admin` role instead of downgrading it.
- Set subdomain: validate, reject another tenant's hostname, update the primary
  platform subdomain in place.
- Set plan/status: validate against explicit contracts and update the tenant.
- Disable: status transition to `disabled`; public hostname resolution already
  fails closed for disabled tenants.

## Phase 2: Implementation Strategy

1. **Foundational** — types, validation, platform session helper, authorization,
   service, fixture.
2. **US1** — list and detail inspection surfaces + tests.
3. **US2** — create/configure/disable actions and forms + tests.
4. **US3** — proxy/path hardening, nav isolation, unauthorized tests.
5. **Polish** — docs, e2e, Impeccable detector, visual QA, full validation.

## Testing Strategy

- **Pure validation**: slug, hostname, plan, status, and UUID contracts.
- **Authorization**: platform operator passes; owner, staff, inactive platform
  membership, malformed user id, and unknown user fail.
- **Service transactions**: list/detail counts, create rollback on conflict,
  owner upsert, subdomain conflict, plan/status persistence, disable blocks
  hostname resolution.
- **Restricted-role RLS**: platform service succeeds for a real operator and
  fails for an owner when run as the restricted `tenant_app` role.
- **E2E**: unauthenticated redirect, operator list/detail, create, configure,
  disable, and showroom-membership denial at the service/unit boundary.
- **Visual QA**: `/platform`, `/platform/tenants/new`, and the seeded Prima
  detail route at 1440×900 and 390×844 with no horizontal overflow and no
  cross-tenant content leak.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| /platform accidentally linked in showroom admin | Static assertion in tests; separate shell component |
| RLS bypass through a privileged app connection | Explicit membership re-check inside the platform transaction |
| Partial tenant creation on conflict | Single transaction + pre-checks + unique-violation mapping |
| Owner assignment removes platform authorization | Preserve `platform_admin` role when upserting owner |
| Disabled tenant still served in development | Existing `findTenantBySlug` and `findTenantByHostname` already reject disabled tenants; test it |
| Visual surface diverges from incumbent admin | Reuse neutral palette, square borders, Inter/Jakarta; dark rail only |

## Checkpoint Validation

```bash
npx tsc --noEmit
npm test
npx playwright test --config playwright.platform.config.ts tests/e2e/platform.spec.ts
/home/adrputra/.agents/skills/impeccable/scripts/impeccable detect --json app/platform components/platform-shell.tsx components/platform
node scripts/visual-qa-platform.mjs
```
