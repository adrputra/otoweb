# Implementation Plan: Showroom Settings

**Branch**: `008-showroom-settings` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-showroom-settings/spec.md`

## Summary

Replace the static showroom-settings mock with a tenant-scoped, database-backed
editor and make the public site consume every stored setting. The existing F003
`showroom_settings` table already holds all required fields, so no migration is
introduced. A shared Zod schema validates the form on both sides, a service
writes inside `withTenantSession`, a server action revalidates the affected
paths, and logo/hero uploads reuse the F008 media provider pipeline. The public
view model gains province, postal code, and a logo, and derives CSS accent
variables from the tenant's primary/secondary colors while preserving the
incumbent layout. Admin shell and page headers become tenant-derived, and public
`generateMetadata` uses the tenant SEO fields. Every read and write is scoped to
the active tenant and requires `manage_settings`.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20+, Next.js 16 App Router, React
19

**Primary Dependencies**: Drizzle ORM, Zod 4, React Hook Form +
`@hookform/resolvers`, `sonner`, `lucide-react`, existing F008 media modules
(`lib/media/*`). No new package.

**Storage**: Existing PostgreSQL `showroom_settings` (F003), one row per tenant.
No schema change. Media assets use the existing Cloudinary/fake provider.

**Testing**: Vitest with PGlite for service and mapping tests; Testing Library
only where a component is directly valuable; Playwright admin project for the
save-to-public loop; project Visual QA capture for desktop/mobile evidence.

**Target Platform**: Next.js Node runtime, responsive admin and public web.

**Project Type**: Single Next.js web application.

**Performance Goals**: Settings page loads in one tenant-scoped read; save is one
transaction; public pages remain request-rendered and observe changes on the
next request. No client bundle receives database or tenant-server modules.

**Constraints**: `manage_settings` capability, tenant isolation, shared
validation, no service-role/browser exposure, preserve incumbent neutral/amber
admin and public editorial design, no deployment step for saved changes.

**Scale/Scope**: One settings row per tenant; three public routes; one admin
settings route plus one upload endpoint.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled project template with no
ratified principles, so constitution checks are skipped gracefully. The
governing constraints are the roadmap acceptance criteria, F005 tenant isolation
(`docs/TENANCY.md`), F008 media policy (`docs/MEDIA.md`), and the repository
TypeScript standards. No violation to justify.

**Post-design re-check**: Pass — the design reuses the existing tenant session,
permission matrix, media provider, and public query facade. It introduces no new
service, bypass, or credential path.

## Project Structure

### Documentation (this feature)

```text
specs/008-showroom-settings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── showroom-settings.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
lib/
├── validation/showroom-settings.ts   # shared schema + social/URL normalization
├── admin/showroom-settings-service.ts # tenant-scoped read/update service
├── admin/showroom-settings-actions.ts # 'use server' save + revalidation
├── admin/showroom-media-service.ts    # logo/hero upload through F008 provider
├── public/queries.ts                  # extended showroom mapping (logo, address)
├── public/metadata.ts                 # tenant SEO metadata helper
├── theme.ts                           # color parse/contrast/CSS variable helper
└── types.ts                           # Showroom view model additions

app/
├── api/admin/settings/media/route.ts  # authorized logo/hero upload
├── admin/layout.tsx                   # tenant name for the shell
├── admin/settings/showroom/page.tsx   # server data load + editor
├── page.tsx                           # theme wrapper, logo, contact, socials, metadata
├── cars/page.tsx                      # theme wrapper + metadata
└── cars/[slug]/page.tsx               # theme wrapper + metadata

components/
├── admin-shell.tsx                    # tenant-derived name/location
├── admin/showroom-settings-form.tsx   # client editor, preview, uploads
└── showroom.tsx                       # logo + themed accents on public chrome

tests/
├── unit/admin/showroom-settings.test.ts
├── unit/admin/showroom-media.test.ts
├── unit/validation/showroom-settings.test.ts
├── unit/public/showroom-settings.test.ts
├── unit/theme.test.ts
└── e2e/admin-showroom-settings.spec.ts

scripts/
└── visual-qa-showroom.mjs             # F009 desktop/mobile visual evidence

docs/
├── SHOWROOM_SETTINGS.md               # new feature documentation
├── ADMIN.md                           # settings editor cross-reference
├── PUBLIC_SITE.md                     # mapping/theming/metadata update
└── DATABASE.md                        # note that F009 needs no schema change
```

**Structure Decision**: Single application. Settings code follows the existing
`lib/validation` + `lib/admin` + server-action pattern used by F007/F008; public
theming stays in the existing `lib/types`/`components/showroom` surface.

## Design Decisions

1. **No migration.** `showroom_settings` already contains every editable column.
   The service maps empty optional strings to `NULL` on write and back to `''`
   on read, so the form never renders `"null"`.
2. **One shared schema.** `showroomSettingsInputSchema` is client-safe and is the
   RHF resolver and the service's authoritative parse. URLs accept `https://` or
   root-relative upload paths; social handles (`@name` or bare name) normalize to
   the platform URL on the server.
3. **Tenant-scoped write.** `updateShowroomSettings` uses `withTenantSession` and
   only the actor's tenant id. There is no settings id in the browser contract.
   A missing row is created for that tenant; an existing row is updated.
4. **Media reuse.** `POST /api/admin/settings/media` requires
   `manage_settings`, accepts `kind=logo|hero`, inspects content with the F008
   inspector, and uploads with a deterministic
   `otoweb/showrooms/{tenantId}/settings/{kind}/{sha256}` public id through the
   configured provider. The returned URL is saved with the form.
5. **Theming.** `lib/theme.ts` parses hex colors, derives an accessible accent
   (falls back to a darker shade for small text on white), derives foreground
   colors for filled surfaces, and emits CSS custom properties. Public pages put
   those variables on the page root; Tailwind arbitrary color utilities and a
   few inline background styles read them. Static neutral/amber chrome, layout,
   spacing, and typography stay unchanged.
6. **Metadata.** `lib/public/metadata.ts` turns the mapped Showroom into Next
   `Metadata` (title, description, icon from logo, safe fallback). Home,
   inventory, and detail pages call it so SEO fields take effect without a
   deployment. Full sitemap/structured-data productionization remains F011.
7. **White-label admin shell.** `app/admin/layout.tsx` resolves the tenant
   context and settings display name; `AdminShell` and `PageHeader` read it from
   a small React context instead of hard-coded "Prima Auto Gallery".
8. **Revalidation.** The save action revalidates `/`, `/cars`, the vehicle detail
   route pattern, and the admin settings route after a successful write. Public
   routes stay `force-dynamic`, so the database is authoritative even if a cache
   entry is missing.

## Complexity Tracking

No constitution violations. The only added abstractions are a pure theme helper
and a thin settings-media service; both keep server-only code out of the client
and make the acceptance behaviour independently testable. A direct write inside
the page component was rejected because it would bypass the proven server-action
and tenant-session path.
