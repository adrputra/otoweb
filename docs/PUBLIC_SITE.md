# Public Website Data Path

Status: implemented in Phase 6 (F006). Source of intent:
`docs/ROADMAP.md` §48 and `specs/005-public-website-database/`.

The public home, inventory, vehicle detail, related vehicles, featured units,
and showroom settings read from PostgreSQL. Public runtime modules do not import
the legacy `data/index.ts` catalogue. That file remains the deterministic
development seed and database-test fixture (and the still-unmigrated admin
screens scheduled for F007/F009/F010).

## Request flow

```text
request Host header
  -> resolvePublicTenant()
     -> findTenantByHostname()   (verified tenant_domains row, active/trial tenant)
     -> development only: findTenantBySlug(NEXT_PUBLIC_SHOWROOM_SLUG)
  -> tenant id
  -> tenant-scoped query (requireTenantId + tenant_id predicate)
  -> DB row -> existing Showroom / Vehicle view type
  -> unchanged public components
```

Production never substitutes a default tenant for an unknown hostname. A page
with no resolved tenant renders not-found. The three public routes declare
`dynamic = 'force-dynamic'`: they depend on the request host and the database,
so they must not be prerendered at build time.

## Modules

| Module | Responsibility |
|---|---|
| `lib/public/tenant.ts` | Server-only hostname/slug resolution and request memoization |
| `lib/public/queries.ts` | Pure tenant-scoped Drizzle reads, filters, sorting, and row-to-view mapping |
| `lib/db/runtime.ts` | `DATABASE_URL` client, or development-only in-memory PGlite fallback |
| `lib/repositories.ts` | Page-facing public facade |
| `lib/tenant/memberships.ts` | `findTenantBySlug` for the development fallback |
| `app/page.tsx` | Home: showroom, featured units, tenant brand options |
| `app/cars/page.tsx` | Inventory: tenant showroom, filters, sorting, count |
| `app/cars/[slug]/page.tsx` | Detail: stored unit, images, WhatsApp, related units |
| `components/showroom.tsx` | Existing cards/header/filters; brand options are props |

## Public status model

The database folds publication and availability into `vehicles.status`.

| Stored status | Public? | View state |
|---|---|---|
| `available` | yes | `available` |
| `reserved` | yes | `reserved` |
| `sold` | yes | `sold` |
| `draft` | no | — |
| `archived` | no | — |

Featured units are public vehicles with `featured = true`, scoped to the tenant.
Related units are up to three other public vehicles from the same tenant and
body type.

## Filtering and sorting

Supported filters: brand, model, transmission, fuel, year, minimum price,
maximum price, and maximum mileage. Empty or malformed query values are ignored.
Supported sorts: `terbaru` (default), `harga-terendah`, `harga-tertinggi`,
`tahun-terbaru`, `km-terendah`. Every sort has a deterministic slug/id
tiebreaker.

## Showroom mapping

`showroom_settings` supplies the public name, tagline, description, logo, hero
image, colours, contact details, address, map link, social links, opening hours,
and SEO fields. The existing hero object is derived: headline from the display
name, subheadline from the description, and the existing CTA label. The F003
schema has no hero-copy columns, and F009 does not make them editable.

## Development runtime

- With `DATABASE_URL`, the normal PostgreSQL/Supabase connection is used.
- Without `DATABASE_URL` in development, `lib/db/runtime.ts` lazily creates an
  in-memory PGlite database, applies `db/migrations`, and runs the deterministic
  seed. This keeps `next dev`, Playwright, and Visual QA runnable without Docker.
- In production, a missing `DATABASE_URL` is an explicit error. PGlite is never
  a production fallback.

## Verification

```bash
npx vitest run tests/unit/public
npx tsc --noEmit
npm test
npx playwright test tests/e2e/home.spec.ts
pnpm visual:qa
```

`pnpm visual:qa` starts `next dev`, resolves `prima.otoweb.id` and
`tenant-b.otoweb.id` through Chromium host-resolver rules, captures desktop and
mobile screenshots, and writes `.visual-qa/reports/capture.json` plus a
markdown report.

## Boundaries

- No public runtime import of `data/index.ts`.
- No unscoped vehicle/settings query. A missing or malformed tenant id throws
  before SQL.
- No admin CRUD, image upload, settings editing, lead capture, SEO
  productionization, or subdomain routing beyond the F005 resolver.
- The service role and database credentials never reach the browser.
