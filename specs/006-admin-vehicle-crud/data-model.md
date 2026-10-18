# Data Model: Admin Vehicle CRUD

**Feature**: `006-admin-vehicle-crud` | **Date**: 2026-10-19

No migration is introduced. Existing tables from F003 are used as-is.

## Vehicle (`vehicles`)

| Column | Type | Admin rule |
|---|---|---|
| `id` | uuid | generated; validated as UUID before lookup |
| `tenant_id` | uuid | always from the authorized context, never from input |
| `slug` | text | generated on create/duplicate; immutable on edit; unique per tenant |
| `brand`, `model`, `variant` | text | required, trimmed, 1–80 chars |
| `year` | integer | 1980–2030 |
| `transmission` | enum | `AT | MT | CVT` |
| `fuel_type` | enum | `bensin | diesel | hybrid | listrik` |
| `body_type` | text | required |
| `engine_capacity` | integer | required, 1–20000 cc |
| `mileage` | integer | required, 0–2,000,000 km |
| `color` | text | required |
| `price` | bigint | required, positive integer IDR |
| `original_price` | bigint | optional, non-negative |
| `plate_region` | text | required |
| `tax_expiry_date` | date | required `YYYY-MM-DD`, valid date |
| `description` | text | required, 10–5000 chars |
| `status` | enum | lifecycle transitions below |
| `featured` | boolean | from form |
| `location` | text | required |
| `features` | jsonb string[] | max 50 unique trimmed strings |
| `owner_count` | integer | optional, 0–99 |
| `documents` | jsonb `{stnk,bpkb}` | optional |
| `created_at`, `updated_at` | timestamptz | `updated_at` set on every mutation |
| `published_at` | timestamptz | set on first publish; cleared on revert to draft |
| `reserved_at` | timestamptz | set on reserve; cleared on draft |
| `sold_at` | timestamptz | set on sell; cleared on draft |

### Status transitions

```text
draft ──publish──▶ available ──reserve──▶ reserved ──sell──▶ sold
  ▲                    │                     │
  │                    └────────sell─────────┘
  │
  └──unpublish/edit──── available | reserved | sold

archived ──publish──▶ available
any (except archived) ──archive──▶ archived
any ──delete──▶ removed (images cascade)
```

Editing a published row (`available`, `reserved`, `sold`) preserves its status.
Editing to `draft` removes it from public queries. Editing to `archived` keeps it
admin-only.

## VehicleImage (`vehicle_images`)

F007 reads and copies rows, and relies on the FK cascade for deletion. It does
not upload or reorder media (F008).

| Column | Admin rule |
|---|---|
| `tenant_id` | same as the vehicle/context |
| `vehicle_id` | FK to `vehicles`, `on delete cascade` |
| `url`, `alt`, `position`, `is_cover` | copied verbatim on duplicate |
| `provider`, `provider_asset_id`, `width`, `height` | copied verbatim on duplicate |

## View mapping (DB → admin `Vehicle`)

| DB | Admin view |
|---|---|
| `status = draft` | `publication = draft`, `availability = available` |
| `status = archived` | `publication = archived`, `availability = available` |
| `status = available` | `publication = published`, `availability = available` |
| `status = reserved` | `publication = published`, `availability = reserved` |
| `status = sold` | `publication = published`, `availability = sold` |

`taxExpiry` is the date string; `createdAt`/`updatedAt` are ISO timestamps.
Missing rows map to the existing placeholder image behaviour only in public
views; admin keeps the actual (possibly empty) image list.

## Shared schema shapes

`lib/validation/vehicle.ts` exports:

- `vehicleInputSchema` — all editable fields plus `publication:
  draft | published | archived`
- `vehicleInputSchema` output type `VehicleInput`
- `vehicleIdSchema` — UUID
- `vehicleLifecycleActionSchema` — `publish | reserve | sell | archive`
- `slugifyVehicle` — pure, deterministic base slug

The form uses the schema through `zodResolver`; the service uses `safeParse`
before opening a transaction.
