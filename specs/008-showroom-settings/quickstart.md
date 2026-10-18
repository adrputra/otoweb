# Quickstart: Showroom Settings

**Feature**: `008-showroom-settings` | **Date**: 2026-10-19

## Prerequisites

- Dependencies installed and the development database path available (the app
  falls back to in-memory PGlite when `DATABASE_URL` is unset).
- A signed-in owner session for the admin editor. Browser QA uses the existing
  QA-only fake GoTrue endpoint; no production bypass exists.
- Optional media configuration (Production Cloudinary or the development fake
  described in `docs/MEDIA.md`).

## Validate the feature

```bash
# Schema, service, public mapping, media, theme
npx vitest run tests/unit/validation/showroom-settings.test.ts \
  tests/unit/admin/showroom-settings.test.ts \
  tests/unit/admin/showroom-media.test.ts \
  tests/unit/public/showroom-settings.test.ts \
  tests/unit/theme.test.ts

# Admin save → public reflection in a real server
npx playwright test --config playwright.admin.config.ts tests/e2e/admin-showroom-settings.spec.ts

# Desktop + mobile visual evidence
node scripts/visual-qa-showroom.mjs

# Full checkpoint
npx tsc --noEmit
npm test
```

## Manual workflow

1. Sign in and open **Pengaturan → Profil showroom**.
2. Confirm the form is populated from the database (Prima: amber primary,
   WhatsApp `6281299001122`, Jakarta Selatan).
3. Change the tagline, description, opening hours, social links, and SEO fields.
4. Upload a logo and a hero image; watch each upload reach 100%.
5. Press **Simpan perubahan** and wait for the success toast.
6. Reload the page; the values are unchanged.
7. Open `/` and `/cars`; the new name/tagline/hero/contact/social/hours and
   accent color are visible, and the page metadata uses the SEO fields.
8. Open the site on the second tenant hostname; it shows only that tenant's
   configuration.
9. Sign in as staff and open the settings URL; the write path is forbidden.

## Expected evidence

| Check | Evidence |
|---|---|
| Field round-trip and defaults | `tests/unit/admin/showroom-settings.test.ts` |
| Validation and social normalization | `tests/unit/validation/showroom-settings.test.ts` |
| Logo/hero upload reuse | `tests/unit/admin/showroom-media.test.ts` |
| Public mapping after update | `tests/unit/public/showroom-settings.test.ts` |
| Color/contrast variables | `tests/unit/theme.test.ts` |
| Save → public loop | `tests/e2e/admin-showroom-settings.spec.ts` |
| Visual QA | `.visual-qa/reports/f009-showroom-settings-visual-qa.md`, desktop/mobile screenshots |
