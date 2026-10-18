# Research: Connect Public Website to Database

**Feature**: `005-public-website-database`  
**Date**: 2026-10-19

## Decision: Resolve the public tenant from the hostname

Use `findTenantByHostname` from `lib/tenant/hostname.ts` as the primary public
resolver. Normalize the `Host` header with the existing F005 normalizer and
require an active/verified domain for an active/trial tenant. In development
only, when no verified domain matches, resolve the configured showroom slug
(`NEXT_PUBLIC_SHOWROOM_SLUG`, default `prima-auto-gallery`) as a convenience for
`localhost`. In production, an unknown hostname yields no tenant.

**Rationale**: F005 already defines this as the public request path. A
development fallback keeps local DX working without weakening production
fail-closed behavior. **Alternatives considered**: hard-code Prima on localhost
(defeats multi-tenant testing), always use a default tenant (cross-tenant leak),
require host mapping in every local browser (poor DX).

## Decision: Public vehicle statuses

Treat `available`, `reserved`, and `sold` as public. Exclude `draft` and
`archived` from every public listing, detail lookup, related set, and featured
set.

**Rationale**: The legacy public list exposed published available/reserved/sold
units and hid drafts. The database folds publication and availability into one
status enum, so the public filter must encode that mapping explicitly.
**Alternatives considered**: only `available` (changes existing behavior),
include drafts (leaks unpublished inventory).

## Decision: Tenant-scoped query layer

Add `lib/public/queries.ts` with pure functions that take a database connection
and a tenant id. Each function calls `requireTenantId` before SQL and adds
`tenant_id = $tenant` to the query. The public repository resolves the tenant,
then delegates. No unscoped variant is exported.

**Rationale**: The application may connect with an elevated credential, so
application-level scoping is mandatory in addition to RLS. A pure module is
testable with PGlite and cannot accidentally depend on a Next.js request.
**Alternatives considered**: put public filters inside the page (untestable in
isolation), extend `listTenantVehicles` with UI-specific arguments (mixes
presentation concerns into the F005 security module).

## Decision: Filtering and sorting in SQL

Build the `where` clause from normalized filters and apply the sort in the
database, with a deterministic `slug`/`id` tiebreaker. Normalize query-string
values (ignore empty and non-numeric values) before building the predicate.

**Rationale**: The database is the source of truth and can apply limits/orders
without loading the full catalogue into the server component. A deterministic
tiebreaker keeps lists stable. **Alternatives considered**: fetch all tenant
vehicles and filter in JavaScript (works for twelve rows but does not scale and
weakens the database-driven claim).

## Decision: Preserve the view model

Map database rows to the existing `Vehicle` and `Showroom` types. Keep the
existing pages and card/detail markup unchanged. Add only:
- a `brands` prop for the quick-search and filter selects, derived from the
  tenant's public inventory;
- current filter values for the inventory selects;
- a not-found guard for a missing tenant or vehicle.

**Rationale**: The roadmap requires preserving the visual design. Mapping into
the existing view types keeps every component contract stable.
**Alternatives considered**: rewrite pages around database row types (large
visual-regression risk), add a new design system (out of scope).

## Decision: Showroom mapping without a schema change

Map `showroom_settings` to the existing `Showroom` type. Use `display_name`,
`tagline`, `description`, `hero_image_url`, contact fields, address, social
URLs, opening hours, and SEO fields. Stored primary/secondary colours are
carried in the view model but not applied as a public theme; F009 owns editable
settings and the white-label theming decision, and applying arbitrary tenant
colours now would conflict with the preserve-the-design constraint and contrast
safety. Derive the existing hero object:
headline from `display_name`, subheadline from `description`, and CTA from the
existing UI label. Missing optional values become empty strings or safe local
placeholders.

**Rationale**: F003's schema has no hero-copy columns, and F009's editable field
list does not include them. Adding columns would create a content model later
phases do not own. **Alternatives considered**: add hero columns now (schema
creep), hard-code Prima's hero copy (single-tenant leak), apply stored colours
now (would break the preserved palette and can create contrast failures).

## Decision: Development database fallback

`lib/db/runtime.ts` returns the shared `postgres`-backed Drizzle client when
`DATABASE_URL` is set. When it is absent:
- in `NODE_ENV === 'development'`, lazily create an in-memory PGlite database,
  apply `db/migrations`, run the deterministic seed, and cache the instance on
  `globalThis` for HMR;
- otherwise throw an explicit configuration error.

**Rationale**: The repository has no PostgreSQL server, Docker, or Supabase CLI,
yet Visual QA must render real database rows. PGlite is already the F003/F005
test engine and applies the same committed SQL. The production path remains a
real PostgreSQL connection. **Alternatives considered**: mock runtime data
(forbidden by acceptance), an in-process fake repository (does not prove the SQL
path), skip Visual QA (not allowed).

## Decision: Admin dashboard stays on legacy mock data

Move the admin dashboard's `listVehicles`/`listLeads` imports back to the legacy
`data/index.ts` arrays, matching the other still-unmigrated admin screens. The
public repository no longer exports admin mock reads.

**Rationale**: F007/F010 own the admin data migration. Keeping the admin
dashboard behavior unchanged avoids coupling an auth-protected admin surface to
public hostname resolution. **Alternatives considered**: make `listVehicles`
serve both public and admin (needs publication and tenant options that belong to
F007), return empty leads (changes the admin dashboard without a requirement).

## Decision: Visual QA

Capture the home, inventory, vehicle detail, and Tenant B home at 1440×900 and
390×844. Launch Chromium with host-resolver rules for `prima.otoweb.id` and
`tenant-b.otoweb.id`, navigate to the real tenant hostnames, and assert a visible
heading, no horizontal overflow, and the expected tenant name. Run the
`impeccable detect` mechanical scan on the changed UI and store its output with
the capture report.

**Rationale**: This proves hostname-based tenant rendering and the preserved
layout in one bounded pass. **Alternatives considered**: capture only
`localhost` (does not exercise hostname resolution), full route matrix (the
change touches only public surfaces; the standard representative matrix is
enough).
