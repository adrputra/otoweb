# Data Model: Platform Administration

**Feature**: `011-platform-administration` | **Date**: 2026-10-19

## Schema decision

No migration is required. Platform administration reads and writes the existing
tables created by F003 and secured by F005:

```text
tenants
├── tenant_domains        (1:N)
├── tenant_members        (1:N) ── profiles (N:1)
├── showroom_settings     (1:1)
├── vehicles              (1:N)
└── leads                 (1:N)
```

## Existing tables used

### `tenants`

| Column | Platform use |
|---|---|
| `id` | Tenant identifier in platform routes |
| `name` | Display name in list/detail |
| `slug` | Unique stable identifier; validated on create |
| `status` | Lifecycle: `active`, `trial`, `suspended`, `disabled` |
| `plan` | Operator-supplied plan label |
| `theme` | Read-only in this feature |
| `created_at`, `updated_at` | Shown in detail; `updated_at` refreshed on writes |

### `tenant_domains`

| Column | Platform use |
|---|---|
| `id`, `tenant_id` | Ownership |
| `hostname` | Unique platform subdomain |
| `type` | `platform_subdomain` for this feature; custom domains remain F014 |
| `status` | Set `active` when the subdomain is saved |
| `verified_at` | Set on save so hostname resolution accepts the domain |

### `profiles`

| Column | Platform use |
|---|---|
| `id` | Matches the identity-provider user id |
| `full_name` | Shown in owner/member lists when present |

A missing profile is created with only `id` when an operator assigns ownership;
`full_name` remains null until the identity or an admin fills it.

### `tenant_members`

| Column | Platform use |
|---|---|
| `tenant_id`, `user_id` | Unique membership pair |
| `role` | `owner` for assigned owners; existing `platform_admin` preserved |
| `status` | Set `active` when ownership is assigned |

### `showroom_settings`

A default row is created with the tenant name when a tenant is created. This
makes the new tenant immediately usable and gives the public site a display name
without a follow-up step.

### `vehicles`, `leads`

Read-only aggregate counts for the detail view.

## Derived view models

These are serializable (dates as ISO strings) so they can cross the server/client
boundary in actions and server-component props.

### `PlatformTenantSummary`

```ts
interface PlatformTenantSummary {
  id: string
  name: string
  slug: string
  status: 'active' | 'trial' | 'suspended' | 'disabled'
  plan: string
  theme: string
  hostnames: string[]
  ownerCount: number
  memberCount: number
  vehicleCount: number
  leadCount: number
  createdAt: string
  updatedAt: string
}
```

### `PlatformTenantMember`

```ts
interface PlatformTenantMember {
  id: string
  userId: string
  fullName: string | null
  role: 'platform_admin' | 'owner' | 'staff'
  status: string
  createdAt: string
}
```

### `PlatformTenantDomain`

```ts
interface PlatformTenantDomain {
  id: string
  hostname: string
  type: 'platform_subdomain' | 'custom_domain'
  status: string
  verifiedAt: string | null
  createdAt: string
}
```

### `PlatformTenantDetail`

```ts
interface PlatformTenantDetail extends PlatformTenantSummary {
  domains: PlatformTenantDomain[]
  members: PlatformTenantMember[]
  owners: PlatformTenantMember[]
  showroomDisplayName: string | null
}
```

## Lifecycle rules

```text
create:
  validate name/slug/plan/status/hostname
  -> insert tenant
  -> insert default showroom_settings
  -> optionally insert platform subdomain
  -> optionally provision profile + owner membership
  (all in one transaction)

assign owner:
  validate tenant and user id
  -> provision profile when missing
  -> upsert membership
     existing platform_admin role is preserved
     otherwise role becomes owner, status active

set subdomain:
  validate/normalize hostname
  -> reject if owned by another tenant
  -> update the tenant's primary platform_subdomain or insert one
  -> status active, verified_at set

set plan/status:
  validate against the explicit contract
  -> update tenant row and updated_at

disable:
  set status disabled
  -> public hostname/slug resolution fails closed via isUsableTenantStatus
```

## Invariants

1. A platform mutation must never run without an active `platform_admin`
   membership for the acting identity.
2. A tenant slug is globally unique.
3. A hostname is globally unique across platform subdomains and custom domains.
4. A membership is unique per (`tenant_id`, `user_id`).
5. A tenant always has at most one primary platform subdomain used by the set
   operation; additional custom domains are untouched.
6. A failed create/assign/subdomain operation leaves no partial rows.
7. Disabled and suspended tenants never resolve through public hostname or slug
   lookups.
