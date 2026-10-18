# Research: Admin Vehicle CRUD

**Feature**: `006-admin-vehicle-crud` | **Date**: 2026-10-19

## Decisions

### D1 — Reuse the F003 schema; no migration

`vehicles.status` already encodes both publication and availability
(`draft | available | reserved | sold | archived`) and owns `published_at`,
`reserved_at`, and `sold_at`. F006 documented the public mapping, so F007 maps
the same column in the admin direction. Adding a second publication column would
split one source of truth and break the public queries. **Decision:** no schema
change.

### D2 — Server actions over route handlers

The existing admin form and list are client components that call server actions.
Keeping that shape preserves the incumbent UI and avoids a parallel REST surface
that the browser would have to authenticate separately. **Decision:** one
`'use server'` action module wrapping a testable service module.

### D3 — Service layer takes an explicit tenant actor

Next's request helpers (`cookies`, `headers`) are not usable in unit tests. The
mutation logic therefore lives in a service that accepts `{tenantId, userId,
isPlatformAdmin}` and a Drizzle database. Actions resolve the context from the
request, authorize `manage_vehicles`, then call the service. **Decision:** all
business rules are testable against PGlite without a Next request.

### D4 — Transaction-local RLS for writes

Every mutation runs inside `withTenantSession`, which sets `app.tenant_id`,
`app.user_id`, and `app.is_platform_admin` transaction-locally. Queries also add
`tenant_id = $tenant`, matching the defence-in-depth pattern from F005.
**Decision:** mutations use `withTenantSession`; reads reuse the tenant-filtered
scoped queries used by the public site.

### D5 — Shared Zod schema is the validation contract

`lib/validation/vehicle.ts` is a pure module imported by both the client form
(`zodResolver`) and the service (`safeParse`). The server is authoritative and
returns flattened field errors. **Decision:** one schema, two consumers; the
client copy improves feedback but never replaces the server check.

### D6 — Stable slugs on edit; unique slugs on create/duplicate

Public URLs must not break when an admin corrects a model name. Editing keeps the
existing slug. Creating or duplicating generates a slug from
brand/model/variant/year and appends a numeric suffix until it is unique inside
the tenant. **Decision:** slug is immutable after insert.

### D7 — Lifecycle transitions

| Operation | Allowed from | Result |
|---|---|---|
| publish | draft, archived | `available`, `published_at = now` when first published |
| reserve | available | `reserved`, `reserved_at = now` |
| sell | available, reserved | `sold`, `sold_at = now` |
| archive | any non-archived | `archived` |
| delete | any | row removed; images cascade |

Publishing a draft is the acceptance path. Editing does not silently promote
`reserved`/`sold` back to available. Saving a published unit keeps its current
public status (`available`/`reserved`/`sold`).

### D8 — Duplicate copies data and image rows, not media

Duplication is a database copy: all vehicle fields become a `draft` with a
unique `-copy` slug and image rows are re-inserted with new ids at the same
positions. No bytes are uploaded or copied; Cloudinary upload is F008.
**Decision:** duplication is safe in F007 and leaves media lifecycle to F008.

### D9 — Images in the form are out of scope

F008 owns upload, ordering, cover selection, and deletion. F007 preserves stored
image URLs for display and duplicate. Newly selected browser previews are not
persisted, and F007 does not expose a misleading success state for them.

### D10 — Admin data path replaces mock reads, not mock seed data

`data/index.ts` remains the deterministic F003 seed and unit-test fixture, as
documented in F006. The admin vehicle list, form, dashboard vehicle counts, and
edit page read the database. Leads/staff/settings remain on their later phases.

### D11 — Visual QA needs a controllable auth provider

The repository has no Supabase project or PostgreSQL server. Visual QA starts a
small fake GoTrue HTTP endpoint that returns the seeded Prima profile for a
crafted `@supabase/ssr` session cookie. The Next server still runs the real
proxy, admin layout, tenant resolver, RLS session, and database code. No
production auth bypass is added: the fake provider exists only in the QA script.

## Alternatives considered

- **Route handlers + fetch**: rejects the existing server-action shape and adds
  a second authorization boundary.
- **Client-side writes to Supabase**: exposes credentials and bypasses the
  tenant service; rejected by F005 boundaries.
- **Reusing the public `toVehicle` mapper**: it hard-codes `publication:
  'published'` and drops draft/archived rows; the admin needs the inverse view.
- **Adding a `publication` column**: duplicates state and risks public/admin
  disagreement.
- **Editing slugs**: breaks already-shared public links for a cosmetic change.

## Risks

- RLS is bypassed by the owner role in local PGlite; the service still filters
  by tenant and the restricted-role suite from F005 remains the RLS proof.
- The admin dev runtime must use `getAppDatabase()` (PGlite fallback), not the
  production-only `getDatabase()`. `lib/tenant/server.ts` is updated so the admin
  layout and actions share the dev fallback.
- The fake auth cookie format is version-specific; the QA script derives the
  cookie name and base64url encoding from `@supabase/ssr`'s documented defaults.
