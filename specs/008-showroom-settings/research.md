# Research: Showroom Settings

**Feature**: `008-showroom-settings` | **Date**: 2026-10-19

## Decision: reuse `showroom_settings` without a migration

**Rationale**: F003 created the table with `display_name`, `tagline`,
`description`, `logo_url`, `hero_image_url`, `primary_color`, `secondary_color`,
`phone`, `whatsapp`, `email`, `address`, `city`, `province`, `postal_code`,
`google_maps_url`, `instagram_url`, `tiktok_url`, `facebook_url`,
`opening_hours`, `seo_title`, `seo_description`, and timestamps. Every roadmap
field maps to an existing column, so adding a migration would be churn with no
data benefit. `favicon_url` stays unused because the roadmap does not list it.

**Alternatives considered**: Adding hero headline/subheadline columns. Rejected:
the incumbent public hero already derives its headline from the showroom name
and its subheadline from the description; F011 owns deeper SEO/marketing copy.

## Decision: shared Zod schema and server-authoritative parse

**Rationale**: F007 established the pattern: the browser uses the same schema
for immediate feedback and the server re-parses the same contract before any
write. The schema must stay free of database/Node imports so the client bundle
remains safe.

Rules:

- `displayName`: required, trimmed, 1–120 characters.
- `tagline` ≤160, `description` ≤2,000, `openingHours` ≤200.
- `logoUrl`/`heroImageUrl`: empty, `https://`, `http://`, or a root-relative
  path (needed by the fake provider's `/uploads/...` URLs).
- `primaryColor`/`secondaryColor`: `#RRGGBB`.
- `email`: empty or a valid email address.
- `phone`/`whatsapp`: digits plus `+ - ( )` and spaces, ≤32 characters.
- Address fields and map URL: bounded strings; map URL must be HTTP(S) or empty.
- Social values: empty, HTTP(S) URL, `@handle`, or bare handle. The service
  normalizes handles to `https://instagram.com/<name>`, `https://tiktok.com/@<name>`,
  and `https://facebook.com/<name>`.
- SEO title ≤120, SEO description ≤200.

**Alternatives considered**: Accept arbitrary strings and let the browser fix
them. Rejected: the server must never persist malformed URLs or empty display
names that break the public site.

## Decision: tenant-scoped service + server action

**Rationale**: F005 requires every tenant-owned operation to be scoped by the
request context, and F007/F008 already prove the server-action + service pattern.
The action calls `requireAdminTenantContext('manage_settings')`; the service
writes only `actor.tenantId` inside `withTenantSession`. There is no settings id
or tenant id in the browser payload, eliminating an entire class of cross-tenant
targeting.

**Alternatives considered**: A REST CRUD route with a settings id. Rejected:
unnecessary surface area and an id the browser could tamper with.

## Decision: reuse the media provider for logo and hero

**Rationale**: F008 already provides content inspection, provider resolution,
bounded retries, deterministic asset ids, a development fake, and Cloudinary
signing. The settings upload route is a thin wrapper: authorize, validate
`kind`, inspect, upload with public id
`otoweb/showrooms/{tenantId}/settings/{kind}/{sha256}`, return the URL. The form
then saves that URL with the rest of the settings.

**Alternatives considered**: URL-only fields. Rejected: the roadmap explicitly
lists logo and hero image as editable media and the repository already has the
storage infrastructure. A second uploader implementation was rejected as
duplication.

## Decision: CSS-variable theming derived from tenant colors

**Rationale**: The incumbent public site hard-codes amber accent classes.
Replacing every accent with the tenant's raw color can fail contrast, especially
for light primaries. A pure helper derives:

- `--showroom-primary`: stored primary (filled surfaces, preview).
- `--showroom-accent`: the primary darkened until it reaches at least 4.5:1
  against white, for small text on light surfaces.
- `--showroom-primary-soft`: primary mixed toward white for dark hero eyebrow
  text.
- `--showroom-secondary`: stored secondary (footer / filled controls).
- `--showroom-on-primary`, `--showroom-on-secondary`: readable foreground.

The page root carries the variables; existing layout, spacing, cards, and
typography are unchanged. This satisfies "colors are editable" without
redesigning the incumbent surface.

**Alternatives considered**: Injecting a generated stylesheet or rewriting the
Tailwind theme. Rejected: runtime CSS variables are simpler, scoped per request,
and need no rebuild.

## Decision: tenant SEO metadata via `generateMetadata`

**Rationale**: The current root metadata is static Prima copy. F009 must prove
SEO fields take effect. A pure `showroomMetadata()` helper maps the Showroom view
model to `Metadata`; home, inventory, and detail routes call it. Root layout
metadata remains a fallback for non-public routes. F011 later adds canonical,
OpenGraph, sitemap, robots, and structured data.

**Alternatives considered**: Updating root layout metadata from the request
tenant. Rejected: root layout also renders admin/auth routes and would couple
global chrome to public tenant resolution.

## Decision: tenant-derived admin shell

**Rationale**: The admin shell and `PageHeader` hard-code "Prima Auto Gallery".
White-label means the operator should see the active showroom name. A React
context in `AdminShell` exposes the resolved settings display name and city;
`PageHeader` consumes it. The admin visual language stays neutral.

**Alternatives considered**: Passing the name to every page. Rejected: noisy and
easy to miss on future pages.

## Decision: verification strategy

- Unit/service tests on PGlite prove round-trip, defaults, validation, tenant
  isolation, and public mapping after an update.
- Media tests prove deterministic tenant-scoped asset ids, validation rejection,
  and fake-provider upload success.
- Theme tests prove contrast and fallbacks.
- E2E proves the admin save → public page loop in a real Next server.
- Visual QA captures desktop and mobile admin + public surfaces and asserts the
  seeded tenant colors differ, no overflow, and no cross-tenant leakage.
- The full configured checkpoint (`npx tsc --noEmit`, `npm test`) runs once
  before completion.

## Open questions

None. Requirements analysis found no ambiguity that requires an owner decision.
