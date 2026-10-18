# F008 Admin Image Management — Visual QA

**Captured**: 2026-10-18T18:47:56.775Z
**Base URL**: http://prima.otoweb.id:3100
**Verdict**: PASS

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Photos | Screenshot |
|---|---|---|---|---|---|---|---|
| desktop | /admin/vehicles | yes | yes | no | no | 0 | .visual-qa/screenshots/desktop/admin-vehicles.png |
| desktop | /admin/vehicles/new | yes | yes | no | no | 0 | .visual-qa/screenshots/desktop/admin-vehicle-new.png |
| desktop | /admin/vehicles/30000000-0000-4000-8000-000000000001/edit | yes | yes | no | no | 1 | .visual-qa/screenshots/desktop/admin-vehicle-edit.png |
| mobile | /admin/vehicles | yes | yes | no | no | 0 | .visual-qa/screenshots/mobile/admin-vehicles.png |
| mobile | /admin/vehicles/new | yes | yes | no | no | 0 | .visual-qa/screenshots/mobile/admin-vehicle-new.png |
| mobile | /admin/vehicles/30000000-0000-4000-8000-000000000001/edit | yes | yes | no | no | 1 | .visual-qa/screenshots/mobile/admin-vehicle-edit.png |

## Failures

None.

## Scope

- Admin vehicle list, create form, and edit form, including the F008 image
  manager (upload control, photo grid, cover badge, order controls).
- Desktop 1440×900 and mobile 390×844.
- Signed in through a QA-only fake GoTrue endpoint using the real
  `@supabase/ssr` cookie contract; the real Next proxy, admin layout, tenant
  resolver, RLS session, and database code all run.
- The edit route must show the photo manager, at least one stored seeded photo,
  and the cover badge.
- The incumbent neutral/amber admin design is preserved; only image management
  controls were added inside the existing photo section.
