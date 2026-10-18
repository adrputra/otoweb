# Admin Vehicle CRUD

Status: implemented in Phase 7 (F007). Source of intent: `docs/ROADMAP.md` §49
and `specs/006-admin-vehicle-crud/`.

The admin vehicle list, create form, edit form, and dashboard vehicle counts read
and write PostgreSQL through tenant-scoped server code. The legacy
`data/index.ts` catalogue remains the deterministic F003 seed and test fixture;
it is not a runtime source for the admin vehicle surface.

## Request flow

```text
/admin/vehicles request
  -> proxy.ts                  (server-verified Supabase session)
  -> requireAdminTenantContext (tenant context + manage_vehicles)
  -> listAdminVehicles         (tenant-filtered Drizzle read)
  -> VehicleTable              (client filters + action buttons)

form submit
  -> server action             (same auth/tenant gate)
  -> shared Zod schema         (server re-validation)
  -> vehicle service           (withTenantSession + tenant filters)
  -> revalidatePath            (admin + public paths)
```

Every action resolves the tenant from the verified hostname or the user's single
active membership. No tenant id is accepted from the browser.

## Modules

| Module | Responsibility |
|---|---|
| `lib/validation/vehicle.ts` | Shared Zod input schema, id/action schemas, slug base |
| `lib/admin/context.ts` | Request user + tenant context + database resolution |
| `lib/admin/vehicle-mapper.ts` | DB row → admin `Vehicle` view model and image grouping |
| `lib/admin/vehicle-queries.ts` | Tenant-scoped admin reads and dashboard stats |
| `lib/admin/vehicle-service.ts` | Create, edit, lifecycle, duplicate, delete with media policy |
| `lib/admin/vehicle-image-service.ts` | Image upload, order, cover, and delete service |
| `lib/admin/media-cleanup.ts` | Reference-counted provider asset cleanup |
| `lib/admin/vehicle-actions.ts` | `'use server'` wrappers and path revalidation |
| `components/admin/vehicle-table.tsx` | Client list, filters, and action wiring |
| `components/admin/vehicle-image-manager.tsx` | Upload progress, DnD ordering, cover, delete |
| `components/vehicle-form.tsx` | Shared schema + server actions, required fields |
| `app/admin/vehicles/**` | Server-rendered list, create, and edit routes |
| `app/admin/page.tsx` | Database vehicle counts and recent units |
| `lib/admin/showroom-settings-service.ts` | Tenant-scoped showroom profile read/update |
| `lib/admin/showroom-settings-actions.ts` | Settings save action and revalidation |
| `lib/admin/showroom-media-service.ts` | Logo/hero upload through the F008 provider |
| `components/admin/showroom-settings-form.tsx` | Showroom editor, uploads, and live preview |

## Status model

`vehicles.status` carries publication and availability together:

| Stored status | Admin publication | Public? |
|---|---|---|
| `draft` | draft | no |
| `available` | published | yes |
| `reserved` | published | yes |
| `sold` | published | yes |
| `archived` | archived | no |

Lifecycle rules:

| Operation | Allowed from | Result |
|---|---|---|
| publish | draft, archived | `available`, `published_at` set |
| reserve | available | `reserved`, `reserved_at` set |
| sell | available, reserved | `sold`, `sold_at` set |
| archive | any non-archived | `archived` |
| duplicate | any | new `draft` with a unique `-copy` slug and copied image rows |
| delete | any | row removed; image rows cascade |

Editing keeps the stored slug so public links stay stable. Creating and
duplicating generate a base slug from brand, model, variant, and year, then
append a numeric suffix when the tenant already uses it.

## Validation

The same `vehicleInputSchema` powers the React Hook Form resolver and the
service's `safeParse`. Server errors are returned as
`{ ok: false, error, fieldErrors }`; the form maps them onto the matching fields.
String numbers are rejected so the server never coerces untrusted values.

Required fields include brand, model, variant, year, transmission, fuel, body
type, engine capacity, mileage, colour, price, plate region, tax expiry,
description, and location. Owner count and document flags are optional with
defaults.

## Images

F008 owns upload, ordering, cover selection, and deletion. The photo section of
the create/edit form is a real manager backed by
`/api/admin/vehicles/{id}/images`:

- JPEG/PNG/WebP uploads (10 MB, 640×480 minimum, 20 images per vehicle) show
  per-file progress and retry transient failures.
- Drag-and-drop and the up/down controls persist contiguous positions.
- Exactly one photo is the cover; the public detail page always renders it
  first.
- Deleting a photo compacts positions and promotes a new cover when needed.
- Deleting a vehicle cascades image rows and destroys provider-owned assets only
  when no remaining row references them. Provider cleanup is best-effort and its
  result is reported in the admin toast.

New vehicles queue selected files in the browser, create the draft, then upload
the queue; if a file still fails the admin is sent to the edit page to retry.
Full provider configuration, limits, media policy, and optimization details are
in `docs/MEDIA.md`.

## Showroom settings

F009 owns the tenant profile editor at `/admin/settings/showroom`. The route
requires `manage_settings`, loads the stored `showroom_settings` row, and saves
the complete form through a server action. The editor covers name, tagline,
description, logo, hero image, colors, contact details, address, opening hours,
social links, and SEO fields; logo/hero uploads reuse the F008 media provider
rather than a second upload path. The admin shell and page header display the
active tenant name instead of hard-coded Prima copy.

Saving revalidates the public home, inventory, and detail routes. The public
site renders the new values on the next request with no deployment. Tenant
colors become CSS accent variables while the incumbent neutral layout and admin
design language stay intact. See `docs/SHOWROOM_SETTINGS.md` for the full
contract and verification matrix.

## Lead capture

F010 owns the tenant lead dashboard at `/admin/leads`. The route requires
`manage_leads` (owner, staff, or platform admin) and lists only the active
tenant's inquiries, newest first. The table supports search, status and source
filters, a desktop table plus mobile cards, an empty state, WhatsApp reply links,
and status updates across the five roadmap statuses (`new`, `contacted`,
`qualified`, `won`, `lost`).

Status changes go through a server action, re-check the capability, and run in
`withTenantSession` with `WHERE id = $lead AND tenant_id = $actorTenant`. The
admin home now reads the real new-lead count and recent leads; the legacy mock
lead array is gone. Public contact submissions and WhatsApp actions create the
leads, so no manual data entry is required. See `docs/LEADS.md` for the public
flows and the full contract.

## Verification

```bash
npx vitest run tests/unit/validation tests/unit/admin
npx playwright test --config playwright.admin.config.ts tests/e2e/admin-showroom-settings.spec.ts
npx tsc --noEmit
npm test
npx playwright test --config playwright.admin.config.ts
pnpm visual:qa:admin
```

The admin Playwright project sets `MEDIA_PROVIDER=fake`, so the image workflow
is exercised end-to-end without Cloudinary credentials. Production uses the
Cloudinary provider described in `docs/MEDIA.md`.

`playwright.admin.config.ts` and `scripts/visual-qa-admin.mjs` start a QA-only
fake GoTrue endpoint (`scripts/fake-supabase-auth.mjs`) and a crafted
`@supabase/ssr` cookie. The real Next proxy, admin layout, tenant resolver, RLS
session, and database run unchanged. No production auth bypass exists.

Visual evidence is written to `.visual-qa/reports/f007-admin-vehicle-crud-visual-qa.md`,
`.visual-qa/reports/f007-admin-capture.json`, and the desktop/mobile screenshots
under `.visual-qa/screenshots/`.

## Boundaries

- No manual database operation is required for any admin action.
- No cross-tenant read or write is possible through the admin surface; the
  service filters by tenant and runs writes inside `withTenantSession`.
- The service role and database credentials never reach the browser.
- No schema migration was needed for this phase.
