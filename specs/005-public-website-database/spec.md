# Feature Specification: Connect Public Website to Database

**Feature Branch**: `005-public-website-database`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Connect the public website to the database: replace the mock vehicle catalogue used by the public pages with tenant-scoped Drizzle queries, making homepage featured units, inventory listing, vehicle detail, related vehicles, and showroom settings database-driven for the hostname-resolved tenant while preserving the existing visual design. Acceptance: homepage featured units, inventory, vehicle detail, related vehicles, and showroom data are database-driven; no public vehicle data comes from hard-coded mock arrays; featured vehicles are database-driven; filtering works; sorting works; vehicle detail works; tenant showroom settings render; existing visual design is preserved."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a tenant showroom backed by real settings (Priority: P1)

A visitor opens a showroom's public address. The site resolves which showroom
belongs to that address and renders that showroom's name, tagline, description,
hero image, colours, contact details, address, opening hours, social links, and
SEO text from the tenant's stored showroom settings. No showroom facts are
hard-coded to a single brand.

**Why this priority**: The public home is the first proof that the website is
tenant-aware. A single hard-coded showroom would make every later multi-tenant
page dishonest.

**Independent Test**: Open the public home through the Prima hostname and through
the Tenant B hostname. Each renders its own stored showroom name, tagline, hero
image, contact details, and address; neither shows the other's configuration.

**Acceptance Scenarios**:

1. **Given** the seeded Prima showroom, **When** a visitor opens the public home
   through the Prima hostname, **Then** the header, hero, contact section, and
   footer use Prima's stored settings.
2. **Given** the seeded Tenant B showroom, **When** a visitor opens the public
   home through the Tenant B hostname, **Then** the same page renders Tenant B's
   stored name, tagline, colours, and contact details instead of Prima's.
3. **Given** an unknown hostname, **When** a visitor opens the public site,
   **Then** no tenant's data is rendered.

---

### User Story 2 - Browse the tenant inventory with working filters and sorting (Priority: P2)

A visitor opens the inventory page for a tenant. The page lists only that
tenant's public vehicles. The visitor filters by brand, transmission, fuel,
price, year, or mileage and sorts by newest, lowest price, highest price, newest
year, or lowest mileage. The count and the result cards reflect the applied
query.

**Why this priority**: Inventory is the core public browsing task. Filtering and
sorting are explicit acceptance criteria and must operate on real tenant data,
not on a fixed mock list.

**Independent Test**: Seed two tenants with distinct vehicles, request the
inventory with a series of filter and sort combinations, and assert that every
result comes from the requested tenant and matches the requested predicate and
order.

**Acceptance Scenarios**:

1. **Given** a tenant with published vehicles, **When** the visitor opens
   inventory without filters, **Then** every public vehicle for that tenant is
   listed and no other tenant's vehicle appears.
2. **Given** a brand filter, **When** the inventory is requested, **Then** only
   vehicles of that brand for the current tenant are returned.
3. **Given** price, year, mileage, transmission, or fuel filters, **When** the
   inventory is requested, **Then** only matching vehicles are returned.
4. **Given** a sort option, **When** the inventory is requested, **Then** the
   results are ordered accordingly (newest, price ascending/descending, newest
   year, or lowest mileage).
5. **Given** filters that match nothing, **When** the inventory is requested,
   **Then** the existing empty-state message appears and no error is shown.
6. **Given** a draft or archived vehicle, **When** inventory is requested,
   **Then** that vehicle is not exposed publicly.

---

### User Story 3 - Open a vehicle detail page with real specifications and related units (Priority: P3)

A visitor opens a vehicle card. The detail page shows that tenant's stored
vehicle data: price, year, mileage, transmission, fuel, colour, tax date,
ownership, plate, features, description, location, and images. The page also
shows related public vehicles from the same tenant and body type. A sold or
reserved unit keeps its existing badge and WhatsApp behaviour.

**Why this priority**: Vehicle detail is where a visitor decides to contact the
showroom. It must render the stored unit rather than a mock record, and it must
not leak another tenant's vehicles through a guessed slug.

**Independent Test**: Request a seeded vehicle slug for its own tenant and assert
the rendered data matches the stored row. Request the same slug under the other
tenant and assert not-found. Request related units and assert body-type match,
current-unit exclusion, public status, tenant scope, and the three-unit limit.

**Acceptance Scenarios**:

1. **Given** a published vehicle, **When** its detail URL is opened for its own
   tenant, **Then** every displayed field matches the stored vehicle and its
   images.
2. **Given** a draft or archived vehicle, **When** its URL is opened publicly,
   **Then** the page returns not-found.
3. **Given** a slug that belongs to another tenant, **When** it is opened for the
   current tenant, **Then** the page returns not-found rather than showing the
   other tenant's vehicle.
4. **Given** a vehicle with a body type shared by other public units, **When**
   related units are shown, **Then** up to three other public units from the same
   tenant and body type are shown.
5. **Given** a sold or reserved unit, **When** the detail page renders, **Then**
   the existing status badge and WhatsApp call-to-action remain correct.

---

### User Story 4 - Browse featured units on the public home (Priority: P4)

A visitor lands on the public home and sees the tenant's featured units. The
featured set comes from the stored `featured` flag of public vehicles for that
tenant, not from a fixed array or a hard-coded slice.

**Why this priority**: Featured units are an explicit acceptance criterion and
are the main merchandising surface of the home page.

**Independent Test**: Mark a stored vehicle as featured, request the home page,
and assert it appears; unset the flag and assert it disappears. Assert a featured
vehicle from another tenant never appears.

**Acceptance Scenarios**:

1. **Given** stored public vehicles with the featured flag set, **When** the home
   page renders, **Then** exactly those units are shown in the featured grid.
2. **Given** a stored vehicle whose featured flag is not set, **When** the home
   page renders, **Then** it is not in the featured grid.
3. **Given** a featured vehicle that is draft or archived, **When** the home page
   renders, **Then** it is not shown publicly.
4. **Given** a featured vehicle in another tenant, **When** the current tenant's
   home page renders, **Then** it is not shown.

---

### User Story 5 - Preserve the existing public visual design (Priority: P5)

The public home, inventory, and detail pages keep their incumbent neutral and
amber design, typography, spacing, card treatment, header, footer, and responsive
composition. Only the data source and the minimum wiring needed to pass
tenant-derived values change.

**Why this priority**: The roadmap explicitly requires preserving the existing
visual design. A database migration must not become a redesign.

**Independent Test**: Capture desktop and mobile screenshots of the home,
inventory, and detail pages and compare composition against the pre-feature
pages. Assert no horizontal overflow, headings and cards remain in place, and
only tenant-derived copy, counts, and vehicle content differ.

**Acceptance Scenarios**:

1. **Given** the pre-feature public pages, **When** the database-backed pages are
   captured at desktop and mobile widths, **Then** the layout structure, type
   scale, colours, spacing, and component treatment are preserved.
2. **Given** a tenant with a long showroom name, **When** the page renders at
   mobile width, **Then** the header and hero do not overflow horizontally.
3. **Given** the changed public surfaces, **When** visual QA runs, **Then** a
   passing verdict with desktop and mobile screenshots is recorded under
   `.visual-qa/`.

---

### Edge Cases

- The request hostname is unknown, malformed, or maps to a suspended tenant; the
  public site renders no tenant data rather than defaulting to Prima.
- The request hostname includes a port, mixed case, or a trailing dot; it still
  resolves to the correct tenant.
- The showroom settings row is missing for a tenant; the page still renders a
  safe, non-leaking fallback built from the tenant's own identity.
- A vehicle has no image row; the card and detail page render a local
  placeholder instead of crashing.
- `originalPrice` is absent; the detail page omits the struck-through price.
- `ownerCount`, `documents` (STNK/BPKB), or `features` are absent; the page
  renders safe defaults without failing.
- A vehicle's `taxExpiryDate` is a database date; it still formats correctly in
  the detail specification grid.
- Filter parameters arrive as repeated query values, empty strings, or
  non-numeric text; they are ignored rather than applied as `NaN`.
- A price filter is above or below every unit; the empty state is shown.
- Two tenants share the same vehicle slug; each tenant's lookup returns only its
  own unit.
- A vehicle is marked sold or reserved; it remains visible with the correct
  badge, matching the current public behaviour.
- The same request is served after another request for a different tenant; no
  tenant value is cached across requests.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The public home, inventory, and vehicle detail surfaces MUST read
  showroom and vehicle data from the PostgreSQL database through the existing
  Drizzle schema and tenant-scoped access layer. No public vehicle data may come
  from a hard-coded mock array.
- **FR-002**: The public site MUST resolve the active tenant from the request
  hostname through the existing verified-domain resolver. Unknown, malformed,
  inactive, or unverified hostnames MUST NOT fall back to an arbitrary tenant in
  production.
- **FR-003**: Every public showroom and vehicle query MUST be scoped to the
  resolved tenant id using the existing mandatory tenant-scope guard. Cross-
  tenant slugs and ids MUST return not-found or empty results.
- **FR-004**: The home page MUST render the tenant's stored showroom name,
  tagline, description, hero image, contact details, address, opening hours,
  social links, and SEO text, with safe fallbacks for missing optional fields.
  Stored colour values MUST be carried in the showroom view model; applying them
  as a public theme is deferred to the showroom-settings feature (F009) so the
  incumbent palette and contrast safety are preserved.
- **FR-005**: The home page MUST render featured units from stored public
  vehicles whose `featured` flag is true for the active tenant. Draft and
  archived vehicles MUST NOT appear.
- **FR-006**: The inventory page MUST render only public vehicles for the active
  tenant. Public statuses are the stored `available`, `reserved`, and `sold`
  states; `draft` and `archived` MUST NOT be exposed.
- **FR-007**: The inventory page MUST support filtering by brand, model,
  transmission, fuel, year, minimum price, maximum price, and maximum mileage.
  Empty or invalid filter values MUST be ignored.
- **FR-008**: The inventory page MUST support sorting by newest, lowest price,
  highest price, newest year, and lowest mileage, with a deterministic
  tiebreaker.
- **FR-009**: The inventory result count and empty state MUST reflect the
  filtered result set.
- **FR-010**: The vehicle detail page MUST render the stored vehicle's price,
  original price, specifications, features, description, location, and ordered
  images for the active tenant. Missing optional fields MUST degrade safely.
- **FR-011**: The vehicle detail page MUST return not-found for a vehicle that is
  not public or that belongs to another tenant.
- **FR-012**: The detail page MUST show up to three related public vehicles from
  the same tenant and body type, excluding the current vehicle.
- **FR-013**: The existing header, footer, hero, cards, filter controls, and
  responsive layout MUST be preserved. Only tenant-derived values, data sources,
  and the minimum prop wiring may change.
- **FR-014**: The brand options shown in the public quick search and inventory
  filters MUST come from the active tenant's public inventory (or an equivalent
  tenant-scoped source), not from a fixed brand array.
- **FR-015**: The public site MUST render a usable page when the database is
  unavailable only to the extent of failing safely without leaking tenant data;
  it MUST NOT substitute mock catalogue data.
- **FR-016**: The implementation MUST NOT import the legacy mock catalogue into
  public runtime modules. The legacy fixture may remain only for the development
  seed, database tests, and not-yet-migrated admin screens scheduled for later
  phases.
- **FR-017**: The public tenant resolver MUST be server-only and MUST NOT expose
  database credentials, service-role values, or tenant rows to the browser.
- **FR-018**: The automated suite MUST prove tenant-scoped showroom reads,
  vehicle listing, filtering, sorting, featured selection, detail lookup,
  related-vehicle selection, cross-tenant not-found behaviour, and the absence
  of mock-catalogue imports in public runtime modules.
- **FR-019**: The changed public surfaces MUST receive a fresh visual QA verdict
  with desktop and mobile screenshots and report artifacts under `.visual-qa/`
  before the feature can be reported complete.
- **FR-020**: The feature MUST NOT implement admin CRUD, image upload, showroom
  settings editing, lead capture, SEO productionization, or subdomain routing
  beyond the tenant resolution already delivered by F005.

### Key Entities

- **Tenant**: The showroom organization resolved from the request hostname. It
  provides the id used to scope every public query and the identity used for
  safe fallbacks.
- **Showroom settings**: One stored row per tenant containing display name,
  tagline, description, logo, hero image, colours, contact details, address,
  map link, social links, opening hours, and SEO fields. This is the source of
  the public showroom presentation.
- **Vehicle**: A tenant-owned public unit with slug, brand, model, variant, year,
  body type, transmission, fuel, mileage, colour, engine capacity, price,
  original price, plate region, tax expiry, description, status, featured flag,
  location, features, owner count, documents, and timestamps.
- **Vehicle image**: A tenant-owned image for a vehicle with url, alt text,
  position, and cover flag. Ordered images supply the card and detail media.
- **Public vehicle filter**: The normalized brand/model/price/year/transmission/
  fuel/mileage criteria and sort option applied to the tenant's public vehicles.
- **Related vehicle set**: Up to three other public vehicles from the same tenant
  and body type as the current unit.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of public vehicle, image, featured, and showroom values on the
  home, inventory, and detail pages originate from database rows for the resolved
  tenant; zero values originate from public runtime mock arrays.
- **SC-002**: 100% of cross-tenant vehicle slug and id lookups return not-found or
  empty results, and no other tenant's vehicle appears in inventory, featured, or
  related results.
- **SC-003**: Every supported filter and sort option returns a result set that
  matches the requested predicate and order, verified by automated tests.
- **SC-004**: Draft and archived vehicles appear in zero public listings or
  detail responses.
- **SC-005**: The Prima and Tenant B hostnames render their own stored showroom
  settings, while unknown hostnames render no tenant data.
- **SC-006**: Desktop (1440×900) and mobile (390×844) captures of the changed
  public routes show no horizontal overflow and preserve the incumbent layout;
  the visual QA report verdict is PASS.
- **SC-007**: `npx tsc --noEmit` and `npm test` exit 0 on the delivered
  repository.
- **SC-008**: No public runtime module imports the legacy mock catalogue; the
  boundary is enforced by an automated source scan.

## Assumptions

- The seeded Prima and Tenant B showrooms remain the fixtures. Prima has twelve
  vehicles and images; Tenant B has showroom settings but no legacy catalogue.
- The database may be a live PostgreSQL/Supabase instance in production. In this
  repository's development and test environment there is no PostgreSQL server or
  Docker, so the existing PGlite harness is used for database tests and a
  development-only embedded database fallback may be used to render the public
  site locally. Production still requires `DATABASE_URL`.
- The existing `lib/tenant/hostname.ts` resolver is authoritative for public
  tenant resolution. A development-only convenience fallback may resolve the
  configured showroom slug when the local hostname does not match a seeded
  domain; it is disabled in production and never substitutes for an unknown
  hostname in production.
- Public vehicles are the stored statuses `available`, `reserved`, and `sold`,
  matching the existing mock behaviour that showed reserved and sold units with
  badges. Draft and archived units stay private.
- The existing showroom settings schema does not store hero headline,
  subheadline, or CTA copy. Those presentation strings are derived from stored
  showroom fields (name, tagline, description) and the existing UI label, not
  from a new per-tenant content model. F009 remains responsible for editable
  settings.
- The legacy `data/index.ts` catalogue may remain as the source of deterministic
  development seed rows and database-test expectations. It is not a public
  runtime data source after this feature.
- Admin screens continue to use their current mock data until F007/F009/F010
  migrate them. This feature changes only the public data path and the minimum
  shared repository wiring needed to keep the existing admin dashboard
  behaviour.
