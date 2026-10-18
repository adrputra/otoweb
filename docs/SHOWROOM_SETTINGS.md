# Showroom Settings

Status: implemented in Phase 9 (F009). Source of intent:
`docs/ROADMAP.md` §51 and `specs/008-showroom-settings/`.

The showroom profile is a tenant-owned row in `showroom_settings`. Authorized
owners edit it in **Pengaturan → Profil showroom**; every public surface reads
it on the next request. No schema migration was needed: F003 already created
every required column.

## Editable configuration

| Group | Fields |
|---|---|
| Identity | display name, tagline, description |
| Media | logo, hero image (uploaded through the F008 media pipeline) |
| Brand | primary color, secondary color |
| Contact | phone, WhatsApp, email |
| Address | street, city, province, postal code, Google Maps URL |
| Hours | opening hours |
| Social | Instagram, TikTok, Facebook |
| SEO | title, description |

`favicon_url` stays unused because the roadmap does not list it as editable.

## Request flow

```text
/admin/settings/showroom
  -> admin layout              (verified session + tenant context)
  -> requireAdminTenantContext ('manage_settings')
  -> getAdminShowroomSettings  (tenant-filtered read + safe defaults)
  -> ShowroomSettingsForm      (shared Zod validation + preview)

save
  -> updateShowroomSettingsAction (server action, same gate)
  -> updateAdminShowroomSettings  (withTenantSession; tenant is the actor)
  -> revalidatePath               ('/', '/cars', '/cars/[slug]', '/admin')

upload
  -> POST /api/admin/settings/media
  -> requireAdminApiContext ('manage_settings')
  -> inspectImage + deterministic provider id
  -> form saves the returned URL
```

The browser never sends a tenant id or settings id. A tenant without a row gets
safe defaults based on its own name; the first save inserts the row.

## Modules

| Module | Responsibility |
|---|---|
| `lib/validation/showroom-settings.ts` | Shared Zod schema, empty/null helpers, social-handle normalization |
| `lib/admin/showroom-settings-service.ts` | Tenant-scoped read/update, defaults, insert-or-update |
| `lib/admin/showroom-settings-actions.ts` | `'use server'` save wrapper and path revalidation |
| `lib/admin/showroom-media-service.ts` | Logo/hero validation, deterministic ids, provider upload |
| `app/api/admin/settings/media/route.ts` | Authorized upload endpoint |
| `components/admin/showroom-settings-form.tsx` | Editor, color fields, uploads, live preview, errors |
| `app/admin/settings/showroom/page.tsx` | Server-rendered editor route |
| `lib/theme.ts` | Color parsing, contrast foreground, accessible accent, CSS variables |
| `lib/public/metadata.ts` | Tenant SEO metadata with safe fallbacks |
| `lib/public/queries.ts` | Stored row → public `Showroom` view model |
| `app/page.tsx`, `app/cars/**` | Public rendering, theme wrapper, metadata |

## Media reuse

The settings upload route reuses the F008 inspector, provider resolution,
bounded retries, and development fake. Asset ids are deterministic:

```text
otoweb/showrooms/{tenantId}/settings/{logo|hero}/{sha256(bytes)}
```

Rules: JPEG/PNG/WebP, at most 10 MB, at least 640×480. The upload route returns
the stored URL; the form saves it with the rest of the profile, so cancelling an
edit never persists a partial configuration.

## Public rendering and theming

`components/showroom.tsx` and the three public routes render the tenant name,
tagline, description, logo, hero image, contact details, full address, opening
hours, and social links from the database. The page root carries CSS variables
derived from the stored colors:

| Variable | Purpose |
|---|---|
| `--showroom-primary` | Raw tenant primary (surfaces, preview) |
| `--showroom-primary-soft` | Primary mixed toward white for dark hero copy |
| `--showroom-accent` | Primary darkened until it meets 4.5:1 on white |
| `--showroom-secondary` | Footer and filled controls |
| `--showroom-on-primary` / `--showroom-on-secondary` | Readable foreground colors |

The incumbent neutral/amber layout, spacing, typography, and component shapes
are unchanged; only accent values and tenant data become configurable. This is
why the two seeded tenants (amber Prima and teal Tenant B) render as distinct
white-label sites from one deployment.

## SEO fields

Home, inventory, and vehicle-detail routes call `showroomMetadata()`. The home
title/description come from the stored SEO fields; inventory and detail keep
their own contextual title while using the tenant identity. Empty SEO fields
fall back to the showroom name and description, and a stored logo becomes the
site icon. Canonical URLs, OpenGraph, sitemaps, robots, and structured data
remain F011 scope.

## Isolation and permissions

- Reads use `getShowroomSettings(db, tenantId)`; writes run inside
  `withTenantSession`.
- The editor and upload endpoint require `manage_settings` (owner/platform
  admin). Staff receives a redirect from the page and `403` from the API.
- Cross-tenant targeting is impossible through the contract: there is no
  settings id or tenant id in the browser payload.
- Provider secrets, database credentials, and the service role never reach the
  browser.

## Verification

```bash
npx vitest run tests/unit/validation/showroom-settings.test.ts \
  tests/unit/admin/showroom-settings.test.ts \
  tests/unit/admin/showroom-settings-api.test.ts \
  tests/unit/admin/showroom-media.test.ts \
  tests/unit/public/showroom-settings.test.ts \
  tests/unit/theme.test.ts
npx playwright test --config playwright.admin.config.ts tests/e2e/admin-showroom-settings.spec.ts
node scripts/visual-qa-showroom.mjs
npx tsc --noEmit
npm test
```

Visual evidence is written to
`.visual-qa/reports/f009-showroom-settings-visual-qa.md`, `f009-capture.json`,
and the desktop/mobile screenshots under `.visual-qa/screenshots/`.

## Boundaries

- No rebuild or deployment is required to observe a saved change.
- No manual database operation is required for the editor or uploads.
- The feature does not add CRM, analytics, custom-domain, or platform-admin
  behaviour.
- The legacy `data/index.ts` showroom object remains only as the seed fixture,
  never as a runtime settings source.
