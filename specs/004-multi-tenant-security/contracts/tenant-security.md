# Contract: Tenant Security Library

**Feature**: `004-multi-tenant-security`  
**Scope**: Server-only contracts in `lib/tenant/`. No HTTP routes are added by this
feature.

## Types

```ts
export type TenantRole = 'platform_admin' | 'owner' | 'staff'

export type TenantStatus = 'active' | 'suspended' | 'trial' | 'disabled'

export type TenantCapability =
  | 'view'
  | 'manage_vehicles'
  | 'manage_leads'
  | 'manage_staff'
  | 'manage_settings'

export interface TenantIdentity {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan: string
}

export interface TenantMembership {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
  status: string
  tenant: TenantIdentity
}

export interface TenantContext {
  userId: string
  tenant: TenantIdentity
  role: TenantRole
  membershipId: string | null
  isPlatformAdmin: boolean
}

export type TenantDenialCode =
  | 'unauthenticated'
  | 'no_membership'
  | 'inactive_membership'
  | 'tenant_unavailable'
  | 'tenant_mismatch'
  | 'unknown_tenant'
  | 'ambiguous'

export type TenantContextResult =
  | { ok: true; context: TenantContext }
  | { ok: false; error: TenantDenialCode }
```

## `normalizeHostname(input)`

- **Input**: `string | null | undefined`
- **Output**: normalized hostname or `null`
- **Rules**: trim; lowercase; strip one trailing dot; strip a numeric port; reject
  paths, queries, fragments, userinfo, whitespace inside the value, empty labels, and
  values over 253 characters.
- **Never** returns a default host.

## `createTenantDirectory(db)`

```ts
interface TenantDirectory {
  findTenantByHostname(hostname: string): Promise<HostnameTenantResult>
  findTenantById(tenantId: string): Promise<TenantIdentity | null>
  listMembershipsForUser(userId: string): Promise<TenantMembership[]>
}
```

- `findTenantByHostname` normalizes internally and only returns tenants whose domain
  is `active`, verified, and whose tenant is `active`/`trial`.
- `listMembershipsForUser` returns all memberships (including inactive) so denial
  reasons can be precise.
- Lookups never fall back to another tenant.

## `resolveTenantContext(input)`

```ts
interface ResolveTenantContextInput {
  user: { id: string } | null
  memberships: readonly TenantMembership[]
  requestedTenant?: TenantIdentity | null
  hostnameTenant?: TenantIdentity | null
}

function resolveTenantContext(input: ResolveTenantContextInput): TenantContextResult
```

Precedence: `requestedTenant` → `hostnameTenant` → the single active membership.

Failure rules:

| Condition | Result |
|---|---|
| no user | `unauthenticated` |
| no memberships at all | `no_membership` |
| memberships exist but none active | `inactive_membership` (or `tenant_unavailable` when the membership is active but the tenant is not) |
| requested tenant not held (non-platform-admin) | `tenant_mismatch` |
| requested tenant unknown/inactive | `unknown_tenant` / `tenant_unavailable` |
| hostname tenant not held (non-platform-admin) | `tenant_mismatch` |
| requested and hostname tenants differ | `tenant_mismatch` |
| multiple active memberships, no signal | `ambiguous` |

A platform administrator resolves a requested/hostname tenant without a membership
for that tenant and receives `membershipId: null`, `role: 'platform_admin'`.

## `can(context, capability)` / `assertCapability(context, capability)`

- `can` is pure and returns `false` for a missing/invalid context.
- `assertCapability` returns a result union:
  `{ ok: true } | { ok: false; error: 'forbidden' }`.
- Capability rules match the matrix in `data-model.md`.

## `authorizeTenantAccess(result, tenantId, capability)`

Data/API-layer guard used before a scoped query or mutation.

- `result.ok === false` → propagate the denial.
- `result.context.tenant.id !== tenantId` (non-platform-admin) → `tenant_mismatch`.
- capability denied → `forbidden`.
- success → `{ ok: true, context }`.

## Scoped query contract

```ts
getTenantById(db, tenantId)
getShowroomSettings(db, tenantId)
listTenantVehicles(db, tenantId)
getTenantVehicleBySlug(db, tenantId, slug)
listTenantVehicleImages(db, tenantId, vehicleId?)
listTenantMembers(db, tenantId)
```

- Every function requires `tenantId`.
- Invalid/missing tenant id throws `TenantScopeError` before SQL.
- Cross-tenant identifiers return `null`, `[]`, or zero rows.
- No function accepts a "skip tenant" flag.

## Session helper

```ts
withTenantSession(db, { tenantId, userId, isPlatformAdmin }, callback)
```

- Opens a transaction.
- Sets `app.tenant_id`, `app.user_id`, `app.is_platform_admin` with transaction-local
  `set_config`.
- Runs the callback with the transaction handle.
- Settings reset automatically when the transaction ends.
- Rejects a missing/invalid tenant id or user id.

## Server guard

```ts
resolveRequestTenantContext(user): Promise<TenantContextResult>
requireTenantContext(user): Promise<TenantContext>
assertServerOnly(moduleName): void
```

- `resolveRequestTenantContext` reads the request host, loads memberships, and applies
  the pure resolver. Any database/configuration error is caught and returned as a
  denial (`tenant_unavailable`), never as a tenant.
- `requireTenantContext` redirects to `/` when the result is not ok.
- `assertServerOnly` throws when `window` is defined.

## Service-role boundary

- No `NEXT_PUBLIC_*SERVICE_ROLE*` variable may exist in source or examples.
- Browser-reachable modules (`lib/supabase/client.ts`, any `'use client'` file) must
  not import `lib/tenant/database`, `db/client`, or any server-only tenant module.
- `.env.example` contains placeholders only.
