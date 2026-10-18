# F012 Platform Administration — Visual QA

**Captured**: 2026-10-18T19:39:29.016Z
**Base URL**: http://prima.otoweb.id:3104
**Verdict**: PASS

| Viewport | Route | Heading | Horizontal overflow | Missing required text | Screenshot |
|---|---|---|---|---|---|
| desktop | /platform | yes | no | none | .visual-qa/screenshots/desktop/f012-platform-list.png |
| desktop | /platform/tenants/new | yes | no | none | .visual-qa/screenshots/desktop/f012-platform-new.png |
| desktop | /platform/tenants/11111111-1111-4111-8111-111111111111 | yes | no | none | .visual-qa/screenshots/desktop/f012-platform-detail.png |
| mobile | /platform | yes | no | none | .visual-qa/screenshots/mobile/f012-platform-list.png |
| mobile | /platform/tenants/new | yes | no | none | .visual-qa/screenshots/mobile/f012-platform-new.png |
| mobile | /platform/tenants/11111111-1111-4111-8111-111111111111 | yes | no | none | .visual-qa/screenshots/mobile/f012-platform-detail.png |

## Failures

None.

## Scope

- Platform tenant list, create form, and the seeded Prima tenant detail with
  plan, status, owner, subdomain, and disable controls.
- Desktop 1440×900 and mobile 390×844.
- Signed in through the QA-only fake GoTrue endpoint as the seeded
  `platform_admin` identity. The real Next proxy, platform layout, explicit
  operator membership check, and database code all run.
- No horizontal overflow and every roadmap capability is visible without a
  modal or a separate admin navigation.
- The incumbent neutral palette, square borders, Inter/Jakarta typography, and
  form vocabulary are preserved; the platform shell is distinguished by its
  dark navigation surface and separate two-item navigation.
