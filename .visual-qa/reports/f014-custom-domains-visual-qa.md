# F014 Custom Domains — Visual QA

**Captured**: 2026-10-18T20:14:27.045Z
**Base URL**: http://prima.otoweb.id:3106
**Verdict**: PASS

| Viewport | URL | Heading | Horizontal overflow | Missing required text | Unexpected text | Screenshot |
|---|---|---|---|---|---|---|
| desktop | http://prima.otoweb.id:3106/platform/tenants/11111111-1111-4111-8111-111111111111 | yes | no | none | none | .visual-qa/screenshots/desktop/f014-platform-custom-domain.png |
| desktop | http://showroom.prima.test:3106/ | yes | no | none | none | .visual-qa/screenshots/desktop/f014-custom-domain-home.png |
| desktop | http://prima.otoweb.id:3106/ | yes | no | none | none | .visual-qa/screenshots/desktop/f014-platform-subdomain-fallback.png |
| mobile | http://prima.otoweb.id:3106/platform/tenants/11111111-1111-4111-8111-111111111111 | yes | no | none | none | .visual-qa/screenshots/mobile/f014-platform-custom-domain.png |
| mobile | http://showroom.prima.test:3106/ | yes | no | none | none | .visual-qa/screenshots/mobile/f014-custom-domain-home.png |
| mobile | http://prima.otoweb.id:3106/ | yes | no | none | none | .visual-qa/screenshots/mobile/f014-platform-subdomain-fallback.png |

## Coverage

- Registered `showroom.prima.test` through the real platform tenant-detail UI.
- Verified DNS and provisioned the certificate through the deterministic fake
  provider selected by `DOMAIN_PROVIDER=fake`.
- Captured the platform domain-management section, the verified custom-domain
  public home, and the `prima.otoweb.id` platform-subdomain fallback.
- Desktop 1440×900 and mobile 390×844, signed in through the QA-only fake GoTrue
  endpoint as the seeded `platform_admin` identity.
- Checks include visible verification/SSL state, exact TXT/CNAME instructions,
  correct showroom identity, absence of the other tenant, and no horizontal
  overflow.

## Failures

None.
