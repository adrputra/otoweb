# Contract: Platform Administration

**Feature**: `011-platform-administration`

## Access contract

| Caller | `/platform` page | Platform server action |
|---|---|---|
| Unauthenticated | `307` to `/login?next=/platform` | `{ ok: false, error: 'forbidden' }` |
| Active `platform_admin` | Render surface | Execute after service re-check |
| Showroom owner | Not found (`404`) | `{ ok: false, error: 'forbidden' }` |
| Showroom staff | Not found (`404`) | `{ ok: false, error: 'forbidden' }` |
| Inactive `platform_admin` | Not found (`404`) | `{ ok: false, error: 'forbidden' }` |

The platform surface is not linked from `components/admin-shell.tsx`.

## Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/platform` | List every tenant with summary data |
| GET | `/platform/tenants/new` | Create-tenant form |
| GET | `/platform/tenants/[id]` | Inspect and configure one tenant |

Invalid or unknown tenant ids render not-found and disclose no other tenant.

## Server actions

All actions are `'use server'` functions in `lib/platform/actions.ts`. They
accept plain JSON-compatible input and return a plain result. Tenant ids always
come from the validated payload; actor identity always comes from the verified
session.

### `createTenantAction(input)`

```ts
input: {
  name: string            // 1..120
  slug: string            // lowercase kebab, 1..63, globally unique
  plan: string            // 1..40, [a-z0-9][a-z0-9_-]*
  status: 'active' | 'trial' | 'suspended' | 'disabled'
  subdomain?: string      // full hostname, optional
  ownerUserId?: string    // UUID, optional
}

result:
  | { ok: true; data: PlatformTenantDetail }
  | { ok: false; error: 'invalid' | 'conflict' | 'forbidden'; message: string;
      fieldErrors?: Record<string, string[]> }
```

Guarantees: tenant, default showroom settings, subdomain, and owner membership
are written in one transaction; a conflict or validation failure writes nothing.

### `assignTenantOwnerAction(input)`

```ts
input: { tenantId: string; userId: string }
result:
  | { ok: true; data: PlatformTenantDetail }
  | { ok: false; error: 'invalid' | 'not_found' | 'forbidden'; message: string }
```

### `setTenantSubdomainAction(input)`

```ts
input: { tenantId: string; hostname: string }
result:
  | { ok: true; data: PlatformTenantDetail }
  | { ok: false; error: 'invalid' | 'not_found' | 'conflict' | 'forbidden'; message: string }
```

The hostname is normalized (trim, lowercase, port and trailing dot removed) and
validated. It is marked active and verified on save. A hostname owned by another
tenant is a conflict.

### `setTenantPlanAction(input)`

```ts
input: { tenantId: string; plan: string }
result: same shape as owner assignment
```

### `setTenantStatusAction(input)`

```ts
input: { tenantId: string; status: 'active' | 'trial' | 'suspended' | 'disabled' }
result: same shape as owner assignment
```

### `disableTenantAction(tenantId)`

Equivalent to `setTenantStatusAction({ tenantId, status: 'disabled' })`.

## Authorization contract at the data layer

`lib/platform/tenant-service.ts` exposes:

```text
listPlatformTenants(db, actorUserId)
getPlatformTenant(db, actorUserId, tenantId)
createPlatformTenant(db, actorUserId, input)
assignTenantOwner(db, actorUserId, input)
setTenantSubdomain(db, actorUserId, input)
setTenantPlan(db, actorUserId, input)
setTenantStatus(db, actorUserId, input)
```

Each function:

1. Opens `withPlatformSession` (transaction-local `app.user_id` and
   `app.is_platform_admin = true`).
2. Re-queries `tenant_members` for an active `platform_admin` row for
   `actorUserId`.
3. Returns `{ ok: false, error: 'forbidden' }` when the membership is absent,
   before any read or write.
4. Runs the operation inside the same transaction.

## Validation contract

| Field | Rule |
|---|---|
| Tenant name | Trimmed, 1–120 characters |
| Slug | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–63 characters, lowercased |
| Plan | Trimmed, 1–40 characters, `^[a-z0-9][a-z0-9_-]*$` |
| Status | One of `active`, `trial`, `suspended`, `disabled` |
| Hostname | Normalized full hostname, 1–253 characters, valid DNS labels, at least two labels |
| User id | UUID |

## Non-goals

- No public registration or invite email.
- No custom-domain verification flow (F014).
- No wildcard routing changes (F013).
- No billing integration or fixed plan catalogue.
- No service-role credential use.
