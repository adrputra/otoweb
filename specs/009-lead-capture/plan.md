# Implementation Plan: Lead Capture

**Branch**: `009-lead-capture` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-lead-capture/spec.md`

## Summary

Add a tenant-owned `leads` table with the roadmap's sources and statuses, a
public contact form, a durable WhatsApp-inquiry redirect, a tenant-scoped admin
lead dashboard, and status updates. Public submissions resolve the tenant from
the verified request hostname; the browser never sends a tenant id. Admin reads
and writes use the existing `requireAdminTenantContext`/`withTenantSession`
pattern and the `manage_leads` capability. PostgreSQL RLS is added for the new
table. The legacy mock lead screen and mock dashboard lead data are replaced;
no CRM surface (pipelines, assignments, notes, automation, exports, messaging)
is introduced.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 20+, Next.js 16 App Router, React
19

**Primary Dependencies**: Drizzle ORM, Zod 4, React Hook Form +
`@hookform/resolvers`, `sonner`, `lucide-react`. No new package.

**Storage**: PostgreSQL `leads` table (new migration), tenant-owned with an
optional vehicle reference. RLS enabled and forced.

**Testing**: Vitest with PGlite for schema/RLS/service/mapping tests; Playwright
admin project for the public-inquiry-to-dashboard loop; project visual QA
capture for desktop/mobile evidence.

**Target Platform**: Next.js Node runtime, responsive public and admin web.

**Project Type**: Single Next.js web application.

**Performance Goals**: Public submission is one tenant-scoped insert; WhatsApp
tracking is one insert followed by a server-side redirect; dashboard is one
tenant-scoped read plus one aggregate read. No N+1 vehicle lookups.

**Constraints**: Tenant isolation, `manage_leads` authorization, shared
validation, no service-role/browser exposure, preserve the incumbent
neutral/amber design, no advanced CRM, no WhatsApp Business API.

**Scale/Scope**: One lead table, one public form, one public redirect endpoint,
one admin dashboard, one status-update action, and dashboard-home wiring.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled project template with no
ratified principles, so constitution checks are skipped gracefully. The
governing constraints are the roadmap acceptance criteria, F005 tenant isolation
(`docs/TENANCY.md`), the repository TypeScript standards, and the explicit
"no advanced CRM" boundary. No violation to justify.

**Post-design re-check**: Pass — the design reuses the existing tenant resolver,
capability matrix, tenant session, and admin route pattern. It introduces no new
service, bypass, or credential path, and every write is tenant-scoped.

## Project Structure

### Documentation (this feature)

```text
specs/009-lead-capture/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── leads.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
db/
├── schema.ts                         # lead enums, table, relations, types
└── migrations/0002_*.sql             # generated table + hand-appended RLS

lib/
├── validation/lead.ts                # shared contact/status validation
├── public/lead-service.ts            # tenant-scoped public lead creation
├── admin/lead-queries.ts             # tenant-scoped list + summary counts
├── admin/lead-service.ts             # status update inside withTenantSession
├── admin/lead-actions.ts             # 'use server' status action + revalidation
├── admin/lead-mapper.ts              # DB row -> admin Lead view model
├── repositories.ts                   # tenant resolution for public submission
└── types.ts                          # Lead view model, source/status unions

app/
├── page.tsx                          # public contact form section
├── api/public/whatsapp/route.ts      # durable tracking + tenant redirect
├── admin/page.tsx                    # real new-lead count + recent leads
└── admin/leads/page.tsx              # server data load for the dashboard

components/
├── public-contact-form.tsx           # client form + validation + states
└── admin/lead-table.tsx              # client filters, status select, empty state

tests/
├── unit/validation/lead.test.ts
├── unit/public/lead-capture.test.ts
├── unit/admin/leads.test.ts
├── unit/tenant/rls.test.ts           # extended for leads
└── e2e/admin-leads.spec.ts

scripts/
└── visual-qa-leads.mjs               # F010 desktop/mobile capture

docs/
└── LEADS.md                          # feature contract and verification
```

**Structure Decision**: Single application. Lead code follows the existing
`lib/validation` + `lib/admin` + server-action pattern used by F007–F009.
Public creation is a thin server-only service; admin reads/writes stay in the
existing tenant-scoped admin layer.

## Design Decisions

1. **Schema mirrors roadmap §28.** `leads` stores `id`, `tenant_id`,
   `vehicle_id` (nullable), `name`, `phone`, `email`, `message`, `source`,
   `status`, `created_at`, `updated_at`. New distinct enums are
   `lead_source` (`contact_form`/`whatsapp`/`phone`/`manual`) and `lead_status`
   (`new`/`contacted`/`qualified`/`won`/`lost`). Contact fields are nullable
   because an anonymous WhatsApp click has no visitor identity; the contact form
   requires name, phone, and message at validation time.
2. **Tenant resolution is server-side.** The contact action and WhatsApp route
   call `resolvePublicTenant()`/`getPublicTenant()`. They never accept a tenant
   id from the browser. Vehicle association resolves the slug with
   `getTenantVehicleBySlug(db, tenantId, slug)`, so a foreign slug can only
   produce a generic lead, never a foreign link.
3. **WhatsApp tracking is a redirect, not client telemetry.** The public CTAs
   point at `/api/public/whatsapp?vehicle=<slug>`. The route records the lead
   first and then 302s to the tenant's configured `wa.me` URL. If no number is
   configured it returns the visitor to the contact area without inventing a
   number. Each activation creates one inquiry record (no deduplication).
4. **Writes use one path each.** Public creation is an unauthenticated insert
   pinned to the resolved tenant. Admin status changes run through
   `withTenantSession` and filter by both lead id and actor tenant id; staff is
   allowed because `manage_leads` already includes staff.
5. **RLS is part of the migration.** The generated table migration is extended
   with `ENABLE`/`FORCE ROW LEVEL SECURITY` and a `FOR ALL` tenant-isolation
   policy matching the existing tables. The restricted-role suite is extended
   to prove cross-tenant reads and writes return nothing.
6. **Admin dashboard replaces mock data.** `/admin/leads` becomes a
   server-rendered page with a client table. `/admin/page.tsx` reads the real
   new-lead count and recent leads. The legacy `data/index.ts` lead array and
   `updateLead` mock action are removed so no runtime path can resurrect fake
   leads.
7. **Design.** The public form sits in the existing home contact section and the
   admin table follows the vehicle table's list/card breakpoint pattern. The
   neutral/amber palette, square borders, and typography are preserved; only
   the existing accent token colours the submit control.
8. **Out of scope by construction.** No notes, assignment, pipeline stage,
   deal value, tags, automation, bulk export, email/SMS send, or WhatsApp
   Business API code is added.

## Complexity Tracking

No constitution violations. The only new abstractions are a public lead service
and a mapper shared by admin queries; both keep server-only code out of the
client and make the acceptance behaviour independently testable.
