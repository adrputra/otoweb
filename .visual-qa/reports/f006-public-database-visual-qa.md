# F006 Public Site Visual QA

**Captured**: 2026-10-18T18:11:23.897Z
**Base URL**: http://127.0.0.1:3100
**Verdict**: PASS

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Screenshot |
|---|---|---|---|---|---|---|
| desktop | prima.otoweb.id/ | yes | yes | no | no | .visual-qa/screenshots/desktop/home.png |
| desktop | prima.otoweb.id/cars | yes | yes | no | no | .visual-qa/screenshots/desktop/inventory.png |
| desktop | prima.otoweb.id/cars/toyota-fortuner-2021-1 | yes | yes | no | no | .visual-qa/screenshots/desktop/vehicle-detail.png |
| desktop | tenant-b.otoweb.id/ | yes | yes | no | no | .visual-qa/screenshots/desktop/tenant-b-home.png |
| mobile | prima.otoweb.id/ | yes | yes | no | no | .visual-qa/screenshots/mobile/home.png |
| mobile | prima.otoweb.id/cars | yes | yes | no | no | .visual-qa/screenshots/mobile/inventory.png |
| mobile | prima.otoweb.id/cars/toyota-fortuner-2021-1 | yes | yes | no | no | .visual-qa/screenshots/mobile/vehicle-detail.png |
| mobile | tenant-b.otoweb.id/ | yes | yes | no | no | .visual-qa/screenshots/mobile/tenant-b-home.png |

## Failures

None.

## Scope

- Public home, inventory, vehicle detail, and Tenant B home.
- Desktop 1440×900 and mobile 390×844.
- Hostnames are resolved through Chromium host-resolver rules, so the capture
  exercises the same verified-domain public tenant resolution as production.
- The incumbent neutral/amber visual design is preserved; only tenant-derived
  data and the minimum component wiring changed.
