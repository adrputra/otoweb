# F013 Subdomain Routing Visual QA

**Captured**: 2026-10-18T19:52:49.316Z
**Base URL**: http://127.0.0.1:3101
**Verdict**: PASS

| Viewport | Route | Result | Findings | Screenshot |
|---|---|---|---|---|
| desktop | prima.otoweb.id/ | PASS | — | .visual-qa/screenshots/desktop/f013-prima-otoweb-home.png |
| desktop | tenant-b.otoweb.id/ | PASS | — | .visual-qa/screenshots/desktop/f013-tenant-b-otoweb-home.png |
| desktop | prima.otoweb.id/cars | PASS | — | .visual-qa/screenshots/desktop/f013-prima-otoweb-inventory.png |
| desktop | tenant-b.otoweb.id/cars | PASS | — | .visual-qa/screenshots/desktop/f013-tenant-b-otoweb-inventory.png |
| desktop | prima.localhost/ | PASS | — | .visual-qa/screenshots/desktop/f013-prima-localhost-home.png |
| desktop | tenant-b.localhost/ | PASS | — | .visual-qa/screenshots/desktop/f013-tenant-b-localhost-home.png |
| mobile | prima.otoweb.id/ | PASS | — | .visual-qa/screenshots/mobile/f013-prima-otoweb-home.png |
| mobile | tenant-b.otoweb.id/ | PASS | — | .visual-qa/screenshots/mobile/f013-tenant-b-otoweb-home.png |
| mobile | prima.otoweb.id/cars | PASS | — | .visual-qa/screenshots/mobile/f013-prima-otoweb-inventory.png |
| mobile | tenant-b.otoweb.id/cars | PASS | — | .visual-qa/screenshots/mobile/f013-tenant-b-otoweb-inventory.png |
| mobile | prima.localhost/ | PASS | — | .visual-qa/screenshots/mobile/f013-prima-localhost-home.png |
| mobile | tenant-b.localhost/ | PASS | — | .visual-qa/screenshots/mobile/f013-tenant-b-localhost-home.png |

## Coverage

- Production-shaped exact hosts: `prima.otoweb.id`, `tenant-b.otoweb.id`.
- Development hosts: `prima.localhost`, `tenant-b.localhost`.
- Home and inventory surfaces at desktop 1440×900 and mobile 390×844.
- Each route checks the expected tenant name, absence of the other tenant,
  tenant-specific contact details, tenant-specific inventory (or the Tenant B
  empty state), and horizontal overflow.

## Failures

None.
