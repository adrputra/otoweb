# Current State — OtoWeb / Prima Auto Gallery

Audit date: 2026-10-18  
Repository: `adrputra/otoweb`  
Baseline commit: `4a4e744` (`main`)  
Phase: PHASE 1 — Repository Production Audit  
Source of intent: `docs/ROADMAP.md`

This document is an inventory of the repository as it exists today. It records
what is implemented, what is mock-only, and what is missing. It does not
propose a redesign and it does not implement Phase 2.

---

## 1. Executive snapshot

OtoWeb is currently a single-tenant, frontend-first Next.js prototype for
**Prima Auto Gallery**. It has a visually complete public showroom and a
responsive admin surface, but almost all data is in-memory and all admin
mutations are non-durable.

| Area | Current reality |
|---|---|
| Framework | Next.js 16.4.0 App Router, React 19.2 |
| Language | TypeScript 5.7, `strict: true` |
| Styling | Tailwind CSS 4, shadcn-style tokens, Base UI button primitive |
| Forms | React Hook Form 7 + Zod 4 (vehicle form only) |
| Drag/drop | dnd-kit, vehicle photo ordering only |
| Data | In-memory arrays in `data/index.ts` |
| Persistence | None |
| Auth | None |
| Tenancy | None; one hard-coded showroom |
| Media | Fake client-side upload using object URLs |
| Database | None (no Supabase, no Drizzle, no PostgreSQL) |
| Tests | None |
| Lint | None configured |
| CI | None |
| Deployment config | Vercel Analytics only; no Vercel project config |

The application builds successfully. The main production risks are the absence
of persistence, authentication, tenant isolation, and automated validation, not
the visual layer.

---

## 2. Repository map

```text
app/
  layout.tsx                       root layout, fonts, metadata, Analytics
  page.tsx                         public homepage
  globals.css                      Tailwind 4 + theme tokens
  cars/
    page.tsx                       public inventory listing
    loading.tsx                    listing skeleton
    [slug]/
      page.tsx                     public vehicle detail
      not-found.tsx                vehicle 404
  admin/
    layout.tsx                     wraps AdminShell
    page.tsx                       admin dashboard
    vehicles/
      page.tsx                     inventory table/cards (client)
      new/page.tsx                 create form shell
      [id]/edit/page.tsx           edit form shell
    leads/page.tsx                 lead list (client)
    staff/page.tsx                 staff list + invite modal (client)
    settings/
      page.tsx                     settings landing
      showroom/page.tsx            showroom profile form (client)

components/
  admin-shell.tsx                  admin chrome, PageHeader, AddButton
  showroom.tsx                     public Header, VehicleCard, QuickSearch, Filters
  vehicle-form.tsx                 create/edit vehicle form + photo manager
  ui/button.tsx                    shadcn/Base UI button primitive (unused)

data/
  index.ts                         mock showroom, vehicles, leads, staff
  car-catalog.ts                   brand/model catalog + common features

lib/
  types.ts                         domain interfaces
  repositories.ts                  read functions over mock arrays
  actions.ts                       server-action mutation stubs over mock arrays
  format.ts                        Rupiah, km, date, WhatsApp helpers
  utils.ts                         `cn()` class merge helper

docs/
  ROADMAP.md                       production roadmap
  INTEGRATION.md                   backend integration checklist
  as-built/                        v0 as-built notes
  CURRENT_STATE.md                 this document
  ARCHITECTURE.md                  current + target architecture
  IMPLEMENTATION_STATUS.md         roadmap capability status map

public/                            icons and placeholder images
scripts/loop.sh                    roadmap driver helper (tooling, not app)
```

---

## 3. Routes

### 3.1 Public routes

| Route | File | Rendering | Data source | Current behavior |
|---|---|---|---|---|
| `/` | `app/page.tsx` | Static server component | `getShowroom()`, `listVehicles()` | Hero, featured vehicles, about, contact, WhatsApp footer |
| `/cars` | `app/cars/page.tsx` | Dynamic server component | `listVehicles(searchParams)` | Inventory grid, native GET filter form, empty state |
| `/cars/[slug]` | `app/cars/[slug]/page.tsx` | Dynamic server component | `getVehicleBySlug`, `getShowroom`, `getRelatedVehicles` | Detail page, specs, features, related vehicles, WhatsApp CTA |
| `/cars/[slug]` 404 | `app/cars/[slug]/not-found.tsx` | Static | — | Vehicle-not-found page |

Notes:

- `/` is statically rendered at build time from mock data.
- `/cars` and `/cars/[slug]` are dynamic.
- There is no public contact page. `#contact` is an anchor on `/`.
- There is no share implementation. The “Bagikan unit” button has no handler.
- The detail page renders only `images[0]`; there is no gallery.

### 3.2 Admin routes

| Route | File | Rendering | Data source | Current behavior |
|---|---|---|---|---|
| `/admin` | `app/admin/page.tsx` | Static server component | `listVehicles({})`, `listLeads()` | Counts and recent lists |
| `/admin/vehicles` | `app/admin/vehicles/page.tsx` | Client component | `vehicles` mock array | Table/cards, search, status filters, in-memory actions |
| `/admin/vehicles/new` | `app/admin/vehicles/new/page.tsx` | Server shell | None | Renders `VehicleForm`; create is not implemented |
| `/admin/vehicles/[id]/edit` | `app/admin/vehicles/[id]/edit/page.tsx` | Dynamic server component | `vehicles` mock array | Renders `VehicleForm` with a vehicle; update is in-memory only |
| `/admin/leads` | `app/admin/leads/page.tsx` | Client component | `leads`, `vehicles` mock arrays | Lead list, status select, WhatsApp reply link |
| `/admin/staff` | `app/admin/staff/page.tsx` | Client component | `staff` mock array | Staff list, invite modal, in-memory invite |
| `/admin/settings` | `app/admin/settings/page.tsx` | Server component | None | Settings landing; Domain/Account are disabled placeholders |
| `/admin/settings/showroom` | `app/admin/settings/showroom/page.tsx` | Client component | `showroom` mock object | Profile form, dirty-state warning, local preview, no-op save |

### 3.3 Broken or missing navigation

| Item | Evidence | Impact |
|---|---|---|
| `/admin/showroom` | Referenced in `components/admin-shell.tsx` nav; no route file exists; runtime returns 404 | Desktop sidebar and mobile bottom nav contain a dead link |
| Create vehicle entry point | `AddButton` in `app/admin/vehicles/page.tsx` is a `<span>`, not a link or button | `/admin/vehicles/new` is unreachable from the UI |
| Edit vehicle entry point | No link to `/admin/vehicles/[id]/edit` anywhere in the admin inventory UI | Edit route is only reachable by typing the URL |
| Settings Domain tab | `app/admin/settings/page.tsx` renders disabled `#` placeholder | Domain management not implemented |
| Settings Account tab | `app/admin/settings/page.tsx` renders disabled `#` placeholder | Account management not implemented |

The build manifest confirms the actual route surface: `/`, `/_not-found`,
`/admin`, `/admin/leads`, `/admin/settings`, `/admin/settings/showroom`,
`/admin/staff`, `/admin/vehicles`, `/admin/vehicles/[id]/edit`,
`/admin/vehicles/new`, `/cars`, and `/cars/[slug]`. There is no
`/admin/showroom` route.

---

## 4. Components

### 4.1 Reusable components that exist

| Component | File | Used by | Notes |
|---|---|---|---|
| `AdminShell` | `components/admin-shell.tsx` | `app/admin/layout.tsx` | Sidebar, mobile drawer, bottom nav, header |
| `PageHeader` | `components/admin-shell.tsx` | Admin pages | Hard-coded “Prima Auto Gallery” eyebrow |
| `AddButton` | `components/admin-shell.tsx` | Vehicles, Staff | Visual span; not interactive on its own |
| `Header` | `components/showroom.tsx` | Homepage | Client component because of mobile menu state |
| `VehicleCard` | `components/showroom.tsx` | Home, listing, related | Assumes `images[0]` exists |
| `QuickSearch` | `components/showroom.tsx` | Homepage | Native GET form; hard-coded brand options |
| `Filters` | `components/showroom.tsx` | Listing | Native GET form; limited fields |
| `VehicleForm` | `components/vehicle-form.tsx` | New/edit vehicle pages | RHF + Zod, photo manager, mobile stepper, live preview |
| `Button` | `components/ui/button.tsx` | Nothing | Unused shadcn/Base UI primitive |

### 4.2 Components that are inline, not extracted

- `Row`, `MobileRow`, `Status`, `Actions` in `app/admin/vehicles/page.tsx`.
- `Field`, `Section`, `PhotoItem` in `components/vehicle-form.tsx`.
- `Field`, `Section` in `app/admin/settings/showroom/page.tsx`.
- `tabs` and `nav` arrays are defined inside component modules.
- Status labels and badge colors are repeated in the inventory, vehicle card,
  dashboard, and detail page.

### 4.3 Duplication and overlapping responsibility

| Duplicate | Locations | Consequence |
|---|---|---|
| Vehicle status labels | `app/admin/vehicles/page.tsx` (`statusLabel`), `components/showroom.tsx` (`VehicleCard` badge), `app/cars/[slug]/page.tsx` (inline ternary), `app/admin/page.tsx` (raw `availability`) | Adding/changing a status requires edits in multiple places |
| Currency formatting | `lib/format.ts` (`formatRupiah`) and `components/vehicle-form.tsx` (`money`) | Two formatting paths; form uses a different function |
| `Field`/`Section` form primitives | `components/vehicle-form.tsx` and `app/admin/settings/showroom/page.tsx` | Two small design systems inside forms |
| Brand lists | `data/car-catalog.ts`, `components/showroom.tsx` (`QuickSearch`, `Filters`) | Catalog and filters can drift; Hyundai missing from filters |
| Form section wrappers | Vehicle form and showroom settings both define local `Section` | Inconsistent form layout behavior |
| Showroom branding | `app/layout.tsx`, `app/cars/page.tsx`, `components/admin-shell.tsx`, `components/vehicle-form.tsx`, mock data | Single-tenant strings spread across UI |

---

## 5. Data models and mock data

### 5.1 Current TypeScript models (`lib/types.ts`)

| Type | Fields | Notes |
|---|---|---|
| `Availability` | `available \| reserved \| sold` | Public availability |
| `Publication` | `draft \| published \| archived` | Publication state |
| `Vehicle` | `id`, `slug`, `brand`, `model`, `variant`, `year`, `bodyType`, `transmission`, `fuel`, `mileageKm`, `color`, `engineCc`, `price`, `originalPrice?`, `taxExpiry`, `plateRegion`, `ownerCount`, `documents`, `features`, `description`, `images`, `availability`, `publication`, `featured`, `location`, `createdAt`, `updatedAt` | No `tenantId`; no single production `status`; no `publishedAt`/`reservedAt`/`soldAt` |
| `Showroom` | `id`, `slug`, `name`, `tagline`, `description`, `logoUrl`, `heroImageUrl`, `colors`, `contact`, `address`, `social`, `seo`, `hero` | No tenant ID; no province/postal code; no favicon; no domain |
| `Lead` | `id`, `name`, `phone`, `vehicleId?`, `source`, `message`, `status`, `createdAt` | Status is `new \| contacted \| closed`; roadmap uses `new \| contacted \| qualified \| won \| lost` |
| `StaffMember` | `id`, `name`, `email`, `role`, `active` | Roles `owner \| admin \| sales`; roadmap uses `platform_admin \| owner \| staff` |
| `VehicleFilters` | `brand?`, `model?`, `minPrice?`, `maxPrice?`, `year?`, `transmission?`, `fuel?`, `maxMileage?`, `sort?` | No `status`; query values arrive as strings but are typed as numbers |

There are no types for `Tenant`, `TenantDomain`, `Profile`, `TenantMember`,
`ShowroomSettings`, `VehicleImage`, `LeadEvent`, or audit records.

### 5.2 Mock data locations

| File | Exports | Contents |
|---|---|---|
| `data/index.ts` | `showroom`, `vehicles`, `leads`, `staff` | One showroom; 12 vehicles; 6 leads; 4 staff |
| `data/car-catalog.ts` | `carCatalog`, `brands`, `commonFeatures` | 5 brands, model lists, 8 common features |

Mock details:

- Vehicle IDs are `car-1` through `car-12`; not UUIDs.
- Vehicle slugs are generated from brand/model/year/index.
- All 12 vehicles use `bodyType: 'SUV'`, `engineCc: 1500`, the same
  `taxExpiry`, the same `plateRegion`, the same feature list, and one image.
- One vehicle (`i === 9`, id `car-10`) is `publication: 'draft'`.
- One vehicle (`i === 10`, id `car-11`) is `availability: 'sold'` and published.
- Two vehicles are `reserved` (`i === 2`, `i === 8`).
- Four vehicles are `featured` (`i < 4`).
- Leads reference vehicles by `vehicleId`.
- Images use Unsplash IDs, not stored media.
- No tenant B, no domains, no settings history, no audit events.

### 5.3 Data flow

```text
Server components
  app/page.tsx, app/cars/page.tsx, app/cars/[slug]/page.tsx, app/admin/page.tsx
        ↓
lib/repositories.ts
        ↓
data/index.ts (module-level arrays)

Client admin pages
  app/admin/vehicles/page.tsx, app/admin/leads/page.tsx, app/admin/staff/page.tsx
        ↓ imports mock arrays directly, bypassing repositories
data/index.ts

Client mutations
  VehicleForm, admin inventory actions, lead status, staff invite, settings save
        ↓
lib/actions.ts ('use server')
        ↓
mutates the same module-level arrays
```

There is no database, no request-scoped store, and no revalidation. The
server actions mutate module state in the server process; client components
also update local React state. Reloading the page loses mutations. In a
serverless deployment, mutations may not be visible across requests at all.

---

## 6. Forms and validation

| Form | File | Technology | Validation | Persistence |
|---|---|---|---|---|
| Vehicle create/edit | `components/vehicle-form.tsx` | React Hook Form + Zod + `zodResolver` | Zod schema: brand, model, variant, year (1980–2030), price, description (min 10), tax expiry, publication, featured, mileage, transmission, fuel, color, body type | Edit mutates mock array; create has no action |
| Showroom profile | `app/admin/settings/showroom/page.tsx` | Controlled React state | None; only a local contrast warning | Save only sets a local “saved” flag; no mutation |
| Staff invite | `app/admin/staff/page.tsx` | Native form state | HTML `required` + `type="email"` only | Adds to local state and mock array |
| Lead status | `app/admin/leads/page.tsx` | Native select | Type assertion only | Updates local state and mock array |
| Inventory search/filter | `app/cars/page.tsx` + `components/showroom.tsx` | Native GET form | None; values are coerced in repository | Read-only mock filtering |
| Quick search | `components/showroom.tsx` | Native GET form | None | Read-only mock filtering |

Vehicle form gaps:

- No server-side validation or shared schema module.
- No Zod validation for images, features, availability, original price, engine
  capacity, plate region, owner count, documents, location, or SEO.
- Required photos are not enforced, yet the detail page assumes `images[0]`.
- Submit has no `try/catch`, no error state, and no pending/disabled feedback
  beyond `isSubmitting`.
- `toast()` is called, but no `<Toaster />` is mounted anywhere. Success and
  error messages are therefore not visible.
- `setValue` is imported but unused.
- New-vehicle submit does nothing; `submit()` calls `updateVehicle` only when
  `vehicle` is present.
- On a new vehicle, “Simpan draft” and “Publikasikan” both only reset the form
  and show a toast.

Showroom settings gaps:

- No Zod schema or RHF.
- Save handler only calls `setSaved(true)`.
- Hero headline, subheadline, and CTA label are rendered in the preview but are
  not editable.
- `logoUrl` is editable but unused on the public site.
- No favicon field in the model.
- No province, postal code, or domain field.
- No upload; logo and hero are URL strings.
- The “Batal” button resets to the module-level `initial` clone, not to the
  last saved value.

---

## 7. Drag/drop and media UI

Implemented in `components/vehicle-form.tsx`:

- dnd-kit `DndContext`, `SortableContext`, `useSortable`, `arrayMove`.
- Drag handle, move-up/move-down buttons, cover selection, delete, add-more tile.
- Maximum 20 images enforced on the client.
- Simulated progress bars driven by `setTimeout`.
- Cover selection via `isCover` state.
- Image preview using `URL.createObjectURL`.
- Mobile-friendly 2/4-column photo grid.

Not implemented:

- Real upload to any storage provider.
- Cloudinary integration.
- File type validation beyond `accept="image/*"`.
- File size validation.
- Server-side validation.
- Upload retry.
- Durable ordering or cover state.
- Responsive image delivery.
- Gallery on the public detail page (only `images[0]` is rendered).
- Showroom logo/hero upload.
- Media deletion policy when a vehicle is deleted.

`@dnd-kit/utilities` is installed but unused in application code.

---

## 8. Server/client boundaries

### Server components

- `app/layout.tsx`
- `app/page.tsx`
- `app/cars/page.tsx`
- `app/cars/[slug]/page.tsx`
- `app/admin/layout.tsx` (wraps the client shell)
- `app/admin/page.tsx`
- `app/admin/vehicles/new/page.tsx`
- `app/admin/vehicles/[id]/edit/page.tsx`
- `app/admin/settings/page.tsx`

### Client components

- `components/admin-shell.tsx`
- `components/showroom.tsx` (entire module: `Header`, `VehicleCard`,
  `QuickSearch`, `Filters`)
- `components/vehicle-form.tsx`
- `app/admin/vehicles/page.tsx`
- `app/admin/leads/page.tsx`
- `app/admin/staff/page.tsx`
- `app/admin/settings/showroom/page.tsx`

### Boundary problems

- `VehicleCard`, `Filters`, and `QuickSearch` do not need client state, but
  they live in a `'use client'` module and are shipped to the browser.
- Client admin pages import `data/index.ts` directly, so mock data is bundled
  into the client and bypasses `lib/repositories.ts`.
- `lib/repositories.ts` is not marked `server-only`, so accidental client
  imports are possible.
- `lib/actions.ts` mutates module-level arrays. This is not a valid persistence
  model for serverless deployment.
- `data/index.ts` is imported by both server and client code, blurring the data
  boundary.
- `toast()` is used without a mounted `Toaster`, so the feedback boundary is
  incomplete.
- `app/layout.tsx` renders Vercel Analytics only in production; there is no
  other observability.

---

## 9. Hard-coded tenant/showroom assumptions

| Assumption | Location |
|---|---|
| One showroom: Prima Auto Gallery | `data/index.ts`, `app/layout.tsx`, `app/cars/page.tsx`, `components/admin-shell.tsx`, `components/vehicle-form.tsx`, `app/admin/settings/showroom/page.tsx` |
| Showroom ID/slug `prima` / `prima-auto-gallery` | `data/index.ts` |
| Jakarta Selatan / TB Simatupang address | `data/index.ts`, admin sidebar |
| `primaauto.id` domain | Settings preview, staff email placeholder |
| `Aditya Pranata` / `AP` admin identity | `components/admin-shell.tsx` |
| Phone/WhatsApp/email | `data/index.ts` |
| Hero image / about image | `data/index.ts`, `app/page.tsx` |
| Brand list in filters/search | `components/showroom.tsx` |
| “Prima Auto Gallery” WhatsApp reply | `app/admin/leads/page.tsx` |
| Metadata title/description | `app/layout.tsx` |
| Admin page eyebrow | `components/admin-shell.tsx` |
| Vehicle form eyebrow | `components/vehicle-form.tsx` |

There is no `tenant_id` in any model, query, form, or action.

---

## 10. Dead, incomplete, and unsafe UI

| Item | Status | Evidence |
|---|---|---|
| `/admin/showroom` nav | Broken | Nav link exists; route returns 404 |
| “Tambah kendaraan” | Dead | `AddButton` is a span; no navigation |
| Create vehicle | Incomplete | Form exists; no create action |
| Showroom save | Fake | Save only sets local state |
| Domain/Account settings | Placeholder | Disabled “Segera hadir” tabs |
| Share vehicle | Dead | Button has no handler |
| Toast feedback | Dead | No `<Toaster />` mounted |
| Draft vehicle privacy | Unsafe | `/cars/toyota-raize-2022-10` returns 200 |
| Vehicle detail gallery | Missing | Only `images[0]` |
| Logo/hero editing | Partial | URL inputs; logo unused publicly |
| Social links | Unused | Model exists; not rendered |
| Contact email | Unused | Model exists; not rendered |
| Hero CTA label | Unused | Model exists; not rendered |
| Map | Placeholder | Static div, no embedded map |
| Admin loading/error states | Missing | No `error.tsx`, no action error UI |
| Empty lead/staff states | Missing | Lists render blank when empty |

Runtime verification performed during this audit:

- `/`, `/cars`, `/cars/toyota-fortuner-2021-1`, `/admin`, `/admin/vehicles`,
  `/admin/vehicles/new`, `/admin/vehicles/car-1/edit`, `/admin/leads`,
  `/admin/staff`, `/admin/settings`, `/admin/settings/showroom` returned `200`.
- `/cars/toyota-raize-2022-10` (a draft vehicle) returned `200`.
- `/admin/showroom` returned `404`.

---

## 11. SEO implementation

Current implementation is minimal:

- Root `metadata` in `app/layout.tsx`: hard-coded title, description, icons,
  viewport, `generator: 'v0.app'`.
- `lang="id"` on `<html>`.
- Semantic headings and descriptive alt text in some places.
- Public pages are server-rendered; `/` is static.

Missing:

- `metadataBase`.
- Per-route `generateMetadata`.
- Vehicle-specific titles/descriptions.
- Canonical URLs.
- OpenGraph and Twitter metadata.
- `robots.txt`.
- `sitemap.xml` (including tenant-specific sitemaps).
- JSON-LD structured data (`Vehicle`, `Product`, `Offer`, `LocalBusiness`).
- Sold-listing SEO policy.
- Tenant-aware metadata.
- OG images.
- Search/filter canonicalization strategy.

The root metadata is hard-coded to Prima Auto Gallery and does not use the
showroom model.

---

## 12. Environment and configuration

| Item | Current state |
|---|---|
| `.env.example` | Absent |
| Environment variable validation | Absent |
| Runtime env usage | Only `process.env.NODE_ENV` for Vercel Analytics |
| Supabase env vars | Absent |
| Drizzle config | Absent |
| Cloudinary config | Absent |
| `next.config.mjs` | Security headers: `X-Content-Type-Options`, `Referrer-Policy`; `typescript.ignoreBuildErrors: true`; `images.unoptimized: true` |
| `tsconfig.json` | `strict: true`, bundler resolution, path alias `@/*` |
| `package.json` | Name `my-project`; scripts only `dev`, `build`, `start`; `packageManager: pnpm@12.3.4` |
| Lockfile | `pnpm-lock.yaml` |
| `pnpm-workspace.yaml` | Contains `pmOnFail: ignore` and `minimumReleaseAgeExclude`; no `packages` list |
| CI | No `.github/` |
| Lint/format config | None |
| Testing config | None |
| Vercel project config | None in repository |

`next.config.mjs` disables type checking during `next build` and disables
Next.js image optimization. Both weaken the production build and the
performance target.

---

## 13. Build and tooling baseline

Baseline captured before documentation changes:

| Command | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Success (353 packages) |
| `npx tsc --noEmit` | Exit 0 |
| `pnpm lint` | Exit 1 — `Command "lint" not found` |
| `pnpm typecheck` | Exit 1 — `Command "typecheck" not found` |
| `npm test` | Exit 1 — `Missing script: "test"` |
| `pnpm run test` | Exit 1 — `Missing script: "test"` |
| `pnpm test` | Exit 0 with no output — pnpm resolves this without running a project script; it is not a real test run |
| `pnpm build` | Exit 0 — compiled successfully; type validation skipped |

`pnpm test` is especially misleading: it exits successfully without executing
any tests. Validation must use `pnpm run test` (which fails today) or add a real
`test` script.

Build route output:

```text
○ /                         static
○ /_not-found               static
○ /admin                    static
○ /admin/leads              static
○ /admin/settings           static
○ /admin/settings/showroom  static
○ /admin/staff              static
○ /admin/vehicles           static
ƒ /admin/vehicles/[id]/edit dynamic
○ /admin/vehicles/new       static
ƒ /cars                     dynamic
ƒ /cars/[slug]              dynamic
```

Missing roadmap scripts: `lint`, `typecheck` (script), `test`, `test:e2e`.
The configured validation command in `.sdd-toolbox/config.json` includes
`npm test`, which currently fails because no test script exists.

---

## 14. Technical debt register

Severity: **Critical** = blocks production or security; **High** = blocks
roadmap capability; **Medium** = maintainability/performance; **Low** = cleanup.

| ID | Severity | Debt | Evidence | Effect |
|---|---|---|---|---|
| TD-01 | Critical | No persistence; all mutations in module memory | `lib/actions.ts`, `data/index.ts` | Admin changes are lost and unsafe in serverless |
| TD-02 | Critical | No authentication or authorization | all `/admin` routes | Anyone can access admin |
| TD-03 | Critical | No tenant isolation or `tenant_id` | all models/queries | Multi-tenant product impossible |
| TD-04 | Critical | Draft/archived vehicles publicly accessible by slug | `getVehicleBySlug` has no publication filter | Draft inventory can leak |
| TD-05 | High | Create vehicle flow does nothing | `VehicleForm.submit` only updates when `vehicle` exists | Core admin workflow blocked |
| TD-06 | High | Showroom save is a no-op | `onSubmit` sets `saved` only | White-label configuration blocked |
| TD-07 | High | No tests or CI | no test files, no `.github` | Regressions unguarded |
| TD-08 | High | Build ignores TypeScript errors | `typescript.ignoreBuildErrors: true` | Type regressions can ship |
| TD-09 | High | No server-side validation | actions accept partial objects | Invalid data and security risk |
| TD-10 | High | No media storage; fake upload | object URLs, setTimeout progress | Images disappear on reload |
| TD-11 | High | No SEO implementation beyond root metadata | `app/layout.tsx` only | Public pages not production-SEO-ready |
| TD-12 | High | Single-tenant strings and identity hard-coded | many files | White-labeling blocked |
| TD-13 | Medium | Public component module is entirely client-side | `components/showroom.tsx` | Unnecessary JS and weaker RSC boundaries |
| TD-14 | Medium | Client admin pages import mock data directly | admin pages | Data layer bypassed; client bundle bloat |
| TD-15 | Medium | Duplicated status/formatting/form primitives | see §4.3 | Drift and maintenance cost |
| TD-16 | Medium | Vehicle detail assumes at least one image | `v.images[0]` | Runtime crash risk |
| TD-17 | Medium | No gallery on detail page | only first image rendered | Poor vehicle presentation |
| TD-18 | Medium | Toast system not mounted | `toast()` calls, no `<Toaster />` | Success/error feedback invisible |
| TD-19 | Medium | Broken admin nav and create/edit entry points | `/admin/showroom`, `AddButton`, no edit link | Staff cannot complete core workflows |
| TD-20 | Medium | Image optimization disabled | `images.unoptimized: true` | Performance target at risk |
| TD-21 | Medium | No loading/error/permission states | admin actions and pages | Poor failure handling |
| TD-22 | Medium | WhatsApp links do not normalize local phone numbers | `whatsappLink` strips to `08...` | Some lead replies may fail |
| TD-23 | Medium | WhatsApp message lacks vehicle URL | detail CTA message | Roadmap lead flow incomplete |
| TD-24 | Low | Unused UI/dependency code | `components/ui/button.tsx`, `@dnd-kit/utilities` | Dead bundle surface |
| TD-25 | Low | Mock data is unrealistic | all SUVs, one image, same tax/plate/features | UI does not exercise real variation |
| TD-26 | Low | Package name is `my-project` | `package.json` | Project identity/tooling clarity |
| TD-27 | Low | `pnpm-workspace.yaml` has no `packages` and an unknown `pmOnFail` key | config | Confusing tooling setup |
| TD-28 | Low | No README or quick-start | repository root | Onboarding friction |
| TD-29 | Low | `generator: 'v0.app'` in production metadata | `app/layout.tsx` | Incorrect provenance metadata |
| TD-30 | Low | `setValue` imported but unused | `components/vehicle-form.tsx` | Lint/cleanliness |

---

## 15. Existing documentation

- `docs/ROADMAP.md` — production SDD and phased implementation roadmap.
- `docs/INTEGRATION.md` — checklist for replacing mock repositories/actions.
- `docs/as-built/ROUTES.md` — route inventory from the v0 build.
- `docs/as-built/COMPONENTS.md` — component summary.
- `docs/as-built/DATA-CONTRACT.md` — mock data contract.
- `docs/as-built/RESPONSIVE.md` — responsive behavior notes.

The as-built docs describe intent and v0 behavior. They are not a substitute for
the implementation status map in `docs/IMPLEMENTATION_STATUS.md`.

---

## 16. What is intentionally absent

As required by Phase 1, the following are **not** present and were **not**
added during this audit:

- Supabase client/server packages and configuration.
- Drizzle ORM and migrations.
- PostgreSQL schema and seeds.
- Authentication, sessions, login/logout/password reset.
- Tenant resolution, memberships, RLS, permission helpers.
- Cloudinary or any object storage.
- Git hooks, CI, test frameworks, linters, or formatters.
- A Vercel project configuration.
- Any visual redesign.

Phase 2 and later must remain unstarted until the owner approves the Phase 1
report.
