# Implementation Plan: Image Management

**Branch**: `007-image-management` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-image-management/spec.md`

## Summary

Add a provider-backed image pipeline to the existing admin vehicle form. A
server-only media provider interface has a Cloudinary implementation (signed
REST calls, no SDK dependency) and a deterministic local fake for development
and tests. Admins upload one or many JPEG/PNG/WebP files with per-file progress
and bounded client/server retries; the service validates content, stores
`vehicle_images` rows with contiguous positions and exactly one cover, and
persists reorder/cover changes. Public and admin reads emit optimized
transformation URLs. Deleting a photo or vehicle cascades database rows and then
destroys provider-owned assets only when no remaining row references them,
best-effort after commit.

## Technical Context

**Language/Version**: TypeScript 5.7 on Node.js 20+ (Next.js 16 App Router)

**Primary Dependencies**: Next.js 16, React 19, Drizzle ORM, Zod 4,
`@dnd-kit/*` (already installed), Node `crypto`/`fs` built-ins. No new runtime
package; Cloudinary is called through its documented REST API.

**Storage**: PostgreSQL `vehicle_images` (existing F003 table); provider assets
in Cloudinary in production, local `public/uploads` for the development fake.

**Testing**: Vitest (unit/integration with PGlite), Testing Library (existing),
Playwright admin project, project Visual QA script.

**Target Platform**: Linux server (Next.js Node runtime) and evergreen browsers
for the admin UI.

**Project Type**: Single Next.js web application.

**Performance Goals**: 15 high-resolution images upload in one workflow; per-file
progress updates at least once per network progress event; admin grid serves
480px transformations and public cards 640px; no full-page reload during
upload.

**Constraints**: 10 MB per file, 640×480 minimum, 20 images per vehicle,
JPEG/PNG/WebP only; tenant + `manage_vehicles` authorization on every operation;
no real Cloudinary credentials in the repository or CI.

**Scale/Scope**: Up to 20 images per vehicle, one tenant per request; media
cleanup scans by provider asset id across tenants to protect shared references.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled project template (no
ratified principles). Per the converge/spec guidance, constitution checks are
skipped gracefully; the existing engineering standards in
`.opencode/context/typescript/standards.md`, tenant isolation rules from F005,
and the roadmap acceptance criteria govern this feature. No violations to
justify.

**Post-design re-check**: Pass — no new service, dependency, or bypass is
introduced; the provider boundary keeps the domain code testable and the
existing tenant/session path is reused.

## Project Structure

### Documentation (this feature)

```text
specs/007-image-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-vehicle-images.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
lib/media/
├── limits.ts              # shared limits and accepted types (client-safe)
├── types.ts               # MediaProvider contract and errors
├── urls.ts                # Cloudinary/Unsplash responsive URL builder
├── inspect.ts             # magic-byte + dimension inspection
├── retry.ts               # bounded retry for transient provider failures
├── cloudinary.ts          # signed Cloudinary REST provider
├── fake.ts                # deterministic local provider for dev/tests
├── provider.ts            # environment-based provider resolution
└── client-upload.ts       # XHR upload with progress + retry (browser)

lib/admin/
├── context.ts             # add requireAdminApiContext (no redirect)
├── vehicle-image-service.ts  # upload/list/reorder/cover/delete service
├── media-cleanup.ts       # reference-counted provider asset destruction
└── vehicle-service.ts     # deleteVehicle captures media and cleans up

lib/validation/
└── vehicle-image.ts       # alt/reorder/cover schemas

app/api/admin/vehicles/[id]/images/
├── route.ts               # POST upload, PATCH reorder/cover
└── [imageId]/route.ts     # DELETE image

components/admin/
└── vehicle-image-manager.tsx  # client photo grid, progress, DnD, cover, delete

components/vehicle-form.tsx  # wires the manager; uploads queued files after create
lib/types.ts                 # VehicleImage view type (provider, thumb, dimensions)
lib/admin/vehicle-mapper.ts  # optimized admin thumbnails
lib/public/queries.ts        # optimized public URLs + cover-first ordering
components/showroom.tsx      # public card uses thumbnail

tests/
├── helpers/image-fixtures.ts
├── unit/media/*.test.ts
├── unit/admin/vehicle-images.test.ts
├── unit/admin/vehicle-service.test.ts   # extended delete/media assertions
└── e2e/admin-vehicle-images.spec.ts

docs/MEDIA.md                # production config, policy, verification
docs/ADMIN.md                # images section updated
docs/DATABASE.md             # media policy cross-reference
.env.example                 # optional Cloudinary placeholders + fake switch
```

**Structure Decision**: Single Next.js application. Media code is isolated under
`lib/media` so the provider boundary is independently testable and never
imported by client components except the client-safe URL/limit modules and the
XHR uploader. Admin service code follows the existing `lib/admin` pattern.

## Complexity Tracking

No constitution violations. The provider interface and reference-counted
cleanup are required by the acceptance criteria (Cloudinary plus verifiable
media policy); a direct Cloudinary call inside a server action was rejected
because it would be untestable without credentials and would risk deleting
assets shared by duplicated vehicles.
