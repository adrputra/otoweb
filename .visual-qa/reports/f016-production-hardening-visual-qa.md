# F016 Production Hardening Visual QA

**Captured**: 2026-10-18T21:00:30.046Z
**Base URL**: http://prima.otoweb.id:3102
**Verdict**: PASS

| Viewport | Route | Status | Result | Findings | Screenshot |
|---|---|---|---|---|---|
| desktop | prima.otoweb.id/ | 200 | PASS | — | .visual-qa/screenshots/desktop/f016-prima-home.png |
| desktop | prima.otoweb.id/cars | 200 | PASS | — | .visual-qa/screenshots/desktop/f016-prima-inventory.png |
| desktop | prima.otoweb.id/cars/toyota-fortuner-2021-1 | 200 | PASS | — | .visual-qa/screenshots/desktop/f016-prima-detail.png |
| desktop | tenant-b.otoweb.id/ | 200 | PASS | — | .visual-qa/screenshots/desktop/f016-tenant-b-home.png |
| desktop | tenant-b.otoweb.id/cars | 200 | PASS | — | .visual-qa/screenshots/desktop/f016-tenant-b-inventory.png |
| desktop | tenant-b.otoweb.id/cars/toyota-rush-2022-1 | 200 | PASS | — | .visual-qa/screenshots/desktop/f016-tenant-b-detail.png |
| desktop | unknown.otoweb.id/ | 404 | PASS | — | .visual-qa/screenshots/desktop/f016-unknown-host-404.png |
| mobile | prima.otoweb.id/ | 200 | PASS | — | .visual-qa/screenshots/mobile/f016-prima-home.png |
| mobile | prima.otoweb.id/cars | 200 | PASS | — | .visual-qa/screenshots/mobile/f016-prima-inventory.png |
| mobile | prima.otoweb.id/cars/toyota-fortuner-2021-1 | 200 | PASS | — | .visual-qa/screenshots/mobile/f016-prima-detail.png |
| mobile | tenant-b.otoweb.id/ | 200 | PASS | — | .visual-qa/screenshots/mobile/f016-tenant-b-home.png |
| mobile | tenant-b.otoweb.id/cars | 200 | PASS | — | .visual-qa/screenshots/mobile/f016-tenant-b-inventory.png |
| mobile | tenant-b.otoweb.id/cars/toyota-rush-2022-1 | 200 | PASS | — | .visual-qa/screenshots/mobile/f016-tenant-b-detail.png |
| mobile | unknown.otoweb.id/ | 404 | PASS | — | .visual-qa/screenshots/mobile/f016-unknown-host-404.png |

## Coverage

- Prima Auto Gallery and Tenant B Test Showroom: home, inventory, and vehicle detail.
- Desktop 1440×900 and mobile 390×844.
- Tenant-specific identity, contact details, inventory, cross-tenant leakage, and horizontal overflow.
- Unknown-host failure state: status 404, no tenant identity, and visible not-found copy.

## Failures

None.
