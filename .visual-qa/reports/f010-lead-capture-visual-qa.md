# F010 Lead Capture — Visual QA

**Captured**: 2026-10-18T19:14:57.905Z
**Base URL**: http://prima.otoweb.id:3100
**Verdict**: PASS

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Required copy | Screenshot |
|---|---|---|---|---|---|---|---|
| desktop | / | yes | yes | no | no | yes | .visual-qa/screenshots/desktop/f010-public-contact-form.png |
| desktop | /admin/leads | yes | yes | no | no | yes | .visual-qa/screenshots/desktop/f010-admin-leads.png |
| mobile | / | yes | yes | no | no | yes | .visual-qa/screenshots/mobile/f010-public-contact-form.png |
| mobile | /admin/leads | yes | yes | no | no | yes | .visual-qa/screenshots/mobile/f010-admin-leads.png |

## Failures

None.

## Scope

- Public home contact form (labels, message field, submit control) on Prima.
- Admin lead dashboard with summary counts, filters, the submitted inquiry, and
  status controls.
- Desktop 1440×900 and mobile 390×844.
- The capture submits a real contact inquiry first, so the dashboard screenshot
  proves the inquiry -> tenant lead -> admin dashboard loop.
- The incumbent neutral/amber design is preserved; no new visual language is
  introduced.
- Cross-tenant text must not appear on the Prima surfaces.
