# Vehicle Media

Status: implemented in Phase 8 (F008). Source of intent: `docs/ROADMAP.md` §50
and `specs/007-image-management/`.

Admin vehicle photos upload to a media provider, persist as tenant-scoped
`vehicle_images` rows, keep a contiguous order and exactly one cover, and are
delivered through optimized provider URLs. The same code path runs with
Cloudflare R2 (or Cloudinary) in production and with a deterministic local
provider in development and tests.

## Provider boundary

```text
browser (XHR, per-file progress)
  -> POST /api/admin/vehicles/{id}/images
  -> requireAdminApiContext + tenant vehicle lookup
  -> inspectImage (magic bytes, dimensions, size)
  -> uploadWithRetry(MediaProvider)
  -> vehicle_images insert (position, one cover)
  -> revalidate admin/public paths via the normal Next cache behaviour
```

| Module | Responsibility |
|---|---|
| `lib/media/types.ts` | `MediaProvider` contract and transient/permanent errors |
| `lib/media/r2.ts` | Cloudflare R2 (S3-compatible) signed upload/delete calls |
| `lib/media/cloudinary.ts` | Signed Cloudinary upload/destroy REST calls |
| `lib/media/fake.ts` | Deterministic local provider for dev, QA, and tests |
| `lib/media/provider.ts` | Environment-based provider resolution |
| `lib/media/inspect.ts` | JPEG/PNG/WebP content and dimension inspection |
| `lib/media/urls.ts` | Cloudinary/Unsplash/local responsive URLs (R2 URLs are served as-is) |
| `lib/media/client-upload.ts` | Browser progress + bounded transient retry |
| `lib/admin/vehicle-image-service.ts` | Tenant-scoped list/upload/reorder/cover/delete |
| `lib/admin/media-cleanup.ts` | Reference-counted provider asset cleanup |
| `components/admin/vehicle-image-manager.tsx` | Photo grid, progress, DnD, cover, delete |

## Production configuration

### Cloudflare R2 (recommended)

Create a bucket, an R2 API token with Object Read & Write, and a public bucket
domain (`r2.dev` for development or a custom domain such as
`media.example.com`). Set every value together; a partial configuration is
rejected.

```dotenv
MEDIA_PROVIDER=r2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET=otoweb-media
R2_PUBLIC_BASE_URL=https://media.example.com
# Optional overrides:
# R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
# R2_REGION=auto
# MEDIA_UPLOAD_FOLDER=otoweb/vehicles
```

- Uploads use a signed S3 `PutObject` request to
  `https://<account-id>.r2.cloudflarestorage.com/<bucket>/<key>` with
  `aws4fetch`. The `Content-Type` comes from magic-byte inspection and objects
  are cacheable (`public, max-age=31536000, immutable`).
- Deletes use `DeleteObject`; a missing object (404) is treated as success.
- The public URL is `<R2_PUBLIC_BASE_URL>/<key>`. Configure the R2 public
  domain (or a CDN in front of it) so browsers can read the objects.
- Asset keys are deterministic:
  `{folder}/{tenantId}/{vehicleId}/{sha256(fileBytes)}` for vehicles and
  `{folder}/{tenantId}/settings/{kind}/{sha256(fileBytes)}` for showroom media.
  A retry or a repeated upload of the same file returns the existing row
  instead of creating a duplicate; the provider call is skipped.
- No credentials are committed. `.env.example` contains placeholders only.

### Cloudinary (alternative)

Set all three credentials together. A partial configuration is rejected.

```dotenv
MEDIA_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_UPLOAD_FOLDER=otoweb/vehicles
```

- Uploads use `POST https://api.cloudinary.com/v1_1/{cloud}/image/upload` with a
  SHA-1 signature over sorted parameters and `api_key`. No unsigned preset is
  used and the API secret never reaches the browser.
- Destroys use `/image/destroy` with the same public id.

### Development and tests

```dotenv
MEDIA_PROVIDER=fake
MEDIA_LOCAL_DIR=public/uploads
MEDIA_PUBLIC_PREFIX=/uploads
```

- The fake provider writes real bytes so the admin grid and browser tests render
  images without network access. `public/uploads/` is gitignored.
- If `MEDIA_PROVIDER` is unset outside production and no R2/Cloudinary
  credentials exist, the fake provider is selected automatically.
- In production, an upload attempted without object-storage credentials returns
  a clear 502 instead of accepting media it cannot store.

## Limits and validation

| Rule | Value |
|---|---|
| Accepted types | JPEG, PNG, WebP (magic-byte sniffed; client MIME is not trusted) |
| Maximum file size | 10 MB |
| Minimum dimensions | 640 × 480 |
| Maximum images per vehicle | 20 |
| Alt text | optional, trimmed, ≤160 characters |
| Reorder payload | exact set of the vehicle's image ids, no duplicates |
| Cover payload | image id belonging to the same tenant and vehicle |

Client validation mirrors type/size/count for immediate feedback; the server is
authoritative. A corrupt or truncated image is rejected before any provider or
database write.

## Reliability

- The browser uploads one file per request sequentially, so each tile has its
  own progress and a failure does not discard the rest.
- Browser retries: up to 2 additional attempts for network errors, timeouts,
  408/429/5xx, with exponential backoff. 4xx validation errors are not retried.
- Server retries: up to 3 attempts for provider errors classified as
  `transient`; permanent provider errors surface immediately.
- Deterministic asset ids plus the pre-insert existence check make retries
  idempotent.
- Uploads for a new vehicle are queued in the browser, uploaded immediately
  after the draft is created, and the admin is sent to the edit page if any
  photo still fails.

## Ordering and cover

- Positions are contiguous `0..n-1` after upload, reorder, and delete.
- Reorder requires the exact current id set; partial or foreign sets are
  rejected atomically.
- Exactly one row per vehicle has `is_cover = true`. The first upload is the
  default cover; changing it clears the previous cover and sets the new one in
  one transaction.
- Admin reads stay in position order so drag-and-drop is stable. Public reads
  sort the cover first, then position, so the chosen cover is the hero image.
- Deleting the cover promotes the first remaining position automatically.

## Media policy on deletion

1. The database delete happens first (`vehicle_images` also cascades from a
   vehicle delete).
2. Candidate assets are captured before the delete.
3. After commit, each candidate is skipped when its provider is not the active
   provider or its asset id is empty. This protects seeded `unsplash` /
   `external` images and test rows.
4. A candidate is destroyed only when no `vehicle_images` row in any tenant still
   references the same provider asset id. Duplicated vehicles intentionally
   share asset ids, so the asset survives until the last copy is deleted. This
   reference check runs on the server-only database connection (the same
   privileged connection used for migrations/seeds); it must not be executed
   under a tenant-scoped RLS session or other tenants' references would be
   invisible.
5. Provider cleanup is best-effort. Failures are returned as
   `{ destroyed, failed, skipped, failures }` and never roll back or block the
   database operation. The admin list reports failures without pretending the
   media was cleaned.

## Optimization

URLs are derived at read time; the original provider URL remains stored.

| Surface | Transformation |
|---|---|
| Admin grid | 480px thumbnail (`f_auto,q_auto,c_limit,w_480` for Cloudinary; 480px Unsplash crop) |
| Public card | 640px thumbnail |
| Public detail hero | 1600px (`f_auto,q_auto,c_limit,w_1600`) |
| Showroom hero | 2200px |

Local fake URLs have no transformation and are returned unchanged. Seeded
Unsplash URLs gain `auto=format&fit=crop&w=…&q=82`.

## Verification

```bash
npx vitest run tests/unit/media tests/unit/admin
npx tsc --noEmit
npm test
npx playwright test --config playwright.admin.config.ts
pnpm visual:qa:admin
```

- `tests/unit/admin/vehicle-images.test.ts` uploads 15 generated 3000×2000 PNGs
  in one vehicle workflow and covers dedupe, retry, validation, ordering,
  cover/public ordering, deletion/compaction, shared-asset cleanup, cleanup
  failure, and tenant boundaries.
- `tests/unit/media/cloudinary.test.ts` verifies signing and REST request shapes
  without a live account.
- `tests/e2e/admin-vehicle-images.spec.ts` drives 15 uploads through the real
  admin UI and proves order, cover, delete, and vehicle deletion survive reloads.
- Visual evidence: `.visual-qa/reports/f008-admin-image-management-visual-qa.md`
  and `.visual-qa/screenshots/{desktop,mobile}/`.

## Boundaries

- No provider secret is exposed to the browser or committed.
- Every service call is tenant-scoped and requires `manage_vehicles`.
- Media cleanup never deletes media owned by another provider or referenced by
  another row.
- `next.config.mjs` still sets `images.unoptimized: true`; responsive delivery is
  provided by provider transformation URLs (Cloudinary) or the public object
  domain (R2). For R2, put a CDN/cache in front of the bucket if transformed
  variants are needed.
