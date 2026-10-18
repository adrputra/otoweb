# Data Model: Connect Public Website to Database

**Feature**: `005-public-website-database`

This feature reuses the F003 schema unchanged. It maps stored rows into the
existing public view types (`Vehicle`, `Showroom`) so presentation components do
not need a new shape.

## Stored entities used

### Tenant

Source: `tenants`, `tenant_domains`.

| Field | Use |
|---|---|
| `id` | Mandatory scope for every public query |
| `name` | Safe fallback display name |
| `slug` | Public identity and development fallback key |
| `status` | `active`/`trial` may serve; `suspended`/`disabled` deny |
| `domain.hostname` | Verified public hostname lookup |
| `domain.status` + `verified_at` | Must be active and verified |

### Showroom settings

Source: `showroom_settings` (one row per tenant).

| Stored field | Public view field |
|---|---|
| `display_name` | `Showroom.name`, hero headline fallback |
| `tagline` | `Showroom.tagline` |
| `description` | `Showroom.description`, hero subheadline fallback |
| `logo_url` | `Showroom.logoUrl` |
| `hero_image_url` | `Showroom.heroImageUrl` (normalized to a usable URL) |
| `primary_color`, `secondary_color` | `Showroom.colors` (carried; applied theme is F009) |
| `phone`, `whatsapp`, `email` | `Showroom.contact` |
| `address`, `city`, `google_maps_url`, `opening_hours` | `Showroom.address` |
| `instagram_url`, `tiktok_url`, `facebook_url` | `Showroom.social` |
| `seo_title`, `seo_description` | `Showroom.seo` |
| (derived) | `Showroom.hero.headline = display_name` |
| (derived) | `Showroom.hero.subheadline = description` |
| (UI label) | `Showroom.hero.ctaLabel = "Lihat semua mobil"` |

Missing optional values map to empty strings or local placeholders. Missing
settings fall back to the tenant identity (`name`, `slug`, `id`) and safe
defaults; no other tenant's data is used.

### Vehicle

Source: `vehicles` plus its `vehicle_images`.

| Stored field | Public view field |
|---|---|
| `id`, `slug`, `brand`, `model`, `variant`, `year` | Same |
| `body_type` | `bodyType` |
| `transmission`, `fuel_type` | `transmission`, `fuel` |
| `mileage` | `mileageKm` |
| `color`, `engine_capacity` | `color`, `engineCc` |
| `price`, `original_price` | `price`, `originalPrice` |
| `tax_expiry_date` | `taxExpiry` (ISO date string) |
| `plate_region`, `owner_count`, `documents` | Same, with safe defaults |
| `features`, `description`, `location` | Same |
| `status` | `availability` for public statuses; `publication = "published"` |
| `featured` | `featured` |
| `created_at`, `updated_at` | ISO strings |
| images ordered by `position`, `id` | `images[]` |

Public status mapping:

| Stored `status` | Public visible? | View `availability` |
|---|---|---|
| `available` | yes | `available` |
| `reserved` | yes | `reserved` |
| `sold` | yes | `sold` |
| `draft` | no | — |
| `archived` | no | — |

If a public vehicle has no image rows, the mapper supplies one local placeholder
image so cards and the detail page keep their layout.

### Vehicle image

Source: `vehicle_images`.

| Stored field | Public view field |
|---|---|
| `id` | `images[].id` |
| `url` | `images[].url` (Unsplash query normalization when absent) |
| `alt` | `images[].alt` |
| `position` | `images[].order` |
| `is_cover` | `images[].isCover` |

## Query contracts

- Every query takes a tenant id and calls `requireTenantId` before SQL.
- Every query filters by `tenant_id = $tenant`.
- Listing queries restrict status to public statuses.
- Detail queries qualify by tenant **and** slug; a cross-tenant slug returns
  `null`.
- Related queries qualify by tenant, public status, same body type, and exclude
  the current vehicle id; at most three rows.
- Feature queries qualify by tenant, public status, and `featured = true`.
- Brand options are distinct brands from the tenant's public vehicles.

## Filter and sort normalization

Filters: `brand`, `model`, `transmission`, `fuel`, `year`, `minPrice`,
`maxPrice`, `maxMileage`.

- Empty strings are ignored.
- Numeric values are parsed as base-10 integers; `NaN`, negative values, and
  non-finite values are ignored.
- Enum values outside the schema's allowed set are ignored.
- Sort values: `terbaru` (default), `harga-terendah`, `harga-tertinggi`,
  `tahun-terbaru`, `km-terendah`.
- Unknown sort values fall back to `terbaru`.
- Every sort has a deterministic tiebreaker (`slug`, then `id`).

## State transitions

This feature is read-only for public data. It does not mutate vehicles, images,
tenants, or settings. Admin CRUD/status transitions are F007 scope.
