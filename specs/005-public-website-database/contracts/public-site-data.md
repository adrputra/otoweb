# Contract: Public site data access

**Feature**: `005-public-website-database`  
**Scope**: Server-only public repository and tenant-scoped query functions.

## `lib/public/tenant.ts`

```ts
export interface PublicTenantDependencies {
  db?: PublicDatabase;
  hostname?: string | null;
}

export function resolvePublicTenant(
  deps?: PublicTenantDependencies,
): Promise<TenantIdentity | null>;

export function getPublicTenant(): Promise<TenantIdentity | null>;
```

Rules:

- Reads the `Host` header through `next/headers` unless `hostname` is injected.
- Uses `findTenantByHostname` and requires the F005 active/verified-domain and
  active/trial-tenant rules.
- In `NODE_ENV === "development"` only, an unresolved hostname may resolve the
  `NEXT_PUBLIC_SHOWROOM_SLUG` (default `prima-auto-gallery`) by slug.
- In production, an unresolved hostname returns `null`. There is no default
  tenant.
- Server-only. Never imported by a client component.

## `lib/public/queries.ts`

```ts
export type PublicDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export function normalizeVehicleFilters(
  input: Record<string, string | string[] | undefined>,
): VehicleFilters;

export function listPublicVehicles(
  db: PublicDatabase,
  tenantId: string,
  filters?: VehicleFilters,
): Promise<Vehicle[]>;

export function listFeaturedVehicles(
  db: PublicDatabase,
  tenantId: string,
): Promise<Vehicle[]>;

export function listPublicVehicleBrands(
  db: PublicDatabase,
  tenantId: string,
): Promise<string[]>;

export function getPublicVehicleBySlug(
  db: PublicDatabase,
  tenantId: string,
  slug: string,
): Promise<Vehicle | null>;

export function listRelatedPublicVehicles(
  db: PublicDatabase,
  tenantId: string,
  vehicleId: string,
  bodyType: string,
  limit?: number,
): Promise<Vehicle[]>;

export function getShowroomForTenant(
  db: PublicDatabase,
  tenant: TenantIdentity,
): Promise<Showroom>;
```

Rules:

- Every function calls `requireTenantId(tenantId)` before SQL. A missing or
  malformed tenant id throws `TenantScopeError`.
- Every query filters by the tenant id; no unscoped variant exists.
- Public vehicle queries include only `available`, `reserved`, and `sold`.
- `listPublicVehicles` applies all supported filters and sorts in SQL.
- `getPublicVehicleBySlug` returns `null` for missing, draft, archived, or
  other-tenant slugs.
- `listRelatedPublicVehicles` returns at most `limit` (default 3) public vehicles
  from the same tenant and body type, excluding `vehicleId`.
- `getShowroomForTenant` returns a `Showroom`; missing settings produce a safe
  fallback built only from the supplied tenant identity.
- Mappers supply a local placeholder image when a vehicle has no image row.

## `lib/repositories.ts`

Page-facing facade. It resolves the public tenant, returns `null`/`[]` when no
tenant resolves, and delegates to `lib/public/queries.ts`.

```ts
export function getShowroom(): Promise<Showroom | null>;
export function listVehicles(filters?: VehicleFilters): Promise<Vehicle[]>;
export function listVehicleBrands(): Promise<string[]>;
export function getVehicleBySlug(slug: string): Promise<Vehicle | null>;
export function getRelatedVehicles(vehicleId: string, bodyType: string): Promise<Vehicle[]>;
```

Rules:

- No public runtime import of `data/index.ts`.
- `getShowroom` returns `null` when no tenant resolves.
- Listing/detail functions return empty/null when no tenant resolves.
- Returned `Vehicle`/`Showroom` objects are the existing view types.

## Page behaviour

| Route | No tenant | No vehicle |
|---|---|---|
| `/` | `notFound()` | n/a |
| `/cars` | `notFound()` | n/a |
| `/cars/[slug]` | `notFound()` | `notFound()` |

## Failure semantics

| Condition | Result |
|---|---|
| Missing/malformed tenant id in a query | `TenantScopeError` before SQL |
| Unknown hostname in production | `null` tenant; page not-found |
| Unknown hostname in development | configured slug fallback, else not-found |
| Cross-tenant slug | `null`; page not-found |
| Draft/archived vehicle | excluded from lists; `null` detail |
| Missing image row | local placeholder image |
| Missing optional settings field | empty string / documented safe default |
| Database unavailable | request fails; no mock data substitution |

## Source-scan boundary

`tests/unit/public/no-mock-catalogue.test.ts` asserts that these public runtime
modules do not import `@/data`, `../data`, or `data/index`:

- `app/page.tsx`
- `app/cars/page.tsx`
- `app/cars/[slug]/page.tsx`
- `components/showroom.tsx`
- `lib/repositories.ts`
- `lib/public/tenant.ts`
- `lib/public/queries.ts`
