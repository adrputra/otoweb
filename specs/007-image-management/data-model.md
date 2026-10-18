# Data Model: Image Management

**Feature**: `007-image-management` | **Date**: 2026-10-19

No migration is introduced. The existing F003 `vehicle_images` table already has
every required column. Cover and ordering invariants are enforced in the
service; the public view model derives optimized URLs at read time.

## VehicleImage (`vehicle_images`)

| Column | Type | Rule in F008 |
|---|---|---|
| `id` | uuid | Primary key; validated as UUID at every boundary |
| `tenant_id` | uuid | From the authorized actor/context only; every query filters on it |
| `vehicle_id` | uuid | Must resolve to a vehicle in the same tenant; `on delete cascade` |
| `provider` | text | `cloudinary` in production; `fake` for the dev/test provider |
| `provider_asset_id` | text | Deterministic Cloudinary `public_id` / fake path; unique per uploaded content |
| `url` | text | Original delivery URL returned by the provider |
| `alt` | text | Optional, trimmed, ≤160 chars; defaults to a humanized filename |
| `position` | integer | Contiguous `0..n-1` after every mutation |
| `is_cover` | boolean | Exactly one `true` per vehicle with at least one image |
| `width`, `height` | integer | Parsed from the file and stored |
| `created_at` | timestamptz | Database default |

### Indexes and constraints (existing)

- `vehicle_images_tenant_id_idx`, `vehicle_images_vehicle_id_idx`
- FKs: `tenant_id → tenants(id) ON DELETE CASCADE`,
  `vehicle_id → vehicles(id) ON DELETE CASCADE`
- RLS: `vehicle_images_tenant_isolation` (`tenant_id = app.current_tenant_id()`
  or platform admin)

### Invariants enforced by the service

1. `position` is contiguous and unique within a vehicle after upload, reorder,
   and delete.
2. At most one row per vehicle has `is_cover = true`; the first image gets the
   cover automatically and deletion of the cover promotes the first remaining
   position.
3. `(vehicle_id, provider, provider_asset_id)` is logically unique. A retry with
   the same content returns the existing row instead of inserting a duplicate.
4. Image rows are always resolved through a tenant-scoped vehicle lookup before
   any mutation.

### View model (`Vehicle['images']` entry)

```ts
interface VehicleImage {
  id: string
  url: string           // optimized primary URL (1600px public / original admin)
  alt: string
  order: number         // stored position
  isCover: boolean
  thumbnailUrl?: string // 480px admin / 640px public cards
  provider?: string
  providerAssetId?: string | null
  width?: number | null
  height?: number | null
}
```

Admin list: images sorted by `position`, then `id`. Public read: cover first,
then `position`, so the chosen cover is the hero image.

## MediaProvider contract

```ts
interface MediaUploadInput {
  bytes: Uint8Array
  filename: string
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  publicId: string
  width: number
  height: number
}

interface MediaUploadResult {
  provider: 'cloudinary' | 'fake'
  assetId: string
  url: string
  width: number
  height: number
}

interface MediaProvider {
  key: 'cloudinary' | 'fake'
  upload(input: MediaUploadInput): Promise<MediaUploadResult>
  destroy(assetId: string): Promise<void>
}
```

Errors are `MediaProviderError` with `code: 'transient' | 'permanent'`.

## MediaPolicy

```ts
type MediaCleanupSummary = {
  destroyed: number
  failed: number
  skipped: number
  failures: { assetId: string; message: string }[]
}
```

Rules, applied after the database commit:

1. Candidate = `{ provider, assetId }` captured before the row was deleted.
2. Skip when `provider !== activeProvider.key`, `assetId` is empty, or the
   provider is not configured for cleanup.
3. Count remaining `vehicle_images` rows matching the same `provider` and
   `provider_asset_id` across all tenants.
4. Destroy only when the count is zero. Record failures; never throw to the
   caller and never roll back the database deletion.
5. Seeded `unsplash` / `external` / `test` rows are never candidates.

## Status transitions

```text
empty vehicle ──upload first──▶ 1 image (cover = true)
1..n images ──upload another──▶ n+1 image (cover unchanged)
1..n images ──reorder──▶ same rows, positions 0..n-1
1..n images ──set cover──▶ one is_cover = true
1..n images ──delete image──▶ n-1 rows, positions compacted, cover promoted if needed
vehicle ──delete──▶ image rows cascade, candidate assets reference-checked then destroyed
```

## Input validation

| Input | Rule |
|---|---|
| File bytes | Non-empty; magic bytes must be JPEG (`ff d8 ff`), PNG (`89 50 4e 47 0d 0a 1a 0a`), or WebP (`RIFF`/`WEBP`) |
| Size | ≤10 MB |
| Dimensions | ≥640×480; parsed from the file header, not trusted from the client |
| Count | ≤20 images per vehicle |
| Alt | Optional string, trimmed, ≤160 chars |
| Reorder ids | Must be a set equal to the vehicle's current image ids; no missing, extra, duplicate, or foreign ids |
| Cover id | Must belong to the same tenant and vehicle |
