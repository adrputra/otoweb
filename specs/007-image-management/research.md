# Research: Image Management

**Feature**: `007-image-management` | **Date**: 2026-10-19

## Decisions

### D1 — Provider abstraction instead of hard-wired Cloudinary

- **Decision**: Define `MediaProvider` (`upload`, `destroy`, `key`) in
  `lib/media/types.ts`. Production resolves the Cloudinary implementation from
  environment variables; tests/development resolve a deterministic fake.
- **Rationale**: The environment has no Cloudinary account, the roadmap mandates
  Cloudinary in production, and the auth precedent already uses an
  environment-backed backend with a test double. The boundary lets the complete
  workflow (including 15 high-resolution files and media cleanup) be verified
  deterministically.
- **Alternatives rejected**: requiring live credentials (blocks CI and this
  environment); hard-coding Cloudinary calls in server actions (untestable and
  leaks provider semantics into the domain).

### D2 — Cloudinary REST API with signed uploads, no SDK

- **Decision**: Call `POST /v1_1/{cloud}/image/upload` and `/image/destroy` with
  `multipart/form-data`, `api_key`, `timestamp`, and a SHA-1 signature of the
  sorted parameters. Use Node `fetch` and `crypto`.
- **Rationale**: Avoids adding a dependency and keeps the signed-upload boundary
  explicit and unit-testable with an injected `fetch`. Cloudinary recommends
  server-side signed uploads so unsigned presets cannot be abused.
- **Alternatives rejected**: unsigned upload preset (browser-exposed, weaker
  control); `cloudinary` npm SDK (extra dependency, same HTTP contract, harder
  to test offline).

### D3 — Deterministic asset identity makes retries idempotent

- **Decision**: Derive the provider `public_id` from
  `folder/tenantId/vehicleId/sha256(fileBytes)`. The service returns an existing
  row when the same `(vehicle, provider, providerAssetId)` already exists.
- **Rationale**: A client or server retry after a timeout may reach the provider
  more than once; deterministic ids plus a pre-insert existence check prevent
  duplicate rows and duplicate assets. Identical files in one vehicle collapse
  to one row.
- **Alternatives rejected**: random ids (retries duplicate); client-supplied ids
  (untrusted).

### D4 — Retry only transient failures

- **Decision**: Server `uploadWithRetry` retries `MediaProviderError` with
  `code: 'transient'` up to 3 attempts with exponential backoff; the browser XHR
  uploader retries network/5xx failures up to 2 times. 4xx validation errors are
  never retried. Timeouts abort after 30 seconds.
- **Rationale**: Satisfies "upload reliable" without hiding genuine validation
  errors or retry storms.
- **Alternatives rejected**: unlimited retries (duplicate/load risk); no retries
  (flaky mobile uploads).

### D5 — Database is the source of truth; cleanup is reference-counted and best-effort

- **Decision**: Delete DB rows first. Then, for each provider-owned candidate
  (`provider === active provider key` and non-empty asset id), query
  `vehicle_images` across all tenants for that provider/asset id. Destroy only
  when zero rows remain. Report `{ destroyed, failed, skipped }`; never roll back
  or fail the DB operation on provider errors.
- **Rationale**: F007 duplicates image rows that share the same asset id, so
  unconditional deletion would break the duplicate. Seed rows use
  `unsplash`/`external` and must never be destroyed. Post-commit best-effort
  keeps user actions reliable while surfacing cleanup failures.
- **Alternatives rejected**: destroy by URL (unreliable, can hit non-owned
  assets); FK-triggered remote deletion (cannot see other rows after cascade);
  blocking deletion on provider availability (user cannot delete a vehicle when
  Cloudinary is down).

### D6 — Upload path and progress

- **Decision**: One `POST /api/admin/vehicles/{id}/images` multipart request per
  file, driven sequentially by the browser `XMLHttpRequest` so
  `upload.onprogress` is available. The response returns the stored image view.
- **Rationale**: Next.js server actions do not expose upload progress and have a
  smaller body limit. One file per request keeps progress granular, isolates
  failures, and preserves selection order. Sequential upload avoids position
  races and is acceptable for ≤20 images.
- **Alternatives rejected**: a single multipart request for all files (coarse
  progress, one failure loses the batch); presigned direct-to-Cloudinary uploads
  (requires credentials in the browser and bypasses server validation).

### D7 — Validation limits

- **Decision**: JPEG/PNG/WebP only; sniff magic bytes and parse dimensions
  server-side; ≥640×480; ≤10 MB; ≤20 images per vehicle; alt ≤160 characters.
  Client mirrors type/size/count for immediate feedback; the server is
  authoritative.
- **Rationale**: Deterministic, testable, and aligned with typical automotive
  listing photography. Content sniffing prevents extension spoofing.
- **Alternatives rejected**: trusting `File.type` (spoofable); no dimension
  floor (thumbnails become unusable).

### D8 — Optimization via URL transformations

- **Decision**: Build Cloudinary URLs as
  `.../image/upload/f_auto,q_auto,c_limit,w_{width}/...` and Unsplash URLs with
  `auto=format&fit=crop&w={width}&q=82`. Admin thumbs use 480px, public cards
  640px, public hero 1600px. The original URL remains stored; derived URLs are
  generated at read time.
- **Rationale**: Satisfies "thumbnails optimized" without storing variants or
  adding a transform job, and works for seeded Unsplash rows and the local fake.
- **Alternatives rejected**: pre-generating and storing every variant (schema and
  cleanup complexity); relying on `next/image` (project has `unoptimized: true`
  and custom provider URLs).

### D9 — Cover semantics

- **Decision**: Exactly one `is_cover` row per vehicle is enforced by the
  service. First uploaded image becomes cover; cover change is atomic (clear all,
  then set one); deleting the cover promotes the first remaining position.
  Public reads sort the cover first; admin reads keep position order.
- **Rationale**: The public detail must show the chosen cover regardless of
  position, while admins need stable position ordering for drag-and-drop.
- **Alternatives rejected**: DB partial unique index (migration not required by
  the acceptance and would complicate transient reorder updates); implicit
  "position 0 is cover" (cannot represent an intentional cover in the middle).

### D10 — Fake provider writes real files for Visual QA/E2E

- **Decision**: The fake provider writes uploaded bytes under
  `MEDIA_LOCAL_DIR` (default `public/uploads`) and returns `/uploads/...` URLs;
  tests pass a temp directory. `public/uploads/` is gitignored. Provider
  selection: explicit `MEDIA_PROVIDER=fake` in non-production, complete
  Cloudinary config, or the fake in non-production; production without complete
  credentials throws a clear error.
- **Rationale**: Makes the admin grid and E2E uploads render real images while
  keeping CI offline and deterministic.
- **Alternatives rejected**: data URLs (database bloat); serving from memory
  (not visible to Next's static handler across requests).
