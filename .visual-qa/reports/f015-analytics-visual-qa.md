# F015 Analytics — Visual QA

**Captured**: 2026-10-18T20:35:03.456Z
**Base URL**: http://prima.otoweb.id:3100
**Verdict**: PASS

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Vehicle views | Screenshot |
|---|---|---|---|---|---|---|---|
| desktop | /cars/toyota-fortuner-2021-1 | yes | yes | no | no | — | .visual-qa/screenshots/desktop/analytics-vehicle-share.png |
| desktop | /admin | yes | yes | no | no | 5 | .visual-qa/screenshots/desktop/analytics-admin-dashboard.png |
| mobile | /cars/toyota-fortuner-2021-1 | yes | yes | no | no | — | .visual-qa/screenshots/mobile/analytics-vehicle-share.png |
| mobile | /admin | yes | yes | no | no | 10 | .visual-qa/screenshots/mobile/analytics-admin-dashboard.png |

## Failures

None.

## Scope

- Authenticated admin dashboard analytics section (metrics, most viewed
  vehicles, empty-state behaviour) and the public vehicle detail share control.
- Desktop 1440×900 and mobile 390×844.
- Signed in through the QA-only fake GoTrue endpoint using the real
  `@supabase/ssr` cookie contract; the real Next proxy, admin layout, tenant
  resolver, RLS session, database, and analytics beacon all run.
- Three `vehicle_view` events are seeded through the public beacon before the
  dashboard capture so the most-viewed panel is proven with real data.
- The incumbent neutral/amber admin and showroom design is preserved; F015 only
  adds the analytics section and replaces the inert share control.
