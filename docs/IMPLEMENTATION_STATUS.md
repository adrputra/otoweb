# Implementation Status — OtoWeb

Audit date: 2026-10-18  
Baseline commit: `4a4e744`  
Phase: PHASE 1 — Repository Production Audit  
Source: `docs/ROADMAP.md`

This document maps every roadmap capability to exactly one status:

| Status | Meaning |
|---|---|
| `COMPLETE` | Implemented and verified against the roadmap requirement |
| `UI_ONLY` | Interface exists, but it has no working persistence/backend behavior |
| `MOCKED` | Works against in-memory/mock data, not production data |
| `PARTIAL` | Some meaningful part exists, but the requirement is not fully met |
| `NOT_STARTED` | No implementation exists |
| `BLOCKED` | Cannot be completed until a dependency or decision is resolved |

Status is about the **capability**, not the visual polish. A screen can look
finished and still be `UI_ONLY` or `MOCKED`.

---

## 1. Phase overview

| Phase | Roadmap title | Status | Reason |
|---|---|---|---|
| 1 | Repository Production Audit | `COMPLETE` | Audit and three documents delivered; build verified |
| 2 | Engineering Foundation | `NOT_STARTED` | No lint/format/tests/CI/env validation |
| 3 | Database Foundation | `NOT_STARTED` | No Supabase, Drizzle, PostgreSQL, migrations, or seeds |
| 4 | Authentication | `NOT_STARTED` | No auth, sessions, or protected admin routes |
| 5 | Multi-Tenant Security | `NOT_STARTED` | No tenancy, memberships, tenant context, or RLS |
| 6 | Connect Public Website to Database | `MOCKED` | Public site works only from `data/index.ts` |
| 7 | Admin Vehicle CRUD | `PARTIAL` | Some in-memory actions; create and persistence missing |
| 8 | Image Management | `UI_ONLY` | Photo manager UI exists; upload is fake |
| 9 | Showroom Settings | `UI_ONLY` | Form and preview exist; save is a no-op |
| 10 | Lead Capture | `PARTIAL` | Mock lead dashboard and WhatsApp links; no capture |
| 11 | SEO Productionization | `NOT_STARTED` | Only hard-coded root metadata |
| 12 | Platform Administration | `NOT_STARTED` | No `/platform` surface |
| 13 | Subdomain Routing | `NOT_STARTED` | No hostname resolution |
| 14 | Custom Domains | `NOT_STARTED` | No domain registration/verification/routing |
| 15 | Analytics | `PARTIAL` | Vercel Analytics page views only |
| 16 | Production Hardening | `NOT_STARTED` | No audits or failure-state testing |

---

## 2. Status summary

Counts are calculated from the detailed capability map in §3.

| Status | Count |
|---|---:|
| `COMPLETE` | 30 |
| `UI_ONLY` | 20 |
| `MOCKED` | 19 |
| `PARTIAL` | 39 |
| `NOT_STARTED` | 137 |
| `BLOCKED` | 9 |
| **Total** | **254** |

---

## 3. Detailed capability map

<!-- STATUS-MAP-START -->

### Phase 1 — Repository Production Audit

| Capability | Status | Evidence / gap |
|---|---|---|
| Inspect all routes | `COMPLETE` | Route inventory in `docs/CURRENT_STATE.md` §3 |
| Inspect components | `COMPLETE` | Component inventory in `docs/CURRENT_STATE.md` §4 |
| Inspect mock data | `COMPLETE` | Mock data inventory in `docs/CURRENT_STATE.md` §5 |
| Inspect forms and validation | `COMPLETE` | Form inventory in `docs/CURRENT_STATE.md` §6 |
| Inspect utilities | `COMPLETE` | `lib/format.ts`, `lib/utils.ts`, `lib/repositories.ts`, `lib/actions.ts` reviewed |
| Inspect package configuration | `COMPLETE` | `package.json`, `next.config.mjs`, `tsconfig.json`, lockfile reviewed |
| Inspect responsive implementation | `COMPLETE` | Responsive classes and as-built notes reviewed; no browser QA performed |
| Inspect documentation | `COMPLETE` | `docs/ROADMAP.md`, `docs/INTEGRATION.md`, `docs/as-built/*` reviewed |
| Identify mock-only functionality | `COMPLETE` | Recorded in `docs/CURRENT_STATE.md` §5, §10 |
| Identify dead/incomplete UI | `COMPLETE` | Recorded in `docs/CURRENT_STATE.md` §10 |
| Identify hard-coded values | `COMPLETE` | Recorded in `docs/CURRENT_STATE.md` §9 |
| Identify duplicated components/logic | `COMPLETE` | Recorded in `docs/CURRENT_STATE.md` §4.3 |
| Identify client/server boundary issues | `COMPLETE` | Recorded in `docs/CURRENT_STATE.md` §8 |
| Identify missing pages and broken routes | `COMPLETE` | Recorded in `docs/CURRENT_STATE.md` §3.3 |
| Identify technical debt | `COMPLETE` | TD-01…TD-30 in `docs/CURRENT_STATE.md` §14 |
| Create `docs/CURRENT_STATE.md` | `COMPLETE` | File created |
| Create `docs/ARCHITECTURE.md` | `COMPLETE` | File created |
| Create `docs/IMPLEMENTATION_STATUS.md` | `COMPLETE` | This file |
| No visual redesign | `COMPLETE` | No UI/source design changes made |
| Application still builds | `COMPLETE` | `pnpm build` exit 0; `npx tsc --noEmit` exit 0 |
| Production migration plan documented | `COMPLETE` | `docs/ARCHITECTURE.md` §5 |

### Phase 2 — Engineering Foundation

| Capability | Status | Evidence / gap |
|---|---|---|
| ESLint | `NOT_STARTED` | No ESLint config or dependency |
| Formatting | `NOT_STARTED` | No Prettier/Biome config or script |
| `typecheck` command | `PARTIAL` | `npx tsc --noEmit` passes; no package script |
| Vitest | `NOT_STARTED` | No Vitest dependency/config |
| Testing Library | `NOT_STARTED` | No Testing Library dependency/config |
| Playwright | `NOT_STARTED` | No Playwright dependency/config |
| GitHub Actions | `NOT_STARTED` | No `.github/` directory |
| Environment validation | `NOT_STARTED` | No env schema or startup validation |
| `.env.example` | `NOT_STARTED` | File absent |
| Required scripts (`lint`, `typecheck`, `test`, `test:e2e`) | `PARTIAL` | `dev`, `build`, `start` exist; the other scripts do not |
| `pnpm lint` succeeds | `NOT_STARTED` | Script does not exist; command exits 1 |
| `pnpm typecheck` succeeds | `PARTIAL` | Standalone `tsc` passes; command/script does not exist and exits 1 |
| `pnpm test` succeeds | `NOT_STARTED` | No test script; `pnpm test` silently exits 0 without running tests, while `pnpm run test` and `npm test` exit 1 |
| `pnpm build` succeeds | `COMPLETE` | Verified during audit |
| At least one Playwright smoke test | `NOT_STARTED` | No test files |

### Phase 3 — Database Foundation

| Capability | Status | Evidence / gap |
|---|---|---|
| Install/configure Supabase | `NOT_STARTED` | No package, client, or config |
| Install/configure Drizzle ORM | `NOT_STARTED` | No Drizzle dependency/config |
| PostgreSQL migrations | `NOT_STARTED` | No `db/`, migrations, or SQL |
| `tenants` table | `NOT_STARTED` | No database |
| `tenant_domains` table | `NOT_STARTED` | No database |
| `profiles` table | `NOT_STARTED` | No database |
| `tenant_members` table | `NOT_STARTED` | No database |
| `showroom_settings` table | `NOT_STARTED` | Only a mock `Showroom` type exists |
| `vehicles` table | `NOT_STARTED` | Only a mock `Vehicle` type exists |
| `vehicle_images` table | `NOT_STARTED` | Images are inline mock objects |
| `leads` table | `NOT_STARTED` | Only a mock `Lead` type exists |
| Development seeds | `MOCKED` | Mock arrays exist in `data/index.ts`; no seed script |
| Seed Prima Auto Gallery | `MOCKED` | Single mock showroom exists; not seeded |
| Seed Tenant B Test Showroom | `NOT_STARTED` | No second tenant fixture |
| Migrate mock vehicle data into seed data | `MOCKED` | 12 mock vehicles exist; no migration/seed |
| Schema documented | `PARTIAL` | `lib/types.ts` and `docs/as-built/DATA-CONTRACT.md`; no production schema doc |
| Schema migration works from empty DB | `BLOCKED` | Depends on Supabase/Drizzle setup |
| Seed works from empty DB | `BLOCKED` | Depends on schema/migrations |
| Existing mock vehicle data exists in DB | `BLOCKED` | No database |
| Build passes after database work | `BLOCKED` | Database work has not started |

### Phase 4 — Authentication

| Capability | Status | Evidence / gap |
|---|---|---|
| Supabase Auth setup | `NOT_STARTED` | No auth dependency/config |
| Login | `NOT_STARTED` | No login route or form |
| Logout | `NOT_STARTED` | No session or logout action |
| Password reset | `NOT_STARTED` | No reset flow |
| Authenticated admin routes | `NOT_STARTED` | All `/admin` routes are public |
| Session handling | `NOT_STARTED` | No session helpers or middleware |
| No public registration | `NOT_STARTED` | No auth exists; policy is not enforceable yet |
| Unauthenticated admin access blocked | `NOT_STARTED` | Admin routes return 200 without auth |
| Authenticated owner can access admin | `NOT_STARTED` | No owner identity or membership |
| Logout works | `NOT_STARTED` | No session |
| Expired sessions handled | `NOT_STARTED` | No session handling |

### Phase 5 — Multi-Tenant Security

| Capability | Status | Evidence / gap |
|---|---|---|
| Tenant memberships | `NOT_STARTED` | No `tenant_members`; `StaffMember` is not a membership |
| Tenant context | `NOT_STARTED` | No request-scoped tenant context |
| Hostname resolver | `NOT_STARTED` | No `lib/tenant/**` |
| Tenant-scoped queries | `NOT_STARTED` | Repositories query a single global array |
| Row Level Security | `NOT_STARTED` | No database/RLS policies |
| Permission helpers | `NOT_STARTED` | No roles/capability checks server-side |
| Tenant isolation tests | `NOT_STARTED` | No test framework or fixtures |
| Fixtures `prima` and `tenant-b` | `NOT_STARTED` | Only one mock showroom |
| Cross-tenant read/write/delete tests | `NOT_STARTED` | No tests |
| Service role never reaches browser | `NOT_STARTED` | No service role exists; no policy in code |
| Direct DB/API attempts protected | `NOT_STARTED` | No DB/API protection |
| Tenant B data cannot appear for Tenant A | `BLOCKED` | Depends on Phase 3–5 implementation |
| Do not proceed if isolation tests fail | `BLOCKED` | Gate cannot be evaluated until tests exist |

### Phase 6 — Connect Public Website to Database

| Capability | Status | Evidence / gap |
|---|---|---|
| Homepage featured units DB-driven | `MOCKED` | `listVehicles()` reads `data/index.ts` |
| Inventory page DB-driven | `MOCKED` | `listVehicles(searchParams)` reads mock arrays |
| Vehicle detail DB-driven | `MOCKED` | `getVehicleBySlug()` reads mock arrays |
| Related vehicles DB-driven | `MOCKED` | `getRelatedVehicles()` reads mock arrays |
| Showroom data DB-driven | `MOCKED` | `getShowroom()` returns one mock object |
| Filtering works | `MOCKED` | In-memory brand/model/price/year/transmission/fuel/mileage/sort |
| Sorting works | `MOCKED` | In-memory newest/price/year/mileage |
| No public vehicle data from hard-coded arrays | `NOT_STARTED` | All public data still comes from arrays |
| Featured vehicles DB-driven | `MOCKED` | `featured` flag comes from mock data |
| Tenant showroom settings render | `MOCKED` | One hard-coded showroom renders |
| Preserve existing visual design | `COMPLETE` | No redesign performed |
| Public inventory only exposes available/reserved | `PARTIAL` | Sold vehicles are also listed; no config switch |
| Draft/archived never appear publicly | `PARTIAL` | Listing filters publication, but detail route leaks drafts/archived |

### Phase 7 — Admin Vehicle CRUD

| Capability | Status | Evidence / gap |
|---|---|---|
| Create vehicle | `UI_ONLY` | Form exists; `submit()` does nothing for new vehicles |
| Edit vehicle | `PARTIAL` | Mutates mock array only; limited fields |
| Publish vehicle | `PARTIAL` | Publication field exists; no durable create/update |
| Unpublish vehicle | `UI_ONLY` | Draft option exists in form; no durable action |
| Reserve vehicle | `MOCKED` | Client state + `updateVehicle` mutation |
| Mark vehicle sold | `MOCKED` | Client state + `updateVehicle` mutation |
| Archive vehicle | `MOCKED` | Client state + `updateVehicle` mutation |
| Duplicate vehicle | `MOCKED` | In-memory copy; ID/slug collisions and shared nested objects |
| Delete vehicle | `MOCKED` | In-memory hard delete |
| Preview vehicle | `PARTIAL` | Public link exists; draft preview leaks publicly |
| Confirmation for dangerous operations | `PARTIAL` | Delete uses `window.confirm`; other destructive actions do not |
| Soft delete / archive preference | `PARTIAL` | Archive state exists; delete still hard-deletes |
| Server-side validation | `NOT_STARTED` | Actions accept arbitrary `Partial<Vehicle>` |
| Shared Zod schemas between client/server | `PARTIAL` | Vehicle form has a client Zod schema only |
| Admin create → store → publish → public | `BLOCKED` | Depends on Phase 3–6 |
| No manual DB operations required | `BLOCKED` | No database or CRUD persistence |

### Phase 8 — Image Management

| Capability | Status | Evidence / gap |
|---|---|---|
| Cloudinary integration | `NOT_STARTED` | No Cloudinary dependency/config |
| Upload | `UI_ONLY` | Object URLs only; no network upload |
| Multiple upload | `UI_ONLY` | File input accepts multiple; local only |
| Upload progress | `UI_ONLY` | Simulated with `setTimeout` |
| Drag/drop reordering | `UI_ONLY` | dnd-kit works locally; not persisted |
| Cover image selection | `UI_ONLY` | Local `isCover` state only |
| Delete image | `UI_ONLY` | Local state only |
| Retry failed uploads | `NOT_STARTED` | No real upload, no retry |
| File type validation | `PARTIAL` | `accept="image/*"` only |
| File size validation | `NOT_STARTED` | No size check |
| Number-of-files validation | `PARTIAL` | Hard-coded max 20 on the client |
| Server-side media validation | `NOT_STARTED` | No server upload path |
| Configurable maximum images | `PARTIAL` | Hard-coded 20; not configurable |
| Responsive delivery/optimization | `NOT_STARTED` | `images.unoptimized: true` |
| 15 high-resolution image workflow | `NOT_STARTED` | No real upload workflow |
| Image ordering persists | `NOT_STARTED` | Order is local only |
| Cover persists | `NOT_STARTED` | Cover is local only |
| Deleting vehicle handles media policy | `NOT_STARTED` | No media storage or policy |

### Phase 9 — Showroom Settings

| Capability | Status | Evidence / gap |
|---|---|---|
| Edit showroom name | `UI_ONLY` | Controlled input; save is a no-op |
| Edit tagline | `UI_ONLY` | Controlled input; save is a no-op |
| Edit description | `UI_ONLY` | Controlled input; save is a no-op |
| Edit logo | `UI_ONLY` | URL input; logo unused publicly |
| Edit hero image | `UI_ONLY` | URL input; preview only |
| Edit primary/secondary colors | `UI_ONLY` | Color inputs; not applied to public pages |
| Edit contact details | `UI_ONLY` | Phone/WhatsApp/email inputs |
| Edit address | `UI_ONLY` | Street/city/hours only; no province/postal code |
| Edit social links | `UI_ONLY` | Instagram/TikTok/Facebook inputs |
| Edit opening hours | `UI_ONLY` | Input exists |
| Edit SEO fields | `UI_ONLY` | Title/description inputs |
| Tenant-scoped settings | `NOT_STARTED` | Single global showroom |
| Admin update → public reflects without deployment | `NOT_STARTED` | Save only sets local state |
| Hero headline/subheadline editing | `NOT_STARTED` | Model has fields; form does not edit them |
| Hero CTA label editing | `NOT_STARTED` | Model has field; form does not edit it |
| Favicon editing | `NOT_STARTED` | Not in the model |
| Live preview | `UI_ONLY` | Local preview updates; no persistence |
| All changes tenant scoped | `NOT_STARTED` | No tenant model |

### Phase 10 — Lead Capture

| Capability | Status | Evidence / gap |
|---|---|---|
| Lead table | `NOT_STARTED` | No database; mock `Lead` type only |
| Contact form | `NOT_STARTED` | No public contact form |
| WhatsApp tracking | `PARTIAL` | WhatsApp links generated; no click tracking or lead creation |
| Lead dashboard | `MOCKED` | List renders mock leads |
| Lead status updates | `MOCKED` | Local state + `updateLead` mock mutation |
| Lead status model (`new`, `contacted`, `qualified`, `won`, `lost`) | `PARTIAL` | Current model uses `new`, `contacted`, `closed` |
| Lead source model (`contact_form`, `whatsapp`, `phone`, `manual`) | `PARTIAL` | Current model uses `whatsapp`, `form`, `phone` |
| Customer inquiry → tenant lead → admin dashboard | `BLOCKED` | Depends on auth, tenancy, and database |
| Do not build advanced CRM | `COMPLETE` | No CRM features exist |
| WhatsApp message includes vehicle URL | `NOT_STARTED` | Message omits the URL |
| WhatsApp link handles local phone numbers | `PARTIAL` | `whatsappLink` strips non-digits; leading `0` is not normalized to `62` |

### Phase 11 — SEO Productionization

| Capability | Status | Evidence / gap |
|---|---|---|
| Dynamic metadata | `NOT_STARTED` | Only hard-coded root metadata |
| OpenGraph | `NOT_STARTED` | Not configured |
| Canonical URL | `NOT_STARTED` | Not configured |
| `robots.txt` | `NOT_STARTED` | No route/file |
| `sitemap.xml` | `NOT_STARTED` | No route/file |
| Structured data (`Vehicle`, `Product`, `Offer`, `LocalBusiness`) | `NOT_STARTED` | No JSON-LD |
| Sold listing handling | `PARTIAL` | Sold detail page remains accessible and shows “Terjual”; no SEO policy |
| Tenant-specific sitemaps | `NOT_STARTED` | No tenancy |
| Verify generated HTML metadata | `NOT_STARTED` | No metadata to verify |
| Vehicle title pattern | `NOT_STARTED` | Root title is generic and hard-coded |

### Phase 12 — Platform Administration

| Capability | Status | Evidence / gap |
|---|---|---|
| `/platform` surface | `NOT_STARTED` | No route |
| Create tenant | `NOT_STARTED` | No tenancy |
| Disable tenant | `NOT_STARTED` | No tenancy |
| Assign owner | `NOT_STARTED` | No membership model |
| Inspect tenant | `NOT_STARTED` | No tenancy |
| Set subdomain | `NOT_STARTED` | No domain model |
| Set plan/status | `NOT_STARTED` | No tenant model |
| Restrict platform interface to platform admins | `NOT_STARTED` | No auth/authorization |

### Phase 13 — Subdomain Routing

| Capability | Status | Evidence / gap |
|---|---|---|
| Wildcard tenant routing | `NOT_STARTED` | No hostname resolution or middleware |
| Development tenant testing strategy | `NOT_STARTED` | No documented local host strategy |
| Two hostnames show different branding/inventory/contact | `NOT_STARTED` | Single hard-coded showroom |

### Phase 14 — Custom Domains

| Capability | Status | Evidence / gap |
|---|---|---|
| Domain registration | `NOT_STARTED` | No domain model |
| Verification state | `NOT_STARTED` | No domain model |
| DNS instructions | `NOT_STARTED` | No platform UI/docs |
| Domain routing | `NOT_STARTED` | No hostname resolution |
| SSL provisioning integration | `NOT_STARTED` | No integration |
| Platform subdomain fallback | `NOT_STARTED` | No subdomain routing |

### Phase 15 — Analytics

| Capability | Status | Evidence / gap |
|---|---|---|
| `vehicle_view` event | `NOT_STARTED` | No custom event |
| `inventory_search` event | `NOT_STARTED` | No custom event |
| `filter_use` event | `NOT_STARTED` | No custom event |
| `whatsapp_click` event | `NOT_STARTED` | No tracking |
| `contact_submit` event | `NOT_STARTED` | No contact form |
| `vehicle_share` event | `NOT_STARTED` | Share button has no handler |
| Metrics dashboard | `NOT_STARTED` | No metrics surface |
| Vercel Analytics page views | `PARTIAL` | `@vercel/analytics` mounted in production only |

### Phase 16 — Production Hardening

| Capability | Status | Evidence / gap |
|---|---|---|
| Security audit | `NOT_STARTED` | Not performed |
| RLS audit | `NOT_STARTED` | No RLS |
| Authorization audit | `NOT_STARTED` | No authorization |
| Dependency audit | `NOT_STARTED` | No audit recorded |
| Mobile QA | `PARTIAL` | Responsive classes exist; no browser QA evidence in this phase |
| Desktop QA | `PARTIAL` | Responsive classes exist; no browser QA evidence in this phase |
| SEO audit | `NOT_STARTED` | No SEO implementation |
| Accessibility audit | `NOT_STARTED` | Not performed |
| Performance audit | `NOT_STARTED` | Not measured; image optimization disabled |
| Failure-state testing | `NOT_STARTED` | No tests |
| Test with two realistic showrooms | `NOT_STARTED` | Only one mock showroom |

### Cross-cutting architectural requirements

| Capability | Status | Evidence / gap |
|---|---|---|
| One repository | `COMPLETE` | Single repository |
| One Next.js application | `COMPLETE` | Single App Router app |
| One production database | `NOT_STARTED` | No database |
| One deployment | `NOT_STARTED` | No committed Vercel configuration |
| Many tenants | `NOT_STARTED` | One hard-coded showroom |
| No per-showroom repositories/deployments/branches | `COMPLETE` | None exist |
| Differences come from configuration | `PARTIAL` | One mock showroom config; branding strings hard-coded |
| Preserve approved v0 design | `COMPLETE` | No redesign |
| Component cleanup before backend integration | `PARTIAL` | Some shared components; duplication and hard-coding remain |
| Server Components by default | `PARTIAL` | Public pages are server components; `components/showroom.tsx` is entirely client |
| Client Components only where needed | `PARTIAL` | `VehicleCard`, `Filters`, `QuickSearch` do not need client state |
| Data access separated from presentation | `PARTIAL` | Repositories exist; client admin pages import mock data directly |
| Authorization enforced server-side | `NOT_STARTED` | No authorization |
| Loading state on major interactions | `PARTIAL` | Listing skeleton and form `isSubmitting`; most admin actions lack states |
| Empty state on major interactions | `PARTIAL` | Vehicle listing has one; leads/staff do not |
| Success state | `PARTIAL` | `toast()` calls exist but no `<Toaster />` mounted |
| Validation error state | `PARTIAL` | Vehicle form field errors; other forms lack schema validation |
| Server error state | `NOT_STARTED` | No action error handling |
| Permission error state | `NOT_STARTED` | No authorization |
| No unhandled Promise rejection paths | `PARTIAL` | Actions are awaited but not wrapped in error handling |
| Meaningful server logging | `NOT_STARTED` | No logging |
| No sensitive stack traces to users | `PARTIAL` | No explicit leak found; no error boundary policy |
| Vercel logs | `NOT_STARTED` | Deployment not configured |
| Vercel Analytics | `PARTIAL` | Installed and mounted in production |
| Application error reporting | `NOT_STARTED` | No reporting integration |
| Performance target (Lighthouse ≥ 90/90/90/95) | `NOT_STARTED` | Not measured; image optimization disabled |
| Image optimization | `NOT_STARTED` | `images.unoptimized: true` |
| Font loading | `PARTIAL` | `next/font` used; no measured target |
| JavaScript bundle size | `NOT_STARTED` | Not measured; broad client components |
| Mobile performance | `NOT_STARTED` | Not measured |
| Server rendering | `PARTIAL` | Public routes are server-rendered; admin is mostly client |
| Testing foundation | `NOT_STARTED` | No unit/E2E tests |
| CI | `NOT_STARTED` | No GitHub Actions |
| Definition of Done enforced | `PARTIAL` | Typecheck/build pass; lint/tests/QA/security gates do not exist |
| Mandatory rules (secrets, tenant scope, migrations, tests) | `PARTIAL` | No secrets committed; tenant scope/migrations/tests absent |
| Documentation updated | `COMPLETE` | This audit updates the three required documents |
| Stop after requested phase | `COMPLETE` | Phase 1 stops after this report |

### Explicitly deferred features

These are intentionally out of scope for the initial MVP per roadmap §60.

| Capability | Status | Note |
|---|---|---|
| Subscription billing | `NOT_STARTED` | Deferred |
| Online vehicle purchasing | `NOT_STARTED` | Deferred |
| Payment gateway | `NOT_STARTED` | Deferred |
| Financing provider APIs | `NOT_STARTED` | Deferred |
| WhatsApp Business API | `NOT_STARTED` | Deferred; wa.me only |
| AI chatbot | `NOT_STARTED` | Deferred |
| Native apps | `NOT_STARTED` | Deferred |
| Marketplace aggregation | `NOT_STARTED` | Deferred |
| Dealer accounting | `NOT_STARTED` | Deferred |
| Complex CRM | `NOT_STARTED` | Deferred |
| Custom page builder | `NOT_STARTED` | Deferred by design |
| Custom tenant JavaScript | `NOT_STARTED` | Deferred by design |
| Arbitrary themes | `NOT_STARTED` | Deferred; `premium` baseline only |
| Dealer-to-dealer trading | `NOT_STARTED` | Deferred |
| AI vehicle descriptions/captions/photo cleanup | `NOT_STARTED` | Future V2/V3 |

<!-- STATUS-MAP-END -->

---

## 4. Critical path and blockers

The dependency chain is strict:

```text
Phase 2 (engineering foundation)
   ↓
Phase 3 (database)
   ↓
Phase 4 (authentication)
   ↓
Phase 5 (multi-tenant security)
   ↓
Phase 6 (public data)
   ↓
Phase 7 (admin CRUD)
   ↓
Phase 8 (media)
   ↓
Phase 9 (showroom settings)
   ↓
Phase 10 (leads)
   ↓
Phase 11 (SEO)
   ↓
Phase 12–15 (platform, domains, analytics)
   ↓
Phase 16 (hardening)
```

Blocking conditions in the current repository:

1. **No database or migrations.** Every persistence-dependent acceptance test is
   `BLOCKED`.
2. **No auth.** Admin access is open; owner/staff roles cannot be exercised.
3. **No tenant model.** Multi-tenant and isolation capabilities cannot start.
4. **No test harness or CI.** Regression protection is absent.
5. **Create vehicle and showroom save are no-ops.** The core admin workflows
   cannot be validated end-to-end.
6. **Draft vehicle leakage.** `getVehicleBySlug` does not filter publication.
7. **Broken admin navigation.** `/admin/showroom` is a 404; create/edit entry
   points are missing.
8. **No mounted toast host.** Success/error feedback is invisible.

---

## 5. Technical debt linkage

The full debt register is in `docs/CURRENT_STATE.md` §14. The highest-priority
items that block roadmap phases are:

| Debt | Blocks |
|---|---|
| TD-01 No persistence | Phases 3, 6, 7, 8, 9, 10 |
| TD-02 No auth | Phases 4, 5, 7, 9, 10, 12 |
| TD-03 No tenant isolation | Phases 5, 6, 12, 13, 14 |
| TD-04 Draft/archived public access | Phase 6, 7, 11 |
| TD-05 Create vehicle no-op | Phase 7 |
| TD-06 Showroom save no-op | Phase 9 |
| TD-07 No tests/CI | Phase 2, all later phases |
| TD-08 Build ignores TS errors | Phase 2 |
| TD-09 No server validation | Phases 7, 9, 10 |
| TD-10 Fake media upload | Phase 8 |
| TD-11 No SEO | Phase 11 |
| TD-12 Hard-coded tenant strings | Phases 5, 6, 9, 13 |
| TD-19 Broken admin navigation | Phases 7, 9 |
| TD-18 Missing Toaster | Phases 7, 9, 10 |

---

## 6. What “done” would look like for the first commercial MVP

The roadmap §59 defines the first commercial MVP boundary as Phases 1–9, 11,
and 13. For that boundary to be credible:

- Phase 2 must provide lint, typecheck, tests, CI, and env validation.
- Phase 3 must provide a repeatable schema, migrations, and seeds.
- Phase 4 must protect every admin route and action.
- Phase 5 must prove tenant isolation with automated tests.
- Phase 6 must remove all public mock-array reads and must not expose drafts or
  archived vehicles.
- Phase 7 must make create/edit/publish/reserve/sell/archive/duplicate/delete
  durable and validated.
- Phase 8 must make media uploads durable, ordered, and optimized.
- Phase 9 must make showroom settings tenant-scoped and publicly effective
  without a deployment.
- Phase 11 must generate dynamic metadata, canonical URLs, sitemap, robots, and
  structured data.
- Phase 13 must serve different branding/inventory/contact from two hostnames
  on one deployment.
- Phase 16 audits should follow before onboarding real customer data.

---

## 7. Validation evidence

Commands run after the Phase 1 documentation was written:

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Exit 0 |
| `pnpm lint` | Exit 1 — `Command "lint" not found` |
| `pnpm typecheck` | Exit 1 — `Command "typecheck" not found` |
| `npm test` | Exit 1 — `Missing script: "test"` |
| `pnpm run test` | Exit 1 — `Missing script: "test"` |
| `pnpm test` | Exit 0 with no output; does not execute tests |
| `pnpm build` | Exit 0; Next.js compiled; type validation skipped |

Runtime route checks performed during the audit:

- Public and admin routes returned `200` except `/admin/showroom`, which
  returned `404`.
- Draft vehicle `/cars/toyota-raize-2022-10` returned `200`, confirming the
  publication filter gap.

---

## 8. Recommended next phase

**PHASE 2 — Engineering Foundation.**

It is the correct next step because:

- It does not require production data or credentials.
- It turns the existing build into a verifiable baseline.
- It adds the guardrails needed for every later migration.
- It resolves the current `npm test` failure and missing lint/typecheck scripts.
- It can be completed without changing the approved visual design.

Phase 2 should add ESLint, formatting, `typecheck`, `lint`, `test`, `test:e2e`,
Vitest, Testing Library, Playwright, GitHub Actions, `.env.example`, and
environment validation, then verify:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not start Phase 3 until Phase 2 is approved.
