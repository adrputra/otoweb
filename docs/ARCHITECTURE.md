# Architecture — OtoWeb

Audit date: 2026-10-18  
Phase: PHASE 1 — Repository Production Audit  
Source of target architecture: `docs/ROADMAP.md`

This document describes two architectures:

1. **Current (as-is)** — what the v0 repository actually does today.
2. **Target (to-be)** — the production architecture defined by the roadmap.

It also records the migration sequence and the decisions that must not be
silently changed.

---

## 1. Product and architectural constraints

From `docs/ROADMAP.md`:

- OtoWeb is a white-label, multi-tenant used-car showroom platform.
- One repository, one Next.js application, one production database, one
  deployment, many tenants.
- Prima Auto Gallery is the reference tenant, not a hard-coded product.
- The v0 visual design is approved. Preserve it; refactor only when required.
- No separate backend during MVP.
- Differences between showrooms must come from configuration, not forks.

Non-goals for the MVP:

- Separate repository or deployment per showroom.
- Showroom-specific branches or components.
- Custom HTML/JavaScript/CSS or a page builder.
- Payment, financing, WhatsApp Business API, AI chatbot, native apps, complex
  CRM, dealer accounting, marketplace aggregation.

---

## 2. Current architecture (as-is)

### 2.1 Runtime topology

```text
Browser
   │
   ▼
Next.js 16 App Router (single app)
   ├── Public server components
   │     /, /cars, /cars/[slug]
   ├── Admin server shells
   │     /admin, /admin/vehicles/new, /admin/vehicles/[id]/edit,
   │     /admin/settings
   ├── Admin client surfaces
   │     /admin/vehicles, /admin/leads, /admin/staff,
   │     /admin/settings/showroom
   └── Server actions
         lib/actions.ts
   │
   ▼
In-memory module arrays
   data/index.ts
```

There is no database, no external backend, no authentication layer, and no
tenant resolution. The deployment target is Vercel, but no Vercel project
configuration is committed.

### 2.2 Rendering strategy

| Route | Strategy | Reason |
|---|---|---|
| `/` | Static at build | Mock data, no request dependency |
| `/cars` | Dynamic server render | Reads `searchParams` |
| `/cars/[slug]` | Dynamic server render | Reads route params |
| `/admin` | Static at build | Mock data, no request dependency |
| `/admin/vehicles` | Client render | Local state, search/filter/actions |
| `/admin/vehicles/new` | Static shell | Client form |
| `/admin/vehicles/[id]/edit` | Dynamic server render | Reads route params + mock array |
| `/admin/leads` | Client render | Local state, status changes |
| `/admin/staff` | Client render | Local state, modal |
| `/admin/settings` | Static server render | Static links/placeholders |
| `/admin/settings/showroom` | Client render | Local form state |

### 2.3 Layers as they exist

```text
Presentation
  app/**/page.tsx
  components/*.tsx
        │
        ├── Server components call lib/repositories.ts
        └── Client components import data/index.ts and lib/actions.ts
        │
Domain / formatting
  lib/format.ts
  lib/types.ts
        │
Data access
  lib/repositories.ts  (read)
  lib/actions.ts       (write, server actions)
        │
Mock store
  data/index.ts
  data/car-catalog.ts
```

The intended separation (presentation / domain / data access / authorization)
is only partial. Client admin pages bypass repositories, and actions mutate the
same arrays that repositories read.

### 2.4 Public data flow

```text
app/page.tsx
  getShowroom() ──────────────┐
  listVehicles() ─────────────┤
                              ▼
app/cars/page.tsx          data/index.ts
  listVehicles(filters) ──────┘

app/cars/[slug]/page.tsx
  getVehicleBySlug(slug)
  getShowroom()
  getRelatedVehicles(id)
```

Filtering and sorting happen in memory inside `listVehicles`. Query parameters
are read from `searchParams` and cast to `VehicleFilters`. There is no
pagination, no database query, and no tenant scope.

### 2.5 Admin data flow

```text
Client page state (React)
  app/admin/vehicles/page.tsx
  app/admin/leads/page.tsx
  app/admin/staff/page.tsx
  app/admin/settings/showroom/page.tsx
        │
        ├── imports mock arrays
        └── calls server actions
                │
                ▼
        lib/actions.ts
          updateVehicle / duplicateVehicle / deleteVehicle
          updateLead / inviteStaff
                │
                ▼
        module-level arrays in data/index.ts
```

There are two sources of truth at once:

1. The client’s local React state, updated immediately.
2. The server process’s module arrays, updated by the action.

They can diverge. Reloading resets the client to the original mock arrays.
Serverless invocations may not share module state. Nothing calls
`revalidatePath` or `revalidateTag`.

### 2.6 Authentication and authorization

None.

- No middleware.
- No session.
- No login/logout.
- No route protection.
- No role checks.
- No tenant membership.
- Admin routes return `200` to any visitor.
- Server actions accept arbitrary IDs and patches.

### 2.7 Tenant model

None. The application is effectively a single-tenant demo:

- `data/index.ts` exports one `showroom`.
- No model contains `tenant_id`.
- No hostname parsing exists.
- Branding and identity strings are hard-coded across UI modules.
- There is no `tenant_domains`, `tenant_members`, or `showroom_settings`
  persistence.

### 2.8 Media

```text
Vehicle form
  <input type="file" multiple>
        │
        ▼
  URL.createObjectURL(file)
        │
        ▼
  local React state
  simulated setTimeout progress
        │
        ▼
  lost on reload; never uploaded
```

Public images are Unsplash URLs rendered through `next/image`, but
`images.unoptimized: true` disables the Next.js optimizer. The detail page
renders only the first image.

### 2.9 SEO

- A single hard-coded root `metadata` object.
- No per-route metadata.
- No canonical, OpenGraph, Twitter, robots, sitemap, or JSON-LD.
- No tenant-aware metadata.
- Draft/archived vehicle pages are accessible because
  `getVehicleBySlug` does not filter publication.

### 2.10 Error handling and observability

- Some loading/empty states exist (`/cars/loading.tsx`, listing empty state).
- No route-level `error.tsx` or `global-error.tsx`.
- No action-level error handling.
- No permission errors.
- Toasts are called but no `<Toaster />` is mounted.
- Vercel Analytics is mounted in production only.
- No error reporting, structured logging, or audit log.

### 2.11 Configuration and build

- `next.config.mjs` sets two security headers, disables TypeScript build
  validation, and disables image optimization.
- No `.env.example`, no environment validation, no PostgreSQL/Drizzle/object storage
  configuration.
- No lint, format, typecheck script, unit test, E2E test, or CI.
- `package.json` scripts: `dev`, `build`, `start`.
- The project builds and standalone `tsc` passes, but `npm test` fails because
  the script does not exist.

### 2.12 Current architectural risks

| Risk | Consequence |
|---|---|
| Mock store as source of truth | No durable data; serverless behavior undefined |
| No auth/authorization | Complete admin exposure |
| No tenant scope | Cannot safely onboard a second showroom |
| Client imports mock data | Bundle bloat; layer bypass |
| Broad `'use client'` module | Unnecessary JS on public pages |
| No schema validation at the boundary | Invalid data, security exposure |
| No DB migrations | No repeatable production setup |
| No tests/CI | Refactoring is unguarded |
| Hard-coded branding | White-label promise is not met |

---

## 3. Target production architecture (to-be)

### 3.1 Topology

```text
Browser
   │
   ▼
Next.js 16 on Vercel
   ├── Public showroom (server components)
   ├── Admin portal (server + client islands)
   ├── Platform administration (/platform)
   ├── Server Actions / Route Handlers
   ├── Tenant resolution (centralized)
   ├── Authorization + permission helpers
   ├── Media service (Cloudflare R2 / Cloudinary)
   └── Analytics / logging
   │
   ▼
PostgreSQL
   ├── Domain tables
   ├── Local auth (profiles, auth_sessions)
   ├── Row Level Security
   └── Media metadata (R2 / Cloudinary for assets)
   │
   ▼
Drizzle ORM
   ├── schema/
   ├── migrations/
   └── queries/
```

### 3.2 Stack decisions

| Concern | Decision | Status |
|---|---|---|
| Application | One full-stack Next.js App Router app | Current |
| Language | TypeScript strict | Current |
| Styling | Tailwind 4 + approved v0 design | Current |
| Database | PostgreSQL | Current |
| ORM | Drizzle ORM | Target |
| Auth | Local PostgreSQL sessions | Current |
| Authorization | Application permissions + PostgreSQL RLS | Target |
| Media | Cloudflare R2 (Cloudinary optional) | Current |
| Deployment | Vercel | Target |
| Analytics | Vercel Analytics + product events | Target |
| Error reporting | Vercel logs first; Sentry optional | Target |
| Testing | Vitest + Testing Library + Playwright | Target |
| CI | GitHub Actions | Target |

### 3.3 Multi-tenant model

Core tables and ownership:

```text
tenants
  id (uuid), name, slug, status, plan, theme, timestamps

tenant_domains
  id, tenant_id, hostname, type, status, verified_at, created_at
  type: platform_subdomain | custom_domain

profiles
  id (auth user id), full_name, avatar_url, timestamps

tenant_members
  id, tenant_id, user_id, role, status, timestamps
  unique (tenant_id, user_id)
  role: platform_admin | owner | staff

showroom_settings
  id, tenant_id, display_name, tagline, description, logo_url,
  favicon_url, hero_image_url, primary_color, secondary_color,
  phone, whatsapp, email, address, city, province, postal_code,
  google_maps_url, instagram_url, tiktok_url, facebook_url,
  opening_hours, seo_title, seo_description, timestamps

vehicles
  id, tenant_id, slug, brand, model, variant, year, transmission,
  fuel_type, body_type, engine_capacity, mileage, color, price,
  original_price, plate_region, tax_expiry_date, description,
  status, featured, location, timestamps, published_at,
  reserved_at, sold_at

vehicle_images
  id, tenant_id, vehicle_id, provider, provider_asset_id, url,
  position, is_cover, width, height, created_at

leads
  id, tenant_id, vehicle_id, name, phone, email, message,
  source, status, timestamps
```

Rules:

- UUID identifiers.
- Every tenant-owned table carries `tenant_id`.
- Vehicle `status` is one shared enum:
  `draft | available | reserved | sold | archived`.
- Vehicle features are `JSONB` during MVP.
- Lead status is `new | contacted | qualified | won | lost`.
- Lead source is `contact_form | whatsapp | phone | manual`.
- Roles are `platform_admin | owner | staff`.

### 3.4 Tenant resolution

Centralized module, suggested:

```text
lib/tenant/
  resolve-tenant.ts
  tenant-context.ts
  tenant-domain.ts
```

Flow:

```text
request hostname
   ↓
tenant_domains lookup
   ↓
tenant
   ↓
showroom_settings
   ↓
theme + branding
   ↓
tenant-scoped inventory
```

Rules:

- Never parse hostnames in page components.
- Never trust a client-provided tenant ID.
- Resolve the tenant on the server for every request.
- Development must support a documented tenant-testing strategy
  (`prima.localhost`, `tenant-b.localhost`, or equivalent).
- Custom domains come after wildcard subdomains are stable.

### 3.5 Authorization model

| Role | Capabilities |
|---|---|
| `platform_admin` | Manage tenants, inspect status, assign owners, platform config |
| `owner` | Manage vehicles, showroom, staff, leads, settings for own tenant |
| `staff` | Manage vehicles, view leads for own tenant |

Requirements:

- Enforced server-side on every action and query.
- Hiding a button is not authorization.
- RLS protects tenant data at the database layer.
- Service-role credentials never reach the browser.
- Platform administration uses explicit privileged server-side operations.

### 3.6 Data access architecture

Target separation:

```text
db/
  schema/          Drizzle table definitions and enums
  migrations/      Generated SQL migrations
  queries/         Tenant-scoped read/write functions

lib/
  auth/            Session and user helpers
  tenant/          Resolution and context
  permissions/     Role/capability checks
  validation/      Shared Zod schemas
  media/           R2 / Cloudinary provider boundary
  seo/             Metadata, sitemap, structured data helpers

features/
  vehicles/        UI + domain services for vehicles
  showroom/        UI + domain services for showroom settings
  leads/           UI + domain services for leads
```

Rules:

- UI components do not query the database directly.
- Repositories/queries accept an explicit tenant context.
- Mutations validate with shared Zod schemas server-side.
- Server actions re-check authorization; they do not trust the client.
- Presentation, domain logic, data access, and authorization remain separable.

### 3.7 Public site data flow (target)

```text
Request
  ↓
Tenant resolution
  ↓
Tenant context
  ↓
Queries with tenant scope
  ↓
Server components render approved theme
  ↓
Public inventory exposes available/reserved (sold only if configured)
  ↓
Draft and archived never appear
```

Vehicle detail behavior:

- Sold pages remain accessible and show “Terjual” with related available
  vehicles (SEO preservation).
- Draft and archived pages must not be publicly accessible.
- WhatsApp CTA includes a tracked click and the vehicle URL.

### 3.8 Admin data flow (target)

```text
Authenticated request
  ↓
Session + membership check
  ↓
Tenant context
  ↓
Role/capability check
  ↓
Zod-validated server action
  ↓
Drizzle transaction/query with tenant_id
  ↓
Audit event (where required)
  ↓
Revalidate affected public/admin routes
  ↓
Return typed result to client
```

Vehicle lifecycle:

```text
draft → available → reserved → sold
                         ↓
                      archived
```

Archive is preferred over hard delete when records must be preserved.

### 3.9 Media architecture (target)

```text
Browser file selection
  ↓
Client-side pre-validation (type, size, count)
  ↓
R2 / Cloudinary upload (signed)
  ↓
Provider asset metadata
  ↓
vehicle_images rows (tenant_id, vehicle_id, position, is_cover)
  ↓
Optimized delivery URLs for cards/detail/gallery
```

Requirements:

- Multiple upload, progress, retry, reordering, cover, deletion.
- Server-side validation; never trust browser validation alone.
- Configurable maximum images (initial recommendation: 20).
- Optimized sizes for listing cards; never original files.
- Media policy when a vehicle is archived/deleted.

### 3.10 SEO architecture (target)

- Dynamic metadata per tenant and per vehicle.
- Canonical URLs.
- OpenGraph/Twitter.
- `robots.txt` and tenant-specific `sitemap.xml`.
- JSON-LD: `Vehicle`, `Product`, `Offer`, `LocalBusiness`.
- Sold listing policy preserving acquired URLs.
- Metadata derived from `showroom_settings` and vehicle data.
- Verify generated HTML, not only client-rendered metadata.

### 3.11 Theme architecture

- The current approved v0 design becomes `theme: premium`.
- Future themes live under `themes/premium`, `themes/modern`, `themes/minimal`.
- All themes consume the same normalized data contract.
- No business logic forks per theme.
- No page builder or arbitrary tenant CSS/JS.

### 3.12 Testing, CI, and observability (target)

Testing:

- Vitest for unit/domain logic.
- Testing Library for components.
- Playwright for public and admin E2E.
- Mandatory tenant-isolation tests with `prima` and `tenant-b` fixtures.

Required scripts:

```text
dev
build
start
lint
typecheck
test
test:e2e
```

CI on every pull request:

```text
install → lint → typecheck → unit tests → build
```

Critical E2E may run on preview or controlled test environments.

Observability:

- Vercel logs.
- Vercel Analytics.
- Application error reporting.
- Optional Sentry if required.
- No custom monitoring infrastructure.

Performance targets:

- Lighthouse Performance ≥ 90.
- Accessibility ≥ 90.
- Best Practices ≥ 90.
- SEO ≥ 95.
- Optimized images, fonts, bundle size, mobile performance, server rendering.

---

## 4. Target folder shape

This is directional, not a mandate to rename everything at once:

```text
app/
  (public)/...                 public routes
  (admin)/admin/...            authenticated tenant admin
  (platform)/platform/...      platform administration
  api/...                      route handlers where needed
components/
  ui/                          shared primitives
  vehicles/                    vehicle presentation
  showroom/                    showroom presentation
  admin/                       admin chrome
db/
  schema/
  migrations/
  queries/
features/
  vehicles/
  showroom/
  leads/
lib/
  auth/
  tenant/
  permissions/
  validation/
  media/
  seo/
data/
  seeds/                       development seeds only; no runtime mock imports
tests/
  unit/
  integration/
  e2e/
docs/
  adr/                         decision records
```

Existing names may remain where they are clear. The important requirement is
separation of presentation, domain logic, data access, and authorization.

---

## 5. Migration sequence

The roadmap phases are dependency-ordered. Do not skip ahead.

| Order | Phase | Why it must happen here |
|---|---|---|
| 1 | PHASE 1 — Repository audit | Establish truth before changing architecture |
| 2 | PHASE 2 — Engineering foundation | Lint, typecheck, tests, CI, env validation before backend work |
| 3 | PHASE 3 — Database foundation | Schema, migrations, seeds; no runtime DB reads yet |
| 4 | PHASE 4 — Authentication | Sessions and protected admin routes |
| 5 | PHASE 5 — Multi-tenant security | Memberships, tenant context, RLS, isolation tests |
| 6 | PHASE 6 — Public website DB | Replace public mock reads with tenant-scoped queries |
| 7 | PHASE 7 — Admin vehicle CRUD | Real create/edit/lifecycle actions |
| 8 | PHASE 8 — Image management | R2/Cloudinary, ordering, cover, validation |
| 9 | PHASE 9 — Showroom settings | Tenant-scoped configuration and public reflection |
| 10 | PHASE 10 — Lead capture | Contact form, WhatsApp tracking, lead pipeline |
| 11 | PHASE 11 — SEO productionization | Metadata, sitemap, structured data |
| 12 | PHASE 12 — Platform administration | Tenant management surface |
| 13 | PHASE 13 — Subdomain routing | Wildcard tenant routing |
| 14 | PHASE 14 — Custom domains | Only after subdomains are stable |
| 15 | PHASE 15 — Analytics | Product events and metrics |
| 16 | PHASE 16 — Production hardening | Security, RLS, accessibility, performance, failure-state audits |

The first commercial MVP boundary includes Phases 1–9, 11, and 13. Lead
management may follow immediately after the pilot.

---

## 6. Key decisions to preserve

These decisions come from the roadmap and should not be re-litigated without
an explicit owner decision:

1. One full-stack Next.js application.
2. PostgreSQL as the backend platform.
3. Drizzle ORM for schema, migrations, and typed queries.
4. Local PostgreSQL-backed authentication for authentication.
5. Application permissions plus PostgreSQL RLS for authorization.
6. Cloudflare R2 for media (Cloudinary remains an alternative).
7. Vercel for deployment.
8. Multi-tenant from the start; no per-showroom forks.
9. Approved v0 design is the baseline; no redesign.
10. No page builder, arbitrary tenant CSS/JS, or theme forks of business logic.
11. No advanced CRM, payments, financing, WhatsApp Business API, or AI features
    during the initial MVP.

When a decision changes, record it as an ADR in `docs/adr/` rather than silently
changing the architecture.

---

## 7. Architecture acceptance criteria for later phases

A production architecture review should be able to verify:

- [ ] Every tenant-owned table has `tenant_id` and RLS coverage.
- [ ] Tenant resolution is centralized and server-side.
- [ ] Every admin route and action enforces authentication and authorization.
- [ ] Public queries never expose draft or archived vehicles.
- [ ] Server actions validate input with shared Zod schemas.
- [ ] Data access is separated from presentation.
- [ ] Media uploads are durable, validated, and tenant-scoped.
- [ ] Showroom settings changes appear publicly without a deployment.
- [ ] SEO metadata, canonical, sitemap, robots, and JSON-LD are generated from
      tenant-scoped data.
- [ ] Tenant isolation tests prove A cannot read/write B.
- [ ] Lint, typecheck, unit tests, E2E, and build pass in CI.
- [ ] The approved v0 visual design is preserved.
