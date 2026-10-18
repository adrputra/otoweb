# Feature Specification: Image Management

**Feature Branch**: `007-image-management`

**Created**: 2026-10-19

**Status**: Ready for planning

**Input**: Roadmap §50 — integrate Cloudinary and implement upload, multiple
upload, progress, reordering, cover selection, deletion, validation, and
optimization for admin vehicle images. Test approximately 15 high-resolution
images in one vehicle workflow and prove that ordering, cover, optimized
thumbnails, and vehicle-deletion media policy persist correctly.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload vehicle photos with visible progress (Priority: P1)

A signed-in showroom admin opens a vehicle form and selects one or many
high-resolution photos. Each photo uploads to the configured media provider with
a visible progress indicator; a failed upload can be retried without creating
duplicate media rows. The stored photos appear in the admin form and on the
public vehicle page.

**Why this priority**: Upload is the entry point for every other image
capability and the roadmap's first acceptance item.

**Independent Test**: Create a draft vehicle, upload approximately 15 generated
high-resolution images through the real upload orchestration with an injected
deterministic media provider, and assert that all 15 rows are stored for the
tenant and vehicle, each upload reports monotonic progress, and a simulated
transient provider failure retries successfully without duplicating a row.

**Acceptance Scenarios**:

1. **Given** a stored vehicle and a valid JPEG, PNG, or WebP file, **When** the
   admin uploads it, **Then** exactly one tenant-owned image row is stored with
   the provider asset id, URL, dimensions, position, and cover state.
2. **Given** several selected files, **When** they upload, **Then** each file
   has its own progress value that advances to 100 and the stored order matches
   the selection order.
3. **Given** a transient provider failure, **When** the upload runs, **Then**
   it retries a bounded number of times and succeeds without storing a
   duplicate row.
4. **Given** an invalid file (unsupported type, corrupt content, too large, or
   too small), **When** it is uploaded, **Then** the server rejects it with a
   readable message and stores nothing.

---

### User Story 2 - Reorder photos and choose the cover (Priority: P2)

An admin drags or moves photos into the desired order and marks one as the
cover. The order and cover survive a page reload, a new admin session, and the
public vehicle detail page.

**Why this priority**: Buyers judge a listing by its first photo; a persisted
cover and ordering are the roadmap's explicit acceptance items.

**Independent Test**: Upload at least three photos, move the last photo to the
front, set a different cover, reload the edit page, and re-read the public
vehicle; assert the stored positions are contiguous and the cover is the chosen
photo.

**Acceptance Scenarios**:

1. **Given** stored photos, **When** the admin reorders them, **Then**
   positions are rewritten contiguously and a reload shows the new order.
2. **Given** stored photos, **When** the admin chooses a cover, **Then** exactly
   one photo is the cover and the public vehicle uses it.
3. **Given** the cover photo is deleted, **When** the deletion completes,
   **Then** the first remaining photo becomes the cover automatically.

---

### User Story 3 - Delete photos and vehicles with a correct media policy (Priority: P3)

An admin removes an individual photo, or deletes a whole vehicle. Database
references and provider-owned media are cleaned up according to one policy:
media is removed only when no remaining image row references it.

**Why this priority**: Orphaned or wrongly deleted media is a data-loss and cost
risk; the roadmap requires the vehicle-deletion media policy to be correct.

**Independent Test**: Upload media, duplicate the vehicle so two rows share an
asset, delete one vehicle's row, and assert the shared asset is preserved; then
delete the last reference and assert the provider asset is destroyed. Assert
external/seed images are never destroyed.

**Acceptance Scenarios**:

1. **Given** a vehicle photo, **When** the admin deletes it, **Then** the row
   is removed, remaining positions are contiguous, and the provider asset is
   destroyed only if no row still references it.
2. **Given** a vehicle, **When** the admin deletes the vehicle, **Then** all its
   image rows cascade away and provider-owned assets with no remaining
   reference are destroyed best-effort.
3. **Given** an image row owned by another provider (for example a seeded
   external image) or a malformed provider asset id, **When** cleanup runs,
   **Then** it is skipped and never sent to the media provider for destruction.
4. **Given** a provider cleanup failure, **When** the vehicle or photo deletion
   completes, **Then** the database operation still succeeds, the failure is
   reported, and no user data is resurrected.

---

### User Story 4 - Tenant-scoped media boundaries (Priority: P4)

Every upload, reorder, cover change, and deletion is authorized for the active
tenant and `manage_vehicles` capability. One showroom can never read, mutate, or
destroy another showroom's media.

**Why this priority**: F005 established tenant isolation; a new binary surface
must not weaken it.

**Independent Test**: Attempt upload, reorder, cover, and delete against a
Prima vehicle id as a Tenant B actor and assert not-found/rejection with no row
or provider change.

**Acceptance Scenarios**:

1. **Given** a Prima vehicle, **When** a Tenant B admin targets it, **Then**
   every image operation is rejected before provider mutation.
2. **Given** no authenticated session or missing capability, **When** an image
   endpoint is called, **Then** it returns unauthorized/forbidden and stores
   nothing.

---

### Edge Cases

- Two identical files uploaded to the same vehicle resolve to the same
  deterministic provider asset id; the second upload returns the existing row
  instead of duplicating it.
- A vehicle already has the maximum number of photos; further uploads are
  rejected with a clear message.
- Files with a spoofed extension but non-image bytes are rejected by content
  inspection.
- A deleted or cross-tenant vehicle id returns not found for every operation.
- Reordering with a missing, duplicated, or foreign image id is rejected
  atomically; positions remain unchanged.
- A vehicle with zero images keeps the existing public placeholder behaviour.
- Production has no media credentials configured; the application fails clearly
  rather than silently accepting uploads that cannot be stored.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST integrate Cloudinary as the production media
  provider behind a provider interface configured from environment variables.
- **FR-002**: The system MUST allow an injected deterministic provider for
  development and tests, so the complete workflow can be verified without live
  credentials.
- **FR-003**: Admins MUST be able to upload one or many vehicle images in a
  single workflow, and every upload MUST report per-file progress to the UI.
- **FR-004**: Uploads MUST be reliable: transient provider failures MUST be
  retried a bounded number of times, and retries MUST NOT duplicate stored rows
  for the same file and vehicle.
- **FR-005**: The system MUST validate file content, MIME type, size,
  dimensions, per-vehicle count, and alt text on the server before storing.
- **FR-006**: The system MUST persist image ordering and MUST return images in
  contiguous position order from admin and public reads.
- **FR-007**: Admins MUST be able to select exactly one cover image per vehicle;
  the cover MUST persist and MUST be reflected on the public vehicle detail.
- **FR-008**: Admins MUST be able to delete an individual image; remaining
  positions MUST be compacted and a new cover chosen when the cover is removed.
- **FR-009**: Deleting a vehicle MUST remove its image rows and MUST clean up
  provider-owned assets only when no remaining row references that asset.
- **FR-010**: Media cleanup MUST be best-effort: provider failures MUST NOT fail
  or roll back the database deletion, and MUST be reported to the caller.
- **FR-011**: The system MUST store image URLs that produce optimized delivery:
  provider transformation URLs for stored Cloudinary assets, responsive
  thumbnail URLs for admin grids, and a responsive main image for public
  details. Optimized URLs MUST preserve the original asset.
- **FR-012**: Every image operation MUST be authorized by the active tenant and
  the `manage_vehicles` capability, and MUST reject cross-tenant ids before any
  provider call.
- **FR-013**: Production media configuration MUST be documented without
  committing real credentials; a partially configured provider MUST fail
  clearly.
- **FR-014**: The feature MUST provide deterministic high-resolution test images
  and cover approximately 15 of them in one vehicle workflow.

### Key Entities *(include if data involved)*

- **Vehicle Image**: A tenant-owned photo attached to a vehicle. Key attributes:
  vehicle, tenant, provider, provider asset id, URL, alt text, position, cover
  flag, width, height, and creation time.
- **Media Provider**: An interchangeable upload/destroy backend. Production uses
  Cloudinary; development and tests use a deterministic local fake.
- **Media Policy**: The rules that decide when a provider-owned asset is
  destroyed, based on remaining database references and provider ownership.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can upload 15 high-resolution images to one vehicle in a
  single workflow with each image reaching 100% progress and a stored row.
- **SC-002**: 100% of reorder and cover changes survive a reload and are visible
  to a fresh read of the public vehicle.
- **SC-003**: No remote asset is destroyed while any remaining vehicle image row
  references it; seeded/external media is never destroyed.
- **SC-004**: Invalid uploads are rejected before storage with a readable
  message, and zero invalid rows are written.
- **SC-005**: Every admin thumbnail and public hero image URL carries an
  optimization transformation for its provider.
- **SC-006**: Cross-tenant image operations result in zero database writes and
  zero provider calls.

## Assumptions

- The repository has no Cloudinary credentials and must not fabricate them; the
  production provider is verified by unit tests of signing and URL building,
  while the full workflow is verified with the injected fake provider.
- Upload limits: JPEG/PNG/WebP only, at least 640×480, at most 10 MB per file,
  and at most 20 images per vehicle. Alt text is optional and capped at 160
  characters.
- Media ownership is determined by the stored `provider` value and a non-empty
  `provider_asset_id`. Rows with `unsplash`, `external`, `test`, or an empty
  asset id are never destroyed by media cleanup.
- Provider cleanup is best-effort and after the database commit. Database state
  remains the source of truth.
- Deterministic test images are generated locally at 3000×2000 so "15
  high-resolution images" is verified without adding binary fixtures.
- The incumbent neutral/amber admin visual language is preserved; this feature
  adds image management controls inside the existing photo section.
