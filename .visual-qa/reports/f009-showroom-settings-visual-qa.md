# F009 Showroom Settings — Visual QA

**Captured**: 2026-10-18T19:05:21.456Z
**Base URL**: http://prima.otoweb.id:3100
**Verdict**: PASS

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Primary (expected / actual) | Screenshot |
|---|---|---|---|---|---|---|---|
| desktop | prima.otoweb.id/ | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/desktop/public-home.png |
| desktop | prima.otoweb.id/cars | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/desktop/public-inventory.png |
| desktop | prima.otoweb.id/cars/toyota-fortuner-2021-1 | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/desktop/public-detail.png |
| desktop | tenant-b.otoweb.id/ | yes | yes | no | no | #0f766e / #0f766e | .visual-qa/screenshots/desktop/tenant-b-home.png |
| desktop | prima.otoweb.id/admin/settings/showroom | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/desktop/admin-showroom-settings.png |
| mobile | prima.otoweb.id/ | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/mobile/public-home.png |
| mobile | prima.otoweb.id/cars | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/mobile/public-inventory.png |
| mobile | prima.otoweb.id/cars/toyota-fortuner-2021-1 | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/mobile/public-detail.png |
| mobile | tenant-b.otoweb.id/ | yes | yes | no | no | #0f766e / #0f766e | .visual-qa/screenshots/mobile/tenant-b-home.png |
| mobile | prima.otoweb.id/admin/settings/showroom | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/mobile/admin-showroom-settings.png |
| desktop | prima.otoweb.id/ (after save) | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/desktop/public-home-after-save.png |
| mobile | prima.otoweb.id/ (after save) | yes | yes | no | no | #b88a44 / #b88a44 | .visual-qa/screenshots/mobile/public-home-after-save.png |

## Save-without-deploy proof

- Changed the Prima tagline and SEO title in the admin editor and saved.
- Public home then rendered the new tagline and document title without a
  rebuild or deployment.
- Before: `Pilihan mobil berkualitas, tanpa kompromi.`
- After: `Tagline visual QA 1792350317645`
- Title after save: `SEO visual QA 1792350317645`

## Failures

None.

## Scope

- Public home, inventory, vehicle detail, and the second tenant home, desktop
  1440×900 and mobile 390×844.
- Admin `/admin/settings/showroom` editor, desktop and mobile, signed in through
  the QA-only fake GoTrue endpoint using the real `@supabase/ssr` cookie
  contract.
- Each tenant must expose its own stored primary color as a CSS variable, with no
  cross-tenant name leakage and no horizontal overflow.
- The incumbent neutral/amber design is preserved; only accent values and
  tenant data are configuration-driven.
