# Contract: Admin Vehicle Images

**Feature**: `007-image-management` | **Date**: 2026-10-19

All routes are server-side only, require a verified session and the
`manage_vehicles` capability, and resolve the tenant from the request host /
membership. No tenant id is accepted from the browser.

Common error shape:

```json
{
  "ok": false,
  "error": "invalid | not_found | conflict | provider | unauthorized | forbidden",
  "message": "Human-readable Indonesian message",
  "fieldErrors": { "field": ["message"] }
}
```

HTTP mapping: `invalid → 400`, `unauthorized → 401`, `forbidden → 403`,
`not_found → 404`, `conflict → 409`, `provider → 502`.

## POST `/api/admin/vehicles/{vehicleId}/images`

Upload one image. `multipart/form-data`.

| Field | Type | Rule |
|---|---|---|
| `file` | File | Required; JPEG/PNG/WebP; ≤10 MB; ≥640×480 |
| `alt` | string | Optional; ≤160 chars |

**Success 201**

```json
{
  "ok": true,
  "data": {
    "deduplicated": false,
    "image": {
      "id": "uuid",
      "url": "https://res.cloudinary.com/.../image/upload/v.../otoweb/...jpg",
      "alt": "foto-depan.jpg",
      "order": 0,
      "isCover": true,
      "thumbnailUrl": "https://res.cloudinary.com/.../image/upload/f_auto,q_auto,c_limit,w_480/...",
      "provider": "cloudinary",
      "providerAssetId": "otoweb/vehicles/<tenant>/<vehicle>/<sha256>",
      "width": 3000,
      "height": 2000
    }
  }
}
```

`deduplicated: true` means an identical file was already stored for this
vehicle; the existing row is returned and no provider call is made.

## PATCH `/api/admin/vehicles/{vehicleId}/images`

JSON body, discriminated union:

```json
{ "action": "reorder", "imageIds": ["uuid-a", "uuid-b", "uuid-c"] }
```

```json
{ "action": "cover", "imageId": "uuid-b" }
```

**Success 200**

```json
{ "ok": true, "data": { "images": [ /* ordered image view models */ ] } }
```

Reorder requires the exact current id set. Cover requires an id belonging to the
vehicle. Both operations are tenant-scoped and atomic.

## DELETE `/api/admin/vehicles/{vehicleId}/images/{imageId}`

Removes the row, compacts positions, promotes a new cover when needed, and
runs reference-counted provider cleanup after the database commit.

**Success 200**

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "images": [ /* remaining image view models */ ],
    "media": {
      "destroyed": 1,
      "failed": 0,
      "skipped": 0,
      "failures": []
    }
  }
}
```

## Vehicle deletion

`deleteVehicle` keeps its existing service result shape and adds media cleanup
metadata:

```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "media": { "destroyed": 3, "failed": 0, "skipped": 1, "failures": [] }
  }
}
```

The database deletion always succeeds even when provider cleanup fails.

## Provider selection

| Environment | Selected provider |
|---|---|
| Complete `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | `cloudinary` |
| `MEDIA_PROVIDER=fake` and `NODE_ENV !== 'production'` | `fake` |
| No Cloudinary config and `NODE_ENV !== 'production'` | `fake` (local files) |
| No Cloudinary config and `NODE_ENV === 'production'` | error: media is not configured |

Partial Cloudinary configuration throws at startup/validation time with the
missing variable names. `MEDIA_LOCAL_DIR` and `MEDIA_PUBLIC_PREFIX` configure the
fake provider; defaults are `public/uploads` and `/uploads`.
