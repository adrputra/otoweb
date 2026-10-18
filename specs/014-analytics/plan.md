# Implementation Plan: Analytics

**Branch**: `014-analytics` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/014-analytics/spec.md`

## Summary

Add first-party, tenant-scoped analytics to the existing showroom platform. A new
`analytics_events` table stores the six roadmap event types. Public page
interactions (`vehicle_view`, `inventory_search`, `filter_use`, `vehicle_share`)
are sent from small client components to a public beacon route; lead-backed
interactions (`whatsapp_click`, `contact_submit`) are recorded server-side after
the existing lead write succeeds, so WhatsApp clicks are not double-counted. The
admin dashboard gains an analytics section with vehicle views, most viewed
vehicles, WhatsApp clicks, new leads, and a documented conversion percentage.

**Requirements analysis**: clean — zero open questions. Judgement calls are
recorded as assumptions in the spec: first-party storage only, all-time metrics,
one view per page mount, supported query keys, new-leads-over-views conversion,
and non-blocking best-effort writes.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16 App Router, React 19

**Primary Dependencies**: Drizzle ORM 0.45, PostgreSQL/Supabase (PGlite in
development and tests), Zod 4 for payload validation, Vitest 5, Playwright 1.64

**Storage**: New `analytics_events` table plus a `analytics_event_type` enum in
`db/schema.ts`; migration `0004_analytics.sql` generated through drizzle-kit and
completed with the existing tenant-isolation RLS policy pattern.

**Testing**: Vitest unit tests over PGlite for recording, aggregation, RLS, and
the beacon route; Testing Library for the client tracker/share components;
Playwright admin e2e for the dashboard section; focused desktop/mobile visual
capture.

**Target Platform**: Single Next.js application deployed behind wildcard and
custom hostnames. Public tracking writes over HTTPS to the same origin.

**Project Type**: Single Next.js web application.

**Performance Goals**: Analytics reads are two indexed aggregate queries on the
admin dashboard. Public tracking is a fire-and-forget beacon that must not delay
or block page interaction.

**Constraints**: No external analytics vendor, pixel, cookie, or third-party
script. No PII. Analytics failures must never fail rendering, contact capture,
or the WhatsApp redirect. Dashboard access stays behind the existing admin
authentication and tenant context. The incumbent neutral/amber admin and
showroom visual system is preserved.

**Scale/Scope**: Six event types, one public beacon route, one schema table, one
admin dashboard section, and one share control. No historical backfill.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No ratified constitution exists (`.specify/memory/constitution.md` is the
unfilled template), so no constitution gates apply. The plan preserves the
documented boundaries in `docs/TENANCY.md`, `docs/DATABASE.md`, and
`docs/LEADS.md`: tenant-scoped reads/writes, forced RLS, non-fatal analytics,
and the existing admin authorization boundary.

## Project Structure

### Documentation (this feature)

```text
specs/014-analytics/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── analytics-api.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
db/
├── schema.ts                         # analytics_event_type enum + analytics_events table
└── migrations/0004_analytics.sql     # table, indexes, RLS policy

lib/
├── analytics/
│   ├── events.ts                     # event types, supported query keys, payload normalization
│   ├── record.ts                     # non-throwing tenant-scoped insert
│   ├── client.ts                     # sendBeacon/fetch helper (never throws)
│   └── format.ts                     # conversion/view-count display helpers
└── admin/
    └── analytics-queries.ts          # stats, most viewed, conversion summary

app/
├── api/public/analytics/route.ts     # public beacon endpoint
└── admin/page.tsx                    # analytics dashboard section

components/
├── analytics/
│   ├── page-trackers.tsx             # VehicleViewTracker, InventoryTracker
│   └── vehicle-share-button.tsx      # working share control + event
└── showroom.tsx                      # unchanged card/filter components

lib/public/lead-actions.ts            # contact_submit after successful lead
app/api/public/whatsapp/route.ts      # whatsapp_click after successful lead

scripts/
├── visual-qa-analytics.mjs           # desktop/mobile evidence
└── package.json                      # visual:qa:analytics script

tests/
├── unit/analytics/events.test.ts
├── unit/analytics/recording.test.ts
├── unit/analytics/dashboard.test.ts
├── unit/analytics/beacon-route.test.ts
├── unit/analytics/lead-events.test.ts
├── unit/analytics/trackers.test.tsx
├── unit/analytics/rls.test.ts
├── unit/public/whatsapp-tracking.test.ts   # extended
└── e2e/admin-analytics.spec.ts

docs/
└── ANALYTICS.md
```

**Structure Decision**: Keep the existing single-app layout. Analytics is a
small cross-cutting module under `lib/analytics` with its data access under
`lib/admin`, its public transport under `app/api/public`, and its client
surfaces as focused components. No new package, vendor, or deployment service.

## Implementation Phases

### Phase 0 — Research

Decisions recorded in [research.md](./research.md): first-party storage,
client beacon vs server events, event semantics, RLS, conversion definition,
and non-blocking strategy.

### Phase 1 — Design

- [data-model.md](./data-model.md): table, enum, indexes, RLS, metric queries.
- [contracts/analytics-api.md](./contracts/analytics-api.md): beacon payload,
  validation, responses, and the lead-backed server events.
- [quickstart.md](./quickstart.md): runnable validation scenarios.

### Phase 2 — Implementation outline

1. Schema and additive migration; RLS policy.
2. Shared event contract and non-throwing recorder.
3. Public beacon route and client tracking components.
4. Wire the detail page, inventory page, share control, contact action, and
   WhatsApp route.
5. Admin analytics queries and dashboard section.
6. Focused unit tests, admin e2e, documentation, and visual evidence.

## Complexity Tracking

No constitution violations. The only intentional limits are documented in the
spec's Assumptions and Out of Scope: all-time metrics, no unique-visitor
deduplication, and no external analytics vendor.
