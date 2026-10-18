# Multi-Tenant Security

Status: implemented in Phase 5 (F005). Source of intent:
`docs/ROADMAP.md` §47 and `specs/004-multi-tenant-security/`.

This feature sits between authentication (F004) and every tenant-owned read or
write. It answers two questions before data is touched:

1. **Which tenant is this request?** (`resolveTenantContext`)
2. **May this user act on that tenant, and in which capacity?** (`authorizeTenantAccess`)

PostgreSQL row-level security (RLS) independently enforces the same tenant
boundary when a connection runs with tenant-scoped settings.

## What exists

| Artifact | Purpose |
|---|---|
| `lib/tenant/types.ts` | Tenant, membership, context, denial, hostname, and capability types |
| `lib/tenant/hostname.ts` | Host normalization and verified-domain lookup |
| `lib/tenant/memberships.ts` | Membership and tenant lookups over Drizzle |
| `lib/tenant/directory.ts` | Injectable directory used by the request resolver |
| `lib/tenant/context.ts` | Pure, deterministic tenant-context resolution |
| `lib/tenant/permissions.ts` | Role → capability matrix |
| `lib/tenant/guards.ts` | Tenant-match and capability authorization guards |
| `lib/tenant/scoped-queries.ts` | Tenant-scoped reads; a tenant id is mandatory |
| `lib/tenant/session.ts` | Transaction-local RLS settings |
| `lib/tenant/server.ts` | Request resolver, admin requirement, server-only guard |
| `lib/auth/server.ts` | `requireAdminUser()` now requires a valid tenant context |
| `db/migrations/0001_tenant-isolation.sql` | RLS helper functions and policies |
| `tests/unit/tenant/` | Fixtures plus the isolation and attack suites |
| `docs/TENANCY.md` | This document |

## Fixtures

The deterministic F003 seed provides both fixtures:

| Fixture | Tenant | Slug | Status | Hostname | Data |
|---|---|---|---|---|---|
| `prima` | Prima Auto Gallery | `prima-auto-gallery` | `active` | `prima.otoweb.id` | 12 vehicles, images, settings, owner membership |
| `tenant-b` | Tenant B Test Showroom | `tenant-b-test-showroom` | `trial` | `tenant-b.otoweb.id` | settings and owner membership; tests insert a tenant-b vehicle |

`tests/unit/tenant/fixtures.ts` re-exports the stable ids. Tests never rely on
row order or timestamps.

## Active states

- Tenants: `active` and `trial` are usable. `suspended` and `disabled` deny all
  access.
- Memberships: only `status = 'active'` participates.

## Context precedence

```text
explicit requested tenant  (trusted server route)
        ↓
verified request hostname  (tenant_domains)
        ↓
single active membership
```

Failure rules:

| Condition | Result |
|---|---|
| No server-verified user | `unauthenticated` |
| No memberships | `no_membership` |
| Memberships exist but none active | `inactive_membership` |
| Active membership, tenant suspended/disabled | `tenant_unavailable` |
| Selected tenant not held by the user (non-admin) | `tenant_mismatch` |
| Requested tenant id not found | `unknown_tenant` |
| Multiple memberships, no signal | `ambiguous` |
| Hostname and explicit tenant disagree | `tenant_mismatch` |

A member with a single active membership and an unknown hostname (for example
`localhost` in development) resolves to that membership. A hostname that maps to
another tenant is a conflict, not a fallback.

### Platform administrators

A `platform_admin` membership may act on any active/trial tenant when the tenant
is selected explicitly or by hostname. Cross-tenant context has
`membershipId: null` and `role: 'platform_admin'`. Without a tenant signal, the
administrator resolves to their own single membership; multiple memberships
remain ambiguous.

## Hostname resolution

`normalizeHostname` trims, lowercases, strips one trailing dot and a numeric
port, and rejects paths, queries, userinfo, IPv6 literals, malformed labels, and
values over 253 characters. `findTenantByHostname` resolves in this order:

1. **Exact registered domain** — a matching `tenant_domains.hostname` with
   `status = 'active'`, a non-null `verified_at`, and a tenant in `active` or
   `trial`. A `custom_domain` row must additionally have
   `verification_status = 'verified'` and `ssl_status = 'active'`; otherwise the
   host fails closed.
2. **Wildcard tenant host** — a single-label subdomain of
   `TENANT_ROOT_DOMAIN` (default `otoweb.id`) resolves by tenant slug, for
   example `prima-auto-gallery.otoweb.id`. This requires no per-host row.
3. **Development alias** — outside production, a `*.localhost` label resolves
   from an active, verified platform subdomain whose first label matches
   (`prima.localhost`) or from the tenant slug.

Unknown, unverified, inactive, multi-label, suffix-spoofed, or malformed hosts
resolve to no tenant. An exact inactive/unverified domain does **not** fall
through to wildcard inference, and a pending/failed custom domain does not serve
traffic. There is no default-tenant fallback.

Custom domains are registered and verified from the platform console through a
server-only provider boundary. The tenant's platform subdomain is a separate
hostname and remains available as a fallback for every custom-domain state. See
[`CUSTOM_DOMAINS.md`](./CUSTOM_DOMAINS.md).

Development host behavior is documented in
[`SUBDOMAIN_ROUTING.md`](./SUBDOMAIN_ROUTING.md).

## Permission matrix

| Capability | owner | staff | platform_admin |
|---|---|---|---|
| `view` | allow | allow | allow |
| `manage_vehicles` | allow | allow | allow |
| `manage_leads` | allow | allow | allow |
| `manage_staff` | allow | deny | allow |
| `manage_settings` | allow | deny | allow |

The tenant-match check runs before the capability check. A staff member can
never reuse a role across a tenant boundary.

## Tenant-scoped queries

`lib/tenant/scoped-queries.ts` exposes:

```text
getTenantById
listTenantDomains
getShowroomSettings
listTenantVehicles
getTenantVehicleBySlug
listTenantVehicleImages
listTenantMembers
```

Every function requires a tenant id. A missing or malformed id throws
`TenantScopeError` **before** SQL runs. These functions always add
`tenant_id = $tenant`, even when RLS is active. Cross-tenant identifiers return
`null`, `[]`, or zero rows.

## Row-level security

Migration `0001_tenant-isolation.sql` adds:

- `app.current_tenant_id()` — safe UUID read of `app.tenant_id`
- `app.current_user_id()` — safe UUID read of `app.user_id`
- `app.is_platform_admin()` — requires the `app.is_platform_admin` setting **and** a real active `platform_admin` membership; a direct caller cannot self-promote by setting the flag
- `app.is_tenant_owner()` — `SECURITY DEFINER` owner check that avoids recursive
  membership policy evaluation

RLS is enabled **and forced** on `tenants`, `tenant_domains`, `profiles`,
`tenant_members`, `showroom_settings`, `vehicles`, and `vehicle_images`. Policies
cover SELECT, INSERT, UPDATE, and DELETE with matching `USING`/`WITH CHECK`
clauses. Missing or malformed settings resolve to null/false, so an unscoped
connection sees no tenant rows.

### Transaction-local settings

`withTenantSession(db, { tenantId, userId, isPlatformAdmin }, callback)` opens a
transaction and sets:

```sql
select set_config('app.tenant_id', $1, true);
select set_config('app.user_id', $2, true);
select set_config('app.is_platform_admin', $3, true);
```

The `true` third argument scopes each value to the transaction, so a pooled
connection cannot leak one request's tenant into another. The platform-admin
setting is additionally checked against an active `platform_admin` membership
inside a `SECURITY DEFINER` function, so setting the flag alone grants nothing.

### Why the proof uses a restricted role

PostgreSQL superusers — and table owners without `FORCE` — bypass RLS. The RLS
suite therefore creates a `tenant_app` role with no `BYPASSRLS`, grants it table
privileges, and `SET ROLE`s to it. A test that ran as the owner would prove
nothing.

## Admin enforcement

The existing proxy remains the primary authentication boundary. The admin layout
then calls `requireAdminUser()`, which now also resolves a tenant context. An
authenticated user with no valid tenant is redirected to the public home rather
than shown admin content. No presentation markup changed in F005.

## Service-role boundary

- The service-role key is not read by application code and is never exposed with
  a `NEXT_PUBLIC_` prefix.
- `.env.example` contains placeholders only and no service-role assignment.
- Browser-reachable modules must not import `lib/tenant/*`, `db/client`, or the
  server Supabase backend. `tests/unit/tenant/service-role.test.ts` enforces
  this.
- `assertServerOnly()` throws when tenant server code is evaluated with a defined
  `window`.

Never add the service-role key to the browser bundle. It bypasses every RLS
policy in this document.

## Running the isolation suite

```bash
npx vitest run tests/unit/tenant
# or, after the package script is installed:
pnpm test:tenant
```

The suite covers:

| File | Proof |
|---|---|
| `hostname.test.ts` | normalization, both fixtures, unknown/malformed/inactive hosts |
| `context.test.ts` | precedence and every denial code |
| `server-context.test.ts` | request resolver, fail-closed errors, server-only guard |
| `scoped-queries.test.ts` | application-level cross-tenant reads/writes |
| `rls.test.ts` | restricted-role SELECT/INSERT/UPDATE/DELETE attacks |
| `permissions.test.ts` | owner/staff/platform-admin matrix and guard ordering |
| `service-role.test.ts` | public-prefix, JWT, and client-import scans |

Full gates:

```bash
npx tsc --noEmit
npm test
```

If any tenant isolation test fails, do not proceed: fix the isolation first.

## Production notes

- Apply `0001_tenant-isolation.sql` with the normal migration command
  (`pnpm db:migrate`).
- Supabase's `authenticated` role must have `USAGE` on schema `app` and the
  normal table privileges; the migration grants schema usage to `PUBLIC` and
  policies do the rest.
- The application may use an elevated connection for server work; RLS is a second
  boundary, not a replacement for `lib/tenant/scoped-queries.ts` and the request
  guard.
- Platform tenant administration is implemented in F012 and documented in
  [`PLATFORM.md`](./PLATFORM.md). It requires an explicit active
  `platform_admin` membership, re-checked inside a platform RLS transaction.
  Showroom owner/staff roles never grant it.
- Wildcard subdomain routing is implemented in F013 and documented in
  [`SUBDOMAIN_ROUTING.md`](./SUBDOMAIN_ROUTING.md). Custom-domain registration,
  verification, DNS instructions, SSL provisioning, and routing are implemented
  in F014 and documented in [`CUSTOM_DOMAINS.md`](./CUSTOM_DOMAINS.md). The
  platform subdomain remains the fallback address.
