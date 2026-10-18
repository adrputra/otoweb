# Contract: Admin Vehicle CRUD

**Feature**: `006-admin-vehicle-crud` | **Date**: 2026-10-19

## Authorization contract

Every action and admin page:

1. Resolves a server-verified user (`getCurrentUser`).
2. Resolves the request tenant (`resolveRequestTenantContext`), using the
   verified hostname or the user's single active membership.
3. Denies with `redirect('/')` when the context is missing or the user lacks
   `manage_vehicles` (owner, staff, platform admin).
4. Passes `{ tenantId, userId, isPlatformAdmin }` to the service.
5. The service validates ids, filters by `tenant_id`, and runs writes inside
   `withTenantSession`.

No action accepts a tenant id from the client.

## Shared validation contract

```ts
vehicleInputSchema = z.object({
  brand: string (1..80, trimmed),
  model: string (1..80, trimmed),
  variant: string (1..80, trimmed),
  year: int (1980..2030),
  transmission: 'AT' | 'MT' | 'CVT',
  fuel: 'bensin' | 'diesel' | 'hybrid' | 'listrik',
  bodyType: string (1..40),
  engineCc: int (1..20000),
  mileageKm: int (0..2_000_000),
  color: string (1..40),
  price: int (positive),
  originalPrice?: int (>= 0),
  plateRegion: string (1..20),
  taxExpiry: 'YYYY-MM-DD' valid date,
  description: string (10..5000),
  featured: boolean,
  location: string (1..100),
  features: string[] (<= 50),
  ownerCount?: int (0..99),
  documents?: { stnk: boolean, bpkb: boolean },
  publication: 'draft' | 'published' | 'archived',
})
```

Server responses:

```ts
type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: 'invalid' | 'not_found' | 'forbidden' | 'conflict';
      fieldErrors?: Record<string, string[]>; message?: string }
```

The server always re-validates; client validation is advisory feedback only.

## Service contract

| Function | Input | Success | Failure |
|---|---|---|---|
| `createVehicle` | actor, unknown input | mapped `Vehicle` | `invalid` |
| `updateVehicle` | actor, id, unknown input | mapped `Vehicle` | `invalid`, `not_found` |
| `publishVehicle` | actor, id | mapped `Vehicle` | `not_found`, `conflict` |
| `reserveVehicle` | actor, id | mapped `Vehicle` | `not_found`, `conflict` |
| `sellVehicle` | actor, id | mapped `Vehicle` | `not_found`, `conflict` |
| `archiveVehicle` | actor, id | mapped `Vehicle` | `not_found` |
| `duplicateVehicle` | actor, id | new draft `Vehicle` | `not_found` |
| `deleteVehicle` | actor, id | `{ id }` | `not_found` |

All functions require a valid UUID tenant/user/id before SQL. Cross-tenant ids
behave exactly like unknown ids (`not_found`).

## Read contract

- `listAdminVehicles(db, tenantId)` → tenant vehicles, newest first, including
  drafts and archived.
- `getAdminVehicleById(db, tenantId, id)` → one tenant vehicle or `null`.
- `getAdminVehicleStats(db, tenantId)` → `{ available, reserved, sold, draft,
  archived }`.

## UI contract

- `/admin/vehicles` lists database vehicles, filters by availability/publication,
  and exposes edit, publish, reserve, sell, archive, duplicate, delete, and
  (published) preview actions.
- `/admin/vehicles/new` renders the existing form and calls `createVehicle`.
- `/admin/vehicles/[id]/edit` loads the tenant vehicle or 404s and calls
  `updateVehicle`.
- Successful create navigates to `/admin/vehicles`; successful edit refreshes
  the row. Failures surface field errors and/or a toast with no optimistic
  write.
- The neutral/amber styling, Indonesian copy, and responsive composition are
  unchanged apart from the required data wiring and the additional required
  fields.

## Public acceptance contract

After `publishVehicle` on a valid draft:

- `getPublicVehicleBySlug(db, tenantId, slug)` returns the unit.
- `listPublicVehicles(db, tenantId)` includes it.
- `featured = true` also includes it in `listFeaturedVehicles`.
- Draft and archived units never appear.
