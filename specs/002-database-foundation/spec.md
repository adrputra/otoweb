# Feature Specification: Database Foundation

**Feature Branch**: `002-database-foundation`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Database Foundation: install and configure Supabase, Drizzle ORM, and PostgreSQL migrations; implement tenants, tenant_domains, profiles, tenant_members, showroom_settings, vehicles, and vehicle_images tables; add development seeds for Prima Auto Gallery and Tenant B Test Showroom; migrate existing mock vehicle data into seed data; document the schema; preserve the existing UI. Acceptance: schema migration works from an empty database; seed works; existing vehicle mock data exists in DB; schema documented; build passes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Provision the production data store from an empty database (Priority: P1)

A platform engineer can point the project at an empty PostgreSQL database, apply
the project's migrations, and obtain the complete tenant, membership, showroom,
vehicle, and vehicle-image schema with UUID identifiers and referential
integrity. The same migration path works against the Supabase-hosted PostgreSQL
database used in production.

**Why this priority**: Every later phase (authentication, tenant isolation,
database-driven public pages, CRUD, image management, showroom settings, and
leads) depends on this schema existing. Without a reproducible migration from
empty, no later phase can be trusted.

**Independent Test**: Create a fresh empty PostgreSQL database, run the
project's migration command, and verify that the seven required tables exist
with their keys and relationships. The migration command exits 0 and can be
applied to another empty database.

**Acceptance Scenarios**:

1. **Given** an empty PostgreSQL database and a configured connection string,
   **When** the engineer runs the project's migration command, **Then** the
   command exits 0 and the tables `tenants`, `tenant_domains`, `profiles`,
   `tenant_members`, `showroom_settings`, `vehicles`, and `vehicle_images` all
   exist.
2. **Given** the migration has been applied, **When** the schema is inspected,
   **Then** every primary key is a UUID, every tenant-owned table carries a
   tenant reference, and foreign keys enforce the tenant and vehicle
   relationships.
3. **Given** a database with the migration already applied, **When** the
   migration command runs again, **Then** it is safe to re-run and does not
   duplicate or destroy data.

---

### User Story 2 - Seed a realistic development showroom (Priority: P2)

A developer can seed a fresh database with two showrooms: the existing reference
tenant, Prima Auto Gallery, and a second test tenant, Tenant B Test Showroom.
Prima Auto Gallery includes its domain, owner membership, showroom settings, and
all twelve existing mock vehicles with their images and displayed attributes.
Tenant B exists so later tenant-isolation and multi-tenant work has a second,
clearly different showroom to test against.

**Why this priority**: Development and later phases need real rows, not empty
tables. The existing mock vehicle catalogue is the approved content baseline, so
losing or silently altering it would break the future database-driven UI.

**Independent Test**: On a freshly migrated empty database, run the seed
command, then verify that both showroom names exist and that all twelve mock
vehicles plus their images exist under Prima Auto Gallery. Run the seed command
a second time and verify row counts do not double.

**Acceptance Scenarios**:

1. **Given** a freshly migrated database, **When** the developer runs the seed
   command, **Then** the seed exits 0 and both Prima Auto Gallery and Tenant B
   Test Showroom exist as tenants.
2. **Given** the same database after seeding, **When** the vehicle rows are
   queried, **Then** all twelve existing mock vehicles exist with the same
   slugs, brands, models, variants, years, prices, availability/publication
   state, featured flags, features, descriptions, and images as the current mock
   catalogue.
3. **Given** an already seeded database, **When** the seed command runs again,
   **Then** it upserts the same rows and does not create duplicate tenants,
   vehicles, or images.
4. **Given** the seeded database, **When** showroom settings are queried,
   **Then** Prima Auto Gallery's existing contact, address, colours, social, and
   SEO values are present, and Tenant B Test Showroom has distinct settings.

---

### User Story 3 - Verify the database layer without external services (Priority: P3)

A maintainer can run the normal test suite in CI or on a developer machine with
no Docker daemon, no Supabase CLI, and no local PostgreSQL server. The suite
executes the real migration SQL and real seed logic against an embedded
PostgreSQL-compatible database, proves the schema and seed from empty, and the
existing application build and UI remain unchanged.

**Why this priority**: The repository's current environment cannot start Docker
or a local Supabase stack. A migration and seed that are never executed are not
evidence. The verification must be executable and repeatable, and it must not
alter the approved visual baseline.

**Independent Test**: Run the configured quality commands on a machine with no
external database. The unit suite applies the checked-in migrations and seeding
logic to a fresh embedded PostgreSQL database and passes; lint, typecheck, and
build still pass; no presentation file under `app/` or `components/` changes.

**Acceptance Scenarios**:

1. **Given** no external database service, **When** the test suite runs,
   **Then** it starts an embedded PostgreSQL-compatible database, applies the
   checked-in migration SQL from empty, seeds it, and asserts the resulting
   schema and rows.
2. **Given** the embedded-database verification, **When** the seed is run
   twice, **Then** the second run leaves the row counts unchanged.
3. **Given** the completed feature, **When** the application is built and the
   public/admin surfaces are inspected, **Then** the UI still looks and behaves
   as before because no presentation source was redesigned.
4. **Given** the repository, **When** secrets are inspected, **Then** only
   placeholder environment values are committed and no real database or
   Supabase credential is present.

### Edge Cases

- No `DATABASE_URL` is configured in a local shell: migration and seed commands
  must fail with a clear message naming the variable instead of silently using a
  wrong database.
- The seed runs twice: it must upsert deterministic rows rather than duplicate
  tenants, vehicles, or images.
- The database already contains unrelated rows: the seed may only touch its own
  deterministic tenant/vehicle records and must not truncate the database.
- A mock vehicle is a draft or sold/reserved unit: its production status must
  preserve the existing public visibility semantics (`draft` for the draft,
  `sold` for the sold unit, `reserved` for the reserved units, `available`
  otherwise).
- A mock vehicle has no `originalPrice`: the column must allow null rather than
  inventing a value.
- An image has no width/height metadata in the mock source: those columns must
  allow null rather than inventing dimensions.
- Tenant B has no legacy mock vehicles: the seed must not fabricate a vehicle
  catalogue for it.
- A migration is interrupted or partially applied: the migration runner must
  track applied migrations so a re-run completes safely.
- A developer has no Docker or Supabase CLI: verification still runs through the
  embedded PostgreSQL test path, while the production Supabase path is
  documented separately.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST configure Supabase as the production PostgreSQL
  platform, including non-secret environment placeholders for the Supabase
  project URL, anon key, and database connection string, plus a documented
  local/production operating path. No real credential may be committed.
- **FR-002**: The project MUST configure Drizzle ORM with a typed schema module,
  a Drizzle Kit configuration, and a checked-in PostgreSQL migration output
  directory.
- **FR-003**: The project MUST provide SQL migrations that create exactly the
  required tables: `tenants`, `tenant_domains`, `profiles`, `tenant_members`,
  `showroom_settings`, `vehicles`, and `vehicle_images`.
- **FR-004**: Every table MUST use UUID primary keys. Every tenant-owned table
  MUST carry a `tenant_id` reference, and foreign keys MUST enforce ownership
  relationships between tenants, domains, memberships, settings, vehicles, and
  images.
- **FR-005**: The `vehicles` table MUST persist the production vehicle fields
  defined by the roadmap: slug, brand, model, variant, year, transmission, fuel
  type, body type, engine capacity, mileage, colour, price, original price,
  plate region, tax expiry, description, status, featured flag, location,
  features, and created/updated/published/reserved/sold timestamps. It MUST also
  retain the existing mock-only `owner_count` and `documents` values so the
  approved vehicle detail content is not lost during migration.
- **FR-006**: The `vehicle_images` table MUST persist provider, provider asset
  identifier, URL, alt text, position, cover flag, dimensions, and creation
  time, linked to both the tenant and the vehicle.
- **FR-007**: The `showroom_settings` table MUST persist the roadmap showroom
  configuration fields: display name, tagline, description, logo, favicon, hero
  image, primary/secondary colours, phone, WhatsApp, email, address, city,
  province, postal code, Google Maps URL, social URLs, opening hours, SEO title,
  and SEO description.
- **FR-008**: The project MUST provide an idempotent development seed that
  creates Prima Auto Gallery and Tenant B Test Showroom, their domains,
  memberships, and showroom settings.
- **FR-009**: The seed MUST migrate all twelve existing mock vehicles and their
  images into the database with their existing slugs and displayed content, and
  MUST preserve the existing draft, reserved, sold, published, and featured
  semantics through the production status field.
- **FR-010**: The project MUST document the schema, relationships, status
  mapping, environment variables, migration command, seed command, production
  Supabase path, and the embedded-database verification path.
- **FR-011**: The repository's normal test suite MUST execute the checked-in
  migration SQL and seed logic against a fresh embedded PostgreSQL-compatible
  database and assert the required tables, tenants, twelve vehicles, images, and
  idempotency.
- **FR-012**: The existing presentation layer under `app/` and `components/`
  MUST NOT be redesigned or visually changed by this feature.
- **FR-013**: This feature MUST NOT introduce authentication, sessions, tenant
  authorization enforcement, row-level security policies, or any backend API
  integration beyond the database layer. Those belong to later roadmap phases.

### Key Entities

- **Tenant**: A showroom organization. Holds name, slug, lifecycle status,
  plan, theme, and timestamps. Every showroom-scoped record belongs to one
  tenant.
- **Tenant Domain**: A hostname mapped to a tenant, classified as a platform
  subdomain or custom domain, with verification state and timestamp.
- **Profile**: Application user data associated with a Supabase Auth identity.
  Holds full name, avatar, and timestamps.
- **Tenant Member**: The membership linking a profile to a tenant with a role
  (`platform_admin`, `owner`, `staff`) and status. A tenant/user pair is unique.
- **Showroom Settings**: The tenant's public identity and configuration:
  branding, contact details, address, social links, opening hours, and SEO.
- **Vehicle**: A tenant-owned vehicle listing with production status
  (`draft`, `available`, `reserved`, `sold`, `archived`), pricing, specifications,
  JSONB features, and lifecycle timestamps.
- **Vehicle Image**: A tenant-owned, ordered vehicle photo with provider
  metadata, cover flag, alt text, and optional dimensions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Applying the checked-in migrations to a completely empty database
  creates all seven required tables and exits successfully; the same run is
  repeatable without errors.
- **SC-002**: Seeding a freshly migrated database creates exactly two tenants,
  two tenant domains, two showroom settings rows, and twelve Prima Auto Gallery
  vehicles with twelve images.
- **SC-003**: 100% of the twelve existing mock vehicles can be matched in the
  seeded database by slug with identical brand, model, variant, year, price,
  featured flag, features, and image URL; draft/reserved/sold states map to the
  expected production status.
- **SC-004**: Running the seed a second time leaves the counts in SC-002
  unchanged.
- **SC-005**: The normal test suite proves migration-from-empty and seed
  behaviour without Docker, a Supabase CLI, or a local PostgreSQL server.
- **SC-006**: The configured lint, typecheck, test, and build gates all pass.
- **SC-007**: No file under `app/` or `components/` is modified, so the
  approved UI remains visually identical.
- **SC-008**: No real credential appears in the repository; `.env.example`
  contains only placeholder values.

## Assumptions

- Supabase is the production PostgreSQL provider. The application connects to
  the Supabase database with a server-only `DATABASE_URL`; the public Supabase
  URL and anon key are browser-safe project configuration, not secrets.
- The environment cannot run Docker, the Supabase CLI, or a local PostgreSQL
  server. Verification therefore uses an embedded PostgreSQL-compatible engine
  in the existing Vitest suite. The production Supabase migration and seed path
  is documented separately and is the same SQL and seed logic.
- The roadmap's production `vehicles.status` replaces the legacy split between
  `availability` (`available`/`reserved`/`sold`) and `publication`
  (`draft`/`published`/`archived`). The mapping is: draft publication ->
  `draft`; archived publication -> `archived`; otherwise the availability value.
- Legacy mock-only fields that the approved public detail page displays
  (`ownerCount`, `documents`) are retained as nullable compatibility columns so
  the data migration does not discard visible content. They do not add behaviour
  in this phase.
- The `leads` table is listed later in the roadmap's primary-table overview but
  is outside this feature's explicit table list and is deferred to the lead
  capture phase.
- Authentication, membership-based authorization, and row-level security are
  deferred to the authentication and multi-tenant security phases. This feature
  creates the membership and tenant columns they will use but does not enforce
  access rules.
- The existing mock catalogue remains the source of truth for seed content and
  is not deleted or rewritten in this phase; the UI continues to read it until
  the public-website database migration phase.
- UUIDs in the seed are deterministic constants so repeated seeds are
  idempotent and tests can reference stable records. Normal inserts use
  database-generated UUIDs.
- The `plan` and theme values for seeded tenants are ordinary configuration
  strings; the roadmap defines the tenant status values but not a fixed plan
  catalogue.
