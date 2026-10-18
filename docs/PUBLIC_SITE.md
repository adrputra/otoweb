# Public Website Data Path

Status: implemented in Phase 6 (F006). Source of intent:
`docs/ROADMAP.md` §48 and `specs/005-public-website-database/`.

The public home, inventory, vehicle detail, related vehicles, featured units,
and showroom settings read from PostgreSQL. Public runtime modules do not import
the legacy `data/index.ts` catalogue. That file remains the deterministic
development seed and database-test fixture (and the still-unmigrated lead/admin
screens scheduled for F010).

## Request flow

```text
request Host header
  -> resolvePublicTenant()
     -> findTenantByHostname()
          -> exact active/verified tenant_domains row
          -> wildcard <slug>.<TENANT_ROOT_DOMAIN>
          -> development-only *.localhost alias
     -> development only, bare localhost/127.0.0.1:
          findTenantBySlug(NEXT_PUBLIC_SHOWROOM_SLUG)
  -> tenant id
  -> tenant-scoped query (requireTenantId + tenant_id predicate)
  -> DB row -> existing Showroom / Vehicle view type
  -> unchanged public components
```

Production never substitutes a default tenant for an unknown hostname. A page
with no resolved tenant renders not-found. The three public routes declare
`dynamic = 'force-dynamic'`: they depend on the request host and the database,
so they must not be prerendered at build time. Wildcard and development host
behavior is documented in [`SUBDOMAIN_ROUTING.md`](./SUBDOMAIN_ROUTING.md).

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
image, colours, contact details, address (street, city, province, postal code,
map link), social links, opening hours, and SEO fields. F009 makes every one of
these fields editable in `/admin/settings/showroom`; the public routes read the
saved row on each request. The existing hero object is derived: headline from
the display name, subheadline from the description, and the existing CTA label.

The page root carries CSS variables derived from the tenant's primary and
secondary colours. `lib/theme.ts` darkens the primary until small text meets
4.5:1 on white and chooses a readable foreground for filled surfaces, so the
incumbent neutral/amber layout is preserved while each tenant gets a distinct
accent. The saved logo renders in the public header; social links and full
address details render in the contact/footer area.

Public metadata comes from `lib/seo/metadata.ts` through the stable
`lib/public/metadata.ts` facade: the home title/description use the stored SEO
fields, inventory/detail keep contextual titles, and empty values fall back to
the showroom identity. Canonical URLs, OpenGraph, the tenant-specific
`sitemap.xml`/`robots.txt`, JSON-LD, and the sold-listing policy are
implemented by F011 and documented in `docs/SEO.md`.

## Contact form and WhatsApp leads

F010 adds inquiry capture to the public surfaces:

- The home contact section renders `components/public-contact-form.tsx`. Name,
  phone, and message are required; email is optional. The server action resolves
  the tenant from the verified hostname and writes a `contact_form` lead with
  status `new` for that tenant.
- The vehicle-detail WhatsApp action points at
  `/api/public/whatsapp?vehicle=<slug>`; the footer action uses the same route
  without a vehicle. The route records an anonymous `whatsapp` lead and then
  redirects to the tenant's configured `wa.me` number. A missing number returns
  the visitor to the contact area instead of inventing a number.

No tenant id is accepted from the browser, and a foreign vehicle slug cannot be
attached to the lead. See `docs/LEADS.md` for the full contract, statuses, and
admin dashboard.

## Development runtime

- With `DATABASE_URL`, the normal PostgreSQL/Supabase connection is used.
- Without `DATABASE_URL` in development, `lib/db/runtime.ts` lazily creates an
  in-memory PGlite database, applies `db/migrations`, and runs the deterministic
  seed. This keeps `next dev`, Playwright, and Visual QA runnable without Docker.
- In production, a missing `DATABASE_URL` is an explicit error. PGlite is never
  a production fallback.
- Tenant hosts in development are `prima.localhost` and `tenant-b.localhost`
  (plus `<slug>.localhost`). Bare `localhost`/`127.0.0.1` keeps the configured
  default showroom; unknown named local subdomains render not-found. See
  [`SUBDOMAIN_ROUTING.md`](./SUBDOMAIN_ROUTING.md).

## Verification

```bash
npx vitest run tests/unit/public
npx tsc --noEmit
npm test
npx playwright test tests/e2e/home.spec.ts
npx playwright test tests/e2e/subdomain-routing.spec.ts
npx playwright test --config playwright.admin.config.ts tests/e2e/admin-leads.spec.ts
pnpm visual:qa
npm run visual:qa:subdomain
```

`pnpm visual:qa` starts `next dev`, resolves `prima.otoweb.id` and
`tenant-b.otoweb.id` through Chromium host-resolver rules, captures desktop and
mobile screenshots, and writes `.visual-qa/reports/capture.json` plus a
markdown report.

## Boundaries

- No public runtime import of `data/index.ts`.
- No unscoped vehicle/settings query. A missing or malformed tenant id throws
  before SQL.
- No admin CRUD, image upload, or settings editing here. SEO output is
  documented in `docs/SEO.md`; subdomain routing beyond the F005 resolver is
  still out of scope. Lead capture is documented in `docs/LEADS.md`; contact
  submissions and WhatsApp actions are the only public writes.
- The service role and database credentials never reach the browser.
