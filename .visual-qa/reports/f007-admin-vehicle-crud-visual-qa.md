# F007 Admin Vehicle CRUD — Visual QA

**Captured**: 2026-10-18T18:24:41.386Z
**Base URL**: http://prima.otoweb.id:3100
**Verdict**: PASS

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Screenshot |
|---|---|---|---|---|---|---|
| desktop | /admin/vehicles | yes | yes | no | no | .visual-qa/screenshots/desktop/admin-vehicles.png |
| desktop | /admin/vehicles/new | yes | yes | no | no | .visual-qa/screenshots/desktop/admin-vehicle-new.png |
| desktop | /admin/vehicles/30000000-0000-4000-8000-000000000001/edit | yes | yes | no | no | .visual-qa/screenshots/desktop/admin-vehicle-edit.png |
| mobile | /admin/vehicles | yes | yes | no | no | .visual-qa/screenshots/mobile/admin-vehicles.png |
| mobile | /admin/vehicles/new | yes | yes | no | no | .visual-qa/screenshots/mobile/admin-vehicle-new.png |
| mobile | /admin/vehicles/30000000-0000-4000-8000-000000000001/edit | yes | yes | no | no | .visual-qa/screenshots/mobile/admin-vehicle-edit.png |

## Failures

None.

## Scope

- Admin vehicle list, create form, and edit form.
- Desktop 1440×900 and mobile 390×844.
- Signed in through a QA-only fake GoTrue endpoint using the real
  `@supabase/ssr` cookie contract; the real Next proxy, admin layout, tenant
  resolver, RLS session, and database code all run.
- The incumbent neutral/amber admin design is preserved; only data wiring and
  the required form fields changed.

## Manual inspection

- The desktop list keeps the incumbent neutral/amber table, filters, mobile
  card layout, and action density; edit, publish, reserve, sell, archive,
  duplicate, and delete controls are visible and aligned.
- The create and edit forms keep the existing section cards, live preview,
  photo step, and Indonesian copy. The required engine capacity, plate number,
  location, owner count, and document fields sit in the existing Detail section
  without changing the visual language.
- The mobile list collapses to cards with the bottom navigation intact. The
  mobile form's save/publish bar now sits above the bottom navigation instead of
  being covered by it (one in-scope defect found and fixed during this pass).
- No horizontal overflow, clipping, cross-tenant copy, or missing heading was
  found at either viewport.

## Detector output

`impeccable detect --json components/vehicle-form.tsx
components/admin/vehicle-table.tsx components/admin-shell.tsx app/admin/page.tsx
app/admin/vehicles` exited 0 with an empty findings array:

```json
[]
```

Raw output: `.visual-qa/reports/impeccable-detect-f007.json` (stderr:
`.visual-qa/reports/impeccable-detect-f007.stderr.txt`, empty).

## Fixes

One bounded fix: offset the fixed form action bar above the mobile admin bottom
navigation and increase the form's bottom padding. The capture was re-run after
the fix; the table above is the fresh result.
