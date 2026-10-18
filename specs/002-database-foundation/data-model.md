# Data Model: Database Foundation

**Feature**: `002-database-foundation`  
**Source of intent**: `docs/ROADMAP.md` §8–§17 and the feature spec.

All identifiers are UUIDs. All timestamps are `timestamptz`. Tenant-owned tables
carry `tenant_id` with a foreign key to `tenants.id` and cascade on tenant
deletion. The schema uses PostgreSQL enums for finite domain values and JSONB
where the roadmap explicitly prefers it.

## Relationship overview

```text
tenants
├── tenant_domains        (1:N)
├── tenant_members        (1:N) ── profiles (N:1)
├── showroom_settings     (1:1)
└── vehicles              (1:N)
    └── vehicle_images    (1:N)

profiles ── tenant_members (1:N)
```

`tenant_members` is unique on (`tenant_id`, `user_id`). `showroom_settings` is
unique on `tenant_id` (one settings row per showroom). `vehicles` is unique on
(`tenant_id`, `slug`). `tenant_domains.hostname` is globally unique.

## Enumerations

| Enum | Values | Notes |
|---|---|---|
| `tenant_status` | `active`, `suspended`, `trial`, `disabled` | Roadmap §9 |
| `tenant_domain_type` | `platform_subdomain`, `custom_domain` | Roadmap §10 |
| `tenant_member_role` | `platform_admin`, `owner`, `staff` | Roadmap §11 |
| `vehicle_transmission` | `AT`, `MT`, `CVT` | Existing mock values |
| `vehicle_fuel_type` | `bensin`, `diesel`, `hybrid`, `listrik` | Existing mock values |
| `vehicle_status` | `draft`, `available`, `reserved`, `sold`, `archived` | Roadmap §14 |

`tenant_domains.status`, `tenant_members.status`, `tenants.plan`, and
`tenants.theme` are plain text because the roadmap does not define fixed value
sets for them. Seed values are documented below.

## Table: `tenants`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()` |
| `name` | text | not null |
| `slug` | text | not null, unique |
| `status` | `tenant_status` | not null, default `trial` |
| `plan` | text | not null, default `starter` |
| `theme` | text | not null, default `premium` |
| `created_at` | timestamptz | not null, default now |
| `updated_at` | timestamptz | not null, default now |

## Table: `tenant_domains`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()` |
| `tenant_id` | uuid | not null, FK `tenants.id`, cascade |
| `hostname` | text | not null, unique |
| `type` | `tenant_domain_type` | not null, default `platform_subdomain` |
| `status` | text | not null, default `active` |
| `verified_at` | timestamptz | nullable |
| `created_at` | timestamptz | not null, default now |

Index: `tenant_id`.

## Table: `profiles`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()`; intended to match a Supabase Auth user id in later phases |
| `full_name` | text | nullable |
| `avatar_url` | text | nullable |
| `created_at` | timestamptz | not null, default now |
| `updated_at` | timestamptz | not null, default now |

## Table: `tenant_members`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()` |
| `tenant_id` | uuid | not null, FK `tenants.id`, cascade |
| `user_id` | uuid | not null, FK `profiles.id`, cascade |
| `role` | `tenant_member_role` | not null, default `staff` |
| `status` | text | not null, default `active` |
| `created_at` | timestamptz | not null, default now |
| `updated_at` | timestamptz | not null, default now |

Unique index: (`tenant_id`, `user_id`). Index: `tenant_id`.

## Table: `showroom_settings`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()` |
| `tenant_id` | uuid | not null, unique, FK `tenants.id`, cascade |
| `display_name` | text | not null |
| `tagline` | text | nullable |
| `description` | text | nullable |
| `logo_url` | text | nullable |
| `favicon_url` | text | nullable |
| `hero_image_url` | text | nullable |
| `primary_color` | text | nullable |
| `secondary_color` | text | nullable |
| `phone` | text | nullable |
| `whatsapp` | text | nullable |
| `email` | text | nullable |
| `address` | text | nullable |
| `city` | text | nullable |
| `province` | text | nullable |
| `postal_code` | text | nullable |
| `google_maps_url` | text | nullable |
| `instagram_url` | text | nullable |
| `tiktok_url` | text | nullable |
| `facebook_url` | text | nullable |
| `opening_hours` | text | nullable |
| `seo_title` | text | nullable |
| `seo_description` | text | nullable |
| `created_at` | timestamptz | not null, default now |
| `updated_at` | timestamptz | not null, default now |

## Table: `vehicles`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()` |
| `tenant_id` | uuid | not null, FK `tenants.id`, cascade |
| `slug` | text | not null |
| `brand` | text | not null |
| `model` | text | not null |
| `variant` | text | not null |
| `year` | integer | not null |
| `transmission` | `vehicle_transmission` | not null |
| `fuel_type` | `vehicle_fuel_type` | not null |
| `body_type` | text | not null |
| `engine_capacity` | integer | not null |
| `mileage` | integer | not null |
| `color` | text | not null |
| `price` | bigint | not null |
| `original_price` | bigint | nullable |
| `plate_region` | text | not null |
| `tax_expiry_date` | date | not null |
| `description` | text | not null |
| `status` | `vehicle_status` | not null, default `draft` |
| `featured` | boolean | not null, default false |
| `location` | text | not null |
| `features` | jsonb (`string[]`) | not null, default `[]` |
| `owner_count` | integer | nullable — legacy mock compatibility |
| `documents` | jsonb (`{ stnk, bpkb }`) | nullable — legacy mock compatibility |
| `created_at` | timestamptz | not null, default now |
| `updated_at` | timestamptz | not null, default now |
| `published_at` | timestamptz | nullable |
| `reserved_at` | timestamptz | nullable |
| `sold_at` | timestamptz | nullable |

Unique index: (`tenant_id`, `slug`). Indexes: `tenant_id`, `status`.

### Legacy status mapping

| Mock `publication` | Mock `availability` | Production `status` |
|---|---|---|
| `draft` | any | `draft` |
| `archived` | any | `archived` |
| `published` | `available` | `available` |
| `published` | `reserved` | `reserved` |
| `published` | `sold` | `sold` |

`published_at` is set for published vehicles. `reserved_at`/`sold_at` are set
when the mapped status is reserved/sold and the vehicle is published.

## Table: `vehicle_images`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | primary key, `gen_random_uuid()` |
| `tenant_id` | uuid | not null, FK `tenants.id`, cascade |
| `vehicle_id` | uuid | not null, FK `vehicles.id`, cascade |
| `provider` | text | not null, default `cloudinary` |
| `provider_asset_id` | text | nullable |
| `url` | text | not null |
| `alt` | text | not null, default empty string |
| `position` | integer | not null, default 0 |
| `is_cover` | boolean | not null, default false |
| `width` | integer | nullable |
| `height` | integer | nullable |
| `created_at` | timestamptz | not null, default now |

Indexes: `tenant_id`, `vehicle_id`.

`alt` is retained because the existing mock images carry accessible alt text and
the public UI renders it. `provider` is text (not an enum) so legacy
`unsplash`-hosted seed images and future `cloudinary` images can coexist.

## Seed data

### Tenants

| Tenant | Slug | Status | Plan | Theme |
|---|---|---|---|---|
| Prima Auto Gallery | `prima-auto-gallery` | `active` | `starter` | `premium` |
| Tenant B Test Showroom | `tenant-b-test-showroom` | `trial` | `trial` | `premium` |

### Domains

| Hostname | Tenant | Type | Status |
|---|---|---|---|
| `prima.otoweb.id` | Prima Auto Gallery | `platform_subdomain` | `active` |
| `tenant-b.otoweb.id` | Tenant B Test Showroom | `platform_subdomain` | `active` |

### Profiles and memberships

| Profile | Membership |
|---|---|
| Aditya Pranata (`owner`) | Prima Auto Gallery, role `owner`, status `active` |
| Tenant B Owner (`owner`) | Tenant B Test Showroom, role `owner`, status `active` |

### Showroom settings

Prima Auto Gallery maps the existing `data/index.ts` showroom object: display
name, tagline, description, hero image, colours, phone, WhatsApp, email, street,
city, Google Maps URL, opening hours, social links, and SEO fields. Province and
postal code are null because the mock source has none. Tenant B receives distinct
test values (Bandung, teal colour, separate contact details).

### Vehicles and images

All twelve vehicles from `data/index.ts` are seeded under Prima Auto Gallery
using deterministic UUIDs. Every schema field is populated from the mock record;
one `vehicle_images` row is created per mock image (one per vehicle), preserving
URL, alt text, position, and cover flag. Provider is `unsplash` for the mock
URLs and `provider_asset_id` stores the existing Unsplash photo id. Tenant B has
no seeded vehicles (it is a second tenant for later isolation work, not a second
mock catalogue).

## Explicit deferrals

- `leads`, lead events, and CRM fields: Phase 10 (not in this feature's table
  list).
- Authentication sessions, password reset, and owner invitations: Phase 4.
- Row-level security policies, tenant context, and permission helpers: Phase 5.
- Public repository/UI reads from the database: Phase 6.
- Cloudinary upload lifecycle: Phase 8.
