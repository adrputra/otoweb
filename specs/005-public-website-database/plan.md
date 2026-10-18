# Implementation Plan: Connect Public Website to Database

**Branch**: `005-public-website-database` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-public-website-database/spec.md`

## Summary

Replace the public runtime dependency on `data/index.ts` with tenant-scoped
PostgreSQL reads. The public home, inventory, vehicle detail, and related
vehicles will resolve the active tenant from the request hostname using the F005
resolver, then query `showroom_settings`, `vehicles`, and `vehicle_images`
through Drizzle with a mandatory tenant id. Filtering and sorting move into the
database query. The existing public pages and components keep their markup,
classes, fonts, and responsive composition; only data sources and the minimum
prop wiring change. Stored tenant colours are carried in the Showroom view
model but are not applied as a theme in this feature; F009 owns the settings
UI and the white-label theming decision. The admin dashboard is moved back to the legacy mock data it
already used so the public repository has no mock-catalogue import. Tests prove
tenant scoping, filtering, sorting, featured selection, detail/related
behaviour, and the absence of mock imports in public runtime modules. Visual QA
captures the changed routes at desktop and mobile widths.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16.4.0, React 19.

**Primary Dependencies**: Drizzle ORM 0.45 with `postgres` (server), Zod 4 for
environment validation, `@electric-sql/pglite` for the embedded test and
development database, Vitest 5. No new runtime dependency is required.

**Storage**: PostgreSQL (Supabase in production) with the existing F003 schema:
`tenants`, `tenant_domains`, `showroom_settings`, `vehicles`, `vehicle_images`.
Production reads use `DATABASE_URL`. This repository has no PostgreSQL server or
Docker, so a development-only, in-memory PGlite instance applies the committed
migrations and deterministic seed when `DATABASE_URL` is absent and
`NODE_ENV === 'development'`. Production throws when `DATABASE_URL` is missing.

**Testing**: Vitest under `tests/unit/public/` in the `node` environment using the
existing PGlite harness and seed fixtures. The full gate remains
`npx tsc --noEmit` and `npm test`, plus the affected Playwright smoke test and a
single public Visual QA capture.

**Target Platform**: Next.js App Router server runtime, Node.js 24, Supabase
PostgreSQL. Public tenant resolution and database access are server-only.

**Project Type**: Single Next.js application with server libraries and an
embedded database test harness.

**Performance Goals**: One hostname lookup and one showroom query per request;
one vehicle query plus one image query for a listing; no per-card N+1 query.
React `cache` deduplicates tenant resolution within a request.

**Constraints**: Tenant queries always require and filter by a tenant id. No
public runtime import of `data/index.ts`. No visual redesign. No admin CRUD,
image upload, settings editing, lead capture, or SEO productionization. The
service role never reaches the browser.

**Scale/Scope**: Two seed tenants, twelve Prima vehicles, one Tenant B settings
row, three public routes, two shared public components, one public repository, a
small tenant-resolution module, and one visual QA capture.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unfilled project template (no ratified
principles). Per the plan/converge guidance, constitution checks are skipped
gracefully rather than failing. No constitution bootstrap exists for this
feature.

**Result**: PASS (no ratified constraints to violate).

## Project Structure

### Documentation (this feature)

```text
specs/005-public-website-database/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── public-site-data.md
├── checklists/
│   └── requirements.md
└── tasks.md             # created by the tasks capability
```

### Source Code (repository root)

```text
app/
├── page.tsx                       # home: DB showroom + featured vehicles + brands
├── cars/
│   ├── page.tsx                   # inventory: DB showroom, filters, sort
│   └── [slug]/page.tsx            # detail: DB vehicle, images, related
└── admin/page.tsx                 # keeps legacy mock dashboard data

components/
└── showroom.tsx                   # brand options become props; markup unchanged

lib/
├── repositories.ts                # public data facade over tenant-scoped queries
├── public/
│   ├── tenant.ts                  # server-only public tenant resolution (hostname)
│   └── queries.ts                 # tenant-scoped Drizzle reads + DB → view mapping
├── tenant/
│   └── memberships.ts             # add findTenantBySlug for the dev fallback
└── db/
    └── runtime.ts                 # DATABASE_URL client or dev-only PGlite fallback

scripts/
└── visual-qa.mjs                  # public routes, desktop + mobile, host mapping

tests/unit/public/
├── repositories.test.ts           # PGlite: tenant scope, featured, filter, sort, detail, related
├── tenant-resolution.test.ts      # hostname/slug resolution and production fail-closed
└── no-mock-catalogue.test.ts      # public runtime source scan

docs/
└── PUBLIC_SITE.md                 # data path, tenant resolution, local runtime note
```

**Structure Decision**: Single-project layout matching the repository. Public
data-access logic is split into a server-only tenant resolver
(`lib/public/tenant.ts`) and pure tenant-scoped query/mapping functions
(`lib/public/queries.ts`) so tests exercise the database path without a Next.js
request. `lib/repositories.ts` stays the page-facing facade. The existing pages
and component file keep their markup; the only component signature additions are
the tenant-derived brand list and current filter values.

## Phase 0 — Research decisions

See [research.md](./research.md). Key decisions:

1. **Tenant resolution**: hostname through the F005 verified-domain resolver,
   with a development-only configured-slug fallback. Production never falls back.
2. **Public status model**: `available`, `reserved`, and `sold` are public;
   `draft` and `archived` are not.
3. **Query ownership**: new public query functions require a tenant id through
   `requireTenantId`, filter by it, and never expose an unscoped variant.
4. **Mapping**: DB rows map to the existing `Vehicle` and `Showroom` view types
   so no presentation component changes shape.
5. **Local runtime**: PGlite applies the real migrations and seed only in
   development when `DATABASE_URL` is absent; production fails loudly.
6. **Mock boundary**: `data/index.ts` remains a seed/test fixture only. A source
   scan proves public runtime modules do not import it.

## Phase 1 — Design

- [data-model.md](./data-model.md) maps stored tenant, showroom, vehicle, and
  image rows to the existing public view types.
- [contracts/public-site-data.md](./contracts/public-site-data.md) pins the public
  repository and query contracts, including tenant-scope and failure semantics.
- [quickstart.md](./quickstart.md) lists the runnable verification scenarios.

### Post-design Constitution Check

Still no ratified principles; no violation introduced. **Result: PASS.**

## Complexity Tracking

No constitution violations. The deliberate choices are:

| Choice | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Pure query module + thin page facade | Lets tests exercise tenant-scoped SQL without a Next.js request context | Testing `headers()`-dependent functions directly would either mock Next internals or skip the database path |
| Dev-only PGlite runtime | The repository has no PostgreSQL/Docker; Visual QA still needs a real database | A mock-data fallback would violate the acceptance criterion; shipping PGlite in production is avoided by the `NODE_ENV` and `DATABASE_URL` guards |
| Derived hero copy | F003's `showroom_settings` has no hero-copy columns and F009 does not list them as editable | Adding unrequested columns would create a content model F009 does not own |
