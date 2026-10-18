# Feature Specification: Admin Vehicle CRUD

**Feature Branch**: `006-admin-vehicle-crud`

**Created**: 2026-10-19

**Status**: Ready for planning

**Input**: Roadmap §49 — connect the existing admin vehicle UI to the database and implement create, edit, publish, reserve, sell, archive, duplicate, and delete with server-side validation and shared Zod schemas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and publish a vehicle (Priority: P1)

A signed-in showroom admin opens the existing admin vehicle form, enters a new
unit, saves it as a draft, then publishes it. The unit becomes visible in the
public inventory and on its public detail page without any manual database
operation.

**Why this priority**: This is the roadmap's end-to-end acceptance path and the
core value of the phase; without it the admin surface cannot feed the public
site.

**Independent Test**: Create a vehicle through the admin form, assert the row is
stored tenant-scoped with `status = 'draft'`, publish it, then load
`/cars/{slug}` and `/cars` for the same tenant and assert the unit is visible.

**Acceptance Scenarios**:

1. **Given** a valid form, **When** the admin saves a draft, **Then** a vehicle
   row exists for the admin's tenant with `status = 'draft'` and the admin list
   shows it.
2. **Given** a stored draft, **When** the admin publishes it, **Then**
   `status` becomes `available`, `published_at` is set, and the public
   inventory/detail include it.
3. **Given** invalid or missing fields, **When** the admin submits, **Then** the
   server rejects the request with field-level validation errors and no row is
   written.

---

### User Story 2 - Edit an existing vehicle (Priority: P2)

An admin opens an existing vehicle from the admin list, changes its fields and
publication state, and saves. The stored row and the public view reflect the
change.

**Why this priority**: Vehicles change price, mileage, description, and
availability; editing is required for day-to-day operation.

**Independent Test**: Load a seeded vehicle in the edit form, change the price
and description, save, then re-read the row and the public detail page.

**Acceptance Scenarios**:

1. **Given** a seeded vehicle, **When** the admin edits and saves, **Then** the
   database row is updated for the same tenant and the list reflects it.
2. **Given** a published vehicle, **When** the admin changes it to draft,
   **Then** it is removed from the public inventory/detail.

---

### User Story 3 - Manage lifecycle states (Priority: P3)

An admin publishes, reserves, sells, archives, duplicates, and deletes vehicles
from the existing admin list actions.

**Why this priority**: The roadmap requires every existing admin action to work
against real data, not in-memory mocks.

**Independent Test**: For a tenant vehicle apply reserve, sell, archive,
duplicate, and delete in turn and assert the stored status, copy, and deletion
each time. Cross-tenant attempts are rejected.

**Acceptance Scenarios**:

1. **Given** an available vehicle, **When** the admin marks it reserved, **Then**
   `status = 'reserved'` and `reserved_at` is set.
2. **Given** an available or reserved vehicle, **When** the admin marks it sold,
   **Then** `status = 'sold'` and `sold_at` is set.
3. **Given** a public vehicle, **When** the admin archives it, **Then**
   `status = 'archived'` and it disappears from public queries.
4. **Given** a vehicle, **When** the admin duplicates it, **Then** a new
   tenant-scoped draft copy exists with a unique slug and copied images.
5. **Given** a vehicle, **When** the admin deletes it, **Then** the row (and its
   images via cascade) is removed and it is gone from both admin and public
   reads.

---

### User Story 4 - Enforce tenant and permission boundaries (Priority: P4)

Every admin vehicle read and mutation is tenant-scoped and capability-checked;
one showroom can never read or mutate another showroom's vehicles.

**Why this priority**: F005 established the multi-tenant security contract; the
first write surface must not weaken it.

**Independent Test**: Run the vehicle service against the PGlite tenant fixtures
as Prima and as Tenant B and assert cross-tenant reads return nothing and
cross-tenant mutations return not-found.

**Acceptance Scenarios**:

1. **Given** a Prima vehicle id, **When** a Tenant B admin tries to edit,
   publish, duplicate, or delete it, **Then** the operation is rejected and no
   row changes.
2. **Given** a user without `manage_vehicles`, **When** any vehicle mutation is
   attempted, **Then** it is rejected before SQL.

---

### Edge Cases

- A duplicate slug generated from brand/model/variant/year already exists in the
  tenant: append a numeric suffix until unique.
- An unknown or malformed vehicle id: treat as not found / validation error,
  never a cross-tenant lookup.
- A vehicle with no images: the public mapper keeps the existing placeholder
  behaviour.
- Archived vehicles are writable by the admin but never public.
- Deleting a vehicle must not leave orphan image rows (FK cascade).
- Concurrent saves use optimistic-friendly last-write-wins; no partial rows are
  left because each mutation is a single transaction.
- Image upload/reordering/cover persistence belongs to Phase 8 (F008). F007
  preserves stored image URLs and does not persist newly added browser-only
  previews.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The admin vehicle list MUST read the active tenant's vehicles from
  PostgreSQL instead of the legacy mock array.
- **FR-002**: The admin create form MUST persist a new vehicle for the active
  tenant with all schema-required columns.
- **FR-003**: The admin edit page MUST load the active tenant's vehicle by id and
  persist edits.
- **FR-004**: Admins MUST be able to publish a draft (and republish an archived
  unit) so it becomes publicly visible.
- **FR-005**: Admins MUST be able to reserve an available unit and sell an
  available or reserved unit.
- **FR-006**: Admins MUST be able to archive a unit and delete a unit.
- **FR-007**: Admins MUST be able to duplicate a unit into a draft copy with a
  unique slug.
- **FR-008**: Every mutation MUST validate input with Zod on the server; the same
  schema MUST drive client-side form validation where practical.
- **FR-009**: Every admin read and mutation MUST resolve the authenticated
  tenant context, require `manage_vehicles`, and scope SQL by tenant id inside
  the RLS transaction session.
- **FR-010**: Publishing MUST result in the vehicle appearing in existing public
  queries (`/cars`, `/cars/{slug}`, featured when flagged) with no manual DB
  step.
- **FR-011**: Failed validation or authorization MUST NOT write or partially
  write data.
- **FR-012**: The existing neutral/amber admin visual design and Indonesian copy
  MUST be preserved; this feature connects data, it does not redesign.

### Key Entities *(include if feature involves data)*

- **Vehicle**: tenant-owned unit with slug, brand/model/variant/year, price,
  transmission, fuel, body type, engine capacity, mileage, colour, plate region,
  tax expiry, description, status (`draft | available | reserved | sold |
  archived`), featured flag, location, features, owner count, documents, image
  relations, and lifecycle timestamps.
- **VehicleImage**: tenant-owned image rows copied when duplicating a vehicle
  and removed by cascade when deleting it.
- **TenantContext**: resolved user + tenant + role used to authorize
  `manage_vehicles` and set RLS session values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create, publish, and see a new vehicle on the public
  site in one browser session without touching SQL.
- **SC-002**: All eight required operations (create, edit, publish, reserve,
  sell, archive, duplicate, delete) succeed against the tenant fixtures in
  automated tests.
- **SC-003**: Cross-tenant read and mutation attempts return zero rows / not
  found in automated tests.
- **SC-004**: `npx tsc --noEmit` and `npm test` pass at the checkpoint.
- **SC-005**: Visual QA captures the admin vehicle list, form, and edit surfaces
  at desktop 1440×900 and mobile 390×844 with a PASS verdict.

## Assumptions

- The F003 schema (`vehicles`, `vehicle_images`) is authoritative; no migration
  is required for F007.
- `status` folds publication and availability per `docs/PUBLIC_SITE.md`:
  `draft`/`archived` are private; `available`/`reserved`/`sold` are public.
- Image upload and ordering persistence are Phase 8 (F008). F007 does not
  implement media upload.
- Admin authentication and tenant resolution from F004/F005 are reused; no new
  auth surface is introduced.
- Existing `data/index.ts` stays as the deterministic development seed/test
  fixture, matching the F006 boundary.
