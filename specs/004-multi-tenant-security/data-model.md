# Data Model: Multi-Tenant Security

**Feature**: `004-multi-tenant-security`  
**Date**: 2026-10-19

This feature adds no tables or columns. It defines runtime models over the F003
schema plus PostgreSQL RLS settings.

## Existing tables in scope

| Table | Tenant-owned | Isolation key |
|---|---|---|
| `tenants` | itself | `id` |
| `tenant_domains` | yes | `tenant_id` |
| `profiles` | no (user-owned) | `id` / membership |
| `tenant_members` | yes | `tenant_id` + `user_id` |
| `showroom_settings` | yes | `tenant_id` |
| `vehicles` | yes | `tenant_id` |
| `vehicle_images` | yes | `tenant_id` (and `vehicle_id`) |

## Tenant

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Stable tenant identifier |
| `name` | string | Display name |
| `slug` | string | Unique slug |
| `status` | `active \| suspended \| trial \| disabled` | `active` and `trial` are usable |
| `plan` | string | Informational |

**Invariants**: Only `active`/`trial` tenants participate in a context. Hostname
resolution and membership resolution both enforce this.

## Tenant membership

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Membership id |
| `tenantId` | UUID | Tenant reference |
| `userId` | UUID | Profile/auth user reference |
| `role` | `platform_admin \| owner \| staff` | Capability source |
| `status` | string | Only `active` participates |
| `tenant` | `Tenant` | Joined tenant identity |

**Invariants**: Unique on (`tenant_id`, `user_id`). Inactive memberships never grant
context or capability.

## Tenant context

```ts
type TenantContext = {
  userId: string
  tenant: Tenant
  role: TenantRole
  membershipId: string | null
  isPlatformAdmin: boolean
}
```

- `role` is `platform_admin` for cross-tenant platform access.
- `membershipId` is null only for a platform administrator acting on a tenant where
  they hold no membership.
- Every context implies an active/trial tenant and an active membership or platform
  administrator grant.

## Context result

```ts
type TenantContextResult =
  | { ok: true; context: TenantContext }
  | { ok: false; error: TenantDenialCode }

type TenantDenialCode =
  | 'unauthenticated'
  | 'no_membership'
  | 'inactive_membership'
  | 'tenant_unavailable'
  | 'tenant_mismatch'
  | 'unknown_tenant'
  | 'ambiguous'
```

Denials carry no tenant payload beyond the code.

## Capability matrix

| Capability | owner | staff | platform_admin |
|---|---|---|---|
| `view` | allow | allow | allow |
| `manage_vehicles` | allow | allow | allow |
| `manage_leads` | allow | allow | allow |
| `manage_staff` | allow | deny | allow |
| `manage_settings` | allow | deny | allow |

Evaluation order: tenant availability → membership/tenant match → capability. An
inactive membership or a tenant mismatch is denied regardless of role.

## Tenant session settings (RLS)

| Setting | Type | Set by |
|---|---|---|
| `app.tenant_id` | UUID string | server transaction helper |
| `app.user_id` | UUID string | server transaction helper |
| `app.is_platform_admin` | `true`/`false` | server transaction helper |

**Invariants**: Settings are transaction-local (`set_config(..., true)`), never
process-wide, and never derived from browser input. Missing settings yield no rows and
rejected writes.

## Hostname resolution result

```ts
type HostnameTenantResult =
  | { ok: true; tenant: Tenant }
  | { ok: false; error: 'unknown_hostname' | 'tenant_unavailable' }
```

## Scoped query contract

Every tenant-scoped function has the shape:

```ts
function name(db, tenantId, ...args)
```

- `tenantId` must be a non-empty UUID; otherwise a typed `TenantScopeError`
  (`missing_tenant_id` / `invalid_tenant_id`) is thrown before SQL.
- Every SQL statement includes `tenant_id = $tenantId`, even when RLS is active.
- Cross-tenant identifiers resolve to `null`/`[]` or zero affected rows.

## State transitions

```text
unauthenticated --no user--> denied(unauthenticated)
authenticated --no active membership--> denied(no_membership | inactive_membership | tenant_unavailable)
authenticated --one active membership--> context
authenticated --hostname matches membership--> context
authenticated --hostname conflicts--> denied(tenant_mismatch)
authenticated --explicit tenant not held--> denied(tenant_mismatch | unknown_tenant)
authenticated --multiple memberships, no signal--> denied(ambiguous)
platform_admin --explicit active tenant--> context (cross-tenant)
```

## Fixtures

| Fixture | Tenant | Domain | Membership | Data |
|---|---|---|---|---|
| `prima` | Prima Auto Gallery, `active` | `prima.otoweb.id` | owner profile | 12 vehicles, 12 images, settings |
| `tenant-b` | Tenant B Test Showroom, `trial` | `tenant-b.otoweb.id` | owner profile | settings, no legacy vehicles; tests insert one tenant-b vehicle |

Fixture identifiers come from `db/seed-core.ts` and are re-exported by
`tests/unit/tenant/fixtures.ts`.
