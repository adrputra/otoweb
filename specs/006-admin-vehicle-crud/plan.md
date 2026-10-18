# Implementation Plan: Admin Vehicle CRUD

**Branch**: `006-admin-vehicle-crud` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-admin-vehicle-crud/spec.md`

## Summary

Replace the admin vehicle mock reads and in-memory actions with tenant-scoped
PostgreSQL CRUD. A shared Zod schema (`lib/validation/vehicle.ts`) drives both
the existing React Hook Form and a new server-side service. The service owns
create, edit, lifecycle transitions (publish/reserve/sell/archive), duplicate,
and delete, always scoped by the authorized tenant inside `withTenantSession`.
Server actions resolve the request user and tenant context, require
`manage_vehicles`, then delegate to the service and revalidate the admin/public
paths. The existing admin list, form, and edit screens are rewired to the
database while preserving the incumbent neutral/amber markup and Indonesian
copy. Dashboard vehicle counts move to the same data source; leads remain mock
for F010. Tests use the PGlite tenant fixtures to prove the full
create → stored → publish → public-visible path plus cross-tenant denial. Visual
QA captures the affected admin surfaces at desktop and mobile widths using a
QA-only fake GoTrue provider so the real proxy/tenant/database code runs.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16.4.0, React 19.

**Primary Dependencies**: Drizzle ORM 0.45 (`postgres` in production), Zod 4,
`@supabase/ssr` 0.12, React Hook Form 7 with `@hookform/resolvers`, Vitest 5,
Playwright 1.64. No new runtime dependency.

**Storage**: Existing F003 PostgreSQL schema (`vehicles`, `vehicle_images`).
Production uses `DATABASE_URL`; development/QA use the existing seeded in-memory
PGlite fallback in `lib/db/runtime.ts`. No migration.

**Testing**: Vitest in the `node` environment using
`tests/unit/tenant/database.ts` and fixtures; shared-schema unit tests; optional
Playwright admin acceptance with a fake GoTrue endpoint; one Visual QA capture.

**Target Platform**: Next.js App Router server runtime, Node.js 24, Supabase
PostgreSQL. Admin data access, tenant resolution, and mutations are server-only.

**Project Type**: Single Next.js application with server libraries and an
embedded PGlite test/development harness.

**Performance Goals**: One tenant-scoped vehicle query plus one image query per
admin list render; one row plus images for edit; each mutation is one
transaction. No per-row query in the list.

**Constraints**: Every read/mutation is tenant-scoped; `manage_vehicles` is
required; the service role never reaches the browser; no image upload (F008); no
visual redesign; slugs are stable on edit.

**Scale/Scope**: Two seed tenants, twelve Prima vehicles, three admin vehicle
routes, one client table, one client form, one service, one action module, one
shared schema, two test suites, one QA script.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled project template; no
ratified principles or bootstrap exist for this feature. Previous phases
recorded the same graceful skip.

**Result**: PASS (no ratified constraints to violate).

## Project Structure

### Documentation (this feature)

```text
specs/006-admin-vehicle-crud/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── admin-vehicle-crud.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
lib/
├── validation/
│   └── vehicle.ts                 # shared Zod schema + slugify
├── admin/
│   ├── context.ts                 # request user + tenant context + db
│   ├── vehicle-mapper.ts          # DB row → admin view model
│   ├── vehicle-queries.ts         # tenant-scoped admin reads
│   ├── vehicle-service.ts         # validated, tenant-scoped mutations
│   └── vehicle-actions.ts         # 'use server' wrappers + revalidation
├── tenant/
│   ├── scoped-queries.ts          # add getTenantVehicleById
│   └── server.ts                  # use getAppDatabase (dev PGlite fallback)
└── actions.ts                     # remove mock vehicle actions

app/admin/
├── page.tsx                       # DB vehicle stats/recent; leads stay mock
└── vehicles/
    ├── page.tsx                   # server list → client table
    ├── new/page.tsx               # form
    └── [id]/edit/page.tsx         # DB lookup → form

components/
├── vehicle-form.tsx               # shared schema + real actions + fields
└── admin/
    └── vehicle-table.tsx          # client list/actions

tests/unit/
├── admin/vehicle-service.test.ts  # create/edit/lifecycle/duplicate/delete/tenant
└── validation/vehicle.test.ts     # shared schema

tests/e2e/admin-vehicles.spec.ts   # UI create → publish → public (QA provider)
scripts/fake-supabase-auth.mjs     # QA-only GoTrue endpoint
scripts/visual-qa-admin.mjs        # admin desktop/mobile capture
playwright.admin.config.ts         # QA acceptance config
```

**Structure Decision**: Single Next.js app. Pure validation/mapping modules stay
importable from the client; modules that touch `db`, `next/headers`, or the
tenant resolver are server-only. The service layer is request-agnostic so the
PGlite tests exercise the same code the actions run.

## Complexity Tracking

No constitution violations. The service/action split is justified by testability:
the service can run under PGlite without a Next request, while the action owns
the request-only auth/tenant resolution.
