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
| `lib/admin/vehicle-service.ts` | Create, edit, lifecycle, duplicate, delete |
| `lib/admin/vehicle-actions.ts` | `'use server'` wrappers and path revalidation |
| `components/admin/vehicle-table.tsx` | Client list, filters, and action wiring |
| `components/vehicle-form.tsx` | Shared schema + server actions, required fields |
| `app/admin/vehicles/**` | Server-rendered list, create, and edit routes |
| `app/admin/page.tsx` | Database vehicle counts and recent units |

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

F008 owns upload, ordering, cover selection, and deletion. F007 displays stored
image URLs and copies image rows when duplicating. Newly selected browser
previews are not persisted yet; the form states this above the photo picker.

## Verification

```bash
npx vitest run tests/unit/validation tests/unit/admin
npx tsc --noEmit
npm test
npx playwright test --config playwright.admin.config.ts
pnpm visual:qa:admin
```

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
