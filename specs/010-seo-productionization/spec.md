# Feature Specification: SEO Productionization

**Feature Branch**: `010-seo-productionization`

**Created**: 2026-10-19

**Status**: Ready for planning

**Input**: Roadmap §53 — implement dynamic metadata, OpenGraph, canonical URL,
tenant-specific sitemaps, robots, structured data, and sold listing handling.
Acceptance: sitemaps are tenant-specific and generated HTML is verified, not just
browser-rendered metadata.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Correct, tenant-aware metadata in server HTML (Priority: P1)

A search engine or link-preview bot requests a public showroom route using the
tenant's hostname. The server response already contains a tenant-specific title,
description, canonical URL, and OpenGraph tags. The values come from the
hostname-resolved tenant's showroom settings and the requested page, not from a
single hard-coded showroom.

**Why this priority**: Dynamic, tenant-correct metadata is the core of the
roadmap phase and is the prerequisite for every other discovery surface.

**Independent Test**: Request the home, inventory, and vehicle-detail URLs over
real HTTP for two tenants without executing JavaScript; assert each raw HTML
response contains that tenant's title, description, canonical URL, and
OpenGraph values, and none of the other tenant's identity.

**Acceptance Scenarios**:

1. **Given** a request to a seeded tenant hostname, **When** the server renders
   the home page, **Then** the raw HTML contains the showroom SEO title and
   description with a canonical URL on that hostname.
2. **Given** a request to the inventory page, **When** the server renders it,
   **Then** the raw HTML contains an inventory-specific title, its canonical URL,
   and OpenGraph tags.
3. **Given** a request to a public vehicle detail page, **When** the server
   renders it, **Then** the raw HTML contains the roadmap vehicle title pattern
   (`<Brand> <Model> <Variant> <Year> Bekas <Location> | <Showroom>`), a vehicle
   description, the vehicle cover image as an absolute OpenGraph image, and a
   self-referencing canonical URL.
4. **Given** an unknown or unusable hostname, **When** a public route is
   requested, **Then** no other tenant's metadata is emitted.
5. **Given** a filtered inventory URL such as `/cars?brand=Toyota`, **When** the
   server renders it, **Then** the canonical URL is the clean `/cars` URL.

---

### User Story 2 - Tenant-specific crawl surfaces (Priority: P1)

A crawler requests `robots.txt` and `sitemap.xml` from a showroom hostname. The
responses describe only that tenant's public URLs. A second tenant on the same
deployment receives a different sitemap and a different sitemap reference.

**Why this priority**: The roadmap explicitly requires tenant-specific sitemaps;
a shared or cross-tenant sitemap is a correctness and isolation failure.

**Independent Test**: Fetch `robots.txt` and `sitemap.xml` over HTTP for both
seeded hostnames; assert each sitemap contains only that tenant's home,
inventory, and public vehicle URLs on its own origin, and each robots file
references its own sitemap URL.

**Acceptance Scenarios**:

1. **Given** a request to `robots.txt` on a showroom hostname, **When** the
   server responds, **Then** the body allows public content, disallows admin,
   API, and authentication routes, and advertises that hostname's sitemap.
2. **Given** a request to `sitemap.xml` on a showroom hostname, **When** the
   server responds, **Then** the XML lists the tenant's home, inventory, and
   public vehicle detail URLs on that hostname and no other tenant's URLs.
3. **Given** draft or archived vehicles, **When** the sitemap is generated,
   **Then** they do not appear.
4. **Given** an unknown hostname, **When** either crawl surface is requested,
   **Then** no tenant URLs are disclosed.

---

### User Story 3 - Structured data for showroom and vehicles (Priority: P2)

Search engines parse embedded JSON-LD that identifies the showroom as a local
business and each public vehicle as a vehicle for sale with an offer.

**Why this priority**: Structured data improves rich results but the site is
already discoverable through metadata and sitemaps.

**Independent Test**: Request the home and a vehicle detail page over HTTP and
parse every `application/ld+json` block from the raw HTML; assert the showroom
block is a `LocalBusiness`-compatible type with tenant identity, and the vehicle
block contains `Vehicle`, an `Offer` with a price and availability matching the
stored status.

**Acceptance Scenarios**:

1. **Given** the home page, **When** raw HTML is inspected, **Then** a valid
   JSON-LD `LocalBusiness`/`AutoDealer` object contains the tenant name, URL,
   contact details, and address.
2. **Given** an available vehicle detail page, **When** raw HTML is inspected,
   **Then** the JSON-LD `Vehicle` includes brand, model, year, mileage, price,
   image, canonical URL, and an `Offer` with `InStock`.
3. **Given** a sold vehicle detail page, **When** raw HTML is inspected,
   **Then** the `Offer` availability is `SoldOut`.
4. **Given** showroom or vehicle text containing `<` or `&`, **When** JSON-LD is
   serialized, **Then** the script content cannot break out of its element.

---

### User Story 4 - Deliberate sold-listing policy (Priority: P2)

A visitor follows an old link to a sold vehicle. The page stays reachable,
clearly shows “Terjual”, offers related available vehicles, and exposes a
canonical and structured-data signal that the unit is sold. Old URLs keep their
search value instead of returning a dead end.

**Why this priority**: The roadmap requires deliberate sold handling; deleting
sold pages would lose acquired URLs and search value.

**Independent Test**: Request a known sold vehicle's URL over HTTP; assert a
200 response, a self-referencing canonical URL, “Terjual” rendering, related
available vehicles, `SoldOut` structured data, and presence in that tenant's
sitemap.

**Acceptance Scenarios**:

1. **Given** a sold vehicle, **When** its detail URL is requested, **Then** the
   server responds successfully and the HTML shows “Terjual”.
2. **Given** a sold vehicle, **When** metadata is generated, **Then** the
   canonical points to the sold detail URL itself and the page is not marked
   `noindex`.
3. **Given** a sold vehicle, **When** its structured data is generated, **Then**
   the offer availability is `SoldOut`.
4. **Given** a sold vehicle, **When** the tenant sitemap is generated, **Then**
   the sold detail URL is included.
5. **Given** a sold vehicle, **When** the page renders, **Then** related public
   vehicles are offered so the visitor can continue browsing.

### Edge Cases

- Unknown, malformed, suspended, or unverified hostname: no tenant metadata,
  sitemap, or robots entries are emitted; public pages render not-found.
- Tenant B has no public vehicles: its sitemap still lists home and inventory and
  contains no Prima URLs.
- A vehicle image is a local relative path or a remote provider URL: OpenGraph and
  structured-data image URLs are absolute.
- A showroom has empty SEO title/description: fall back to the display name and
  description/tagline so no page ships an empty title or description.
- A vehicle description is very long: it is truncated to a stable summary length
  in metadata without breaking the structured data.
- Reserved vehicles behave as publicly available listings, with `PreOrder` offer
  availability.
- Filtering or sorting the inventory does not create indexed duplicate URLs; the
  clean `/cars` URL is canonical.
- JSON-LD payloads contain quotes, angle brackets, ampersands, or Unicode line
  separators: serialization stays valid and cannot escape the script element.
- Requests behind a proxy supply `x-forwarded-proto` and `host`: canonical and
  sitemap origins use the forwarded protocol and hostname.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Public metadata MUST be generated per request from the
  hostname-resolved tenant; it MUST NOT use a global hard-coded showroom.
- **FR-002**: The home page MUST use the tenant's stored SEO title and
  description, falling back to the showroom display name and
  description/tagline.
- **FR-003**: The inventory page MUST emit an inventory-specific title and
  description derived from the tenant identity.
- **FR-004**: A vehicle detail page MUST emit a title following
  `<Brand> <Model> <Variant> <Year> Bekas <Location> | <Showroom>` and a
  description derived from the vehicle.
- **FR-005**: Every public page MUST emit an absolute canonical URL. Inventory
  filters and sorts MUST canonicalize to the clean inventory URL.
- **FR-006**: Every public page MUST emit OpenGraph tags (`og:title`,
  `og:description`, `og:url`, `og:site_name`, `og:type`) and an absolute
  OpenGraph image where one exists.
- **FR-007**: `sitemap.xml` MUST be generated per request for the resolved
  tenant and MUST contain only that tenant's home, inventory, and public vehicle
  detail URLs on that tenant's origin.
- **FR-008**: `sitemap.xml` MUST exclude draft and archived vehicles and MUST be
  empty of URLs when no tenant resolves.
- **FR-009**: `robots.txt` MUST be generated per request, allow public routes,
  disallow admin, API, and authentication routes, and reference the resolved
  tenant's sitemap URL.
- **FR-010**: The home page MUST emit JSON-LD describing the showroom as a
  `LocalBusiness`-compatible `AutoDealer` with name, URL, contact details, and
  address.
- **FR-011**: A public vehicle detail page MUST emit JSON-LD describing the
  vehicle with brand, model, year, mileage, price, image, and canonical URL, plus
  an `Offer` whose availability reflects the stored status.
- **FR-012**: Sold vehicles MUST remain accessible with a self-referencing
  canonical URL, MUST render “Terjual”, MUST show related available vehicles,
  MUST use `SoldOut` offer availability, and MUST remain in the tenant sitemap.
- **FR-013**: JSON-LD MUST be serialized safely so stored text cannot terminate
  the script element or inject markup.
- **FR-014**: Metadata, sitemap, robots, and structured data MUST NOT leak another
  tenant's identity, settings, vehicles, or URLs.
- **FR-015**: Verification MUST exercise real HTTP responses and assert tags in
  the raw server HTML/XML, independent of client-side execution.
- **FR-016**: The feature MUST make no visible design change; the incumbent
  public layout, typography, colours, and components remain as-is.

### Key Entities *(include if data involved)*

- **Showroom/tenant**: Hostname-resolved identity and stored settings; provides
  SEO title, description, name, contact, address, logo, and hero image.
- **Vehicle**: Tenant-owned public listing; provides slug, brand, model, variant,
  year, location, description, price, mileage, cover image, status, and update
  time.
- **Crawl surface**: The per-request `sitemap.xml` and `robots.txt` bodies that
  describe one tenant's public URLs and crawl rules.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each seeded tenant, 100% of tested public routes contain the
  correct tenant title, description, canonical, and OpenGraph tags in the raw
  HTTP response.
- **SC-002**: 0 foreign-tenant URLs or identities appear in a tenant's metadata,
  sitemap, robots, or structured data.
- **SC-003**: Each seeded tenant's sitemap contains its home, inventory, and all
  of its public vehicles, and excludes all draft/archived/foreign vehicles.
- **SC-004**: 100% of inspected JSON-LD blocks parse as valid JSON and contain
  the required schema types and values.
- **SC-005**: A sold vehicle URL returns a successful response, shows “Terjual”,
  is self-canonical, is present in its tenant sitemap, and exposes `SoldOut`.
- **SC-006**: Existing typecheck, unit, and tenant-isolation validation commands
  pass with no weakened checks.
- **SC-007**: No visible public-page change is introduced; if the implementation
  needs presentation files, a visual QA pass shows no regression.

## Assumptions

- The canonical origin is the request origin (forwarded protocol plus the
  resolved hostname); custom domains therefore canonicalize to themselves. No
  primary-domain selection exists in the current schema.
- The inventory canonical intentionally drops query parameters; filtered views
  remain usable but are not separately indexed.
- Sold pages are kept indexable and in the sitemap to preserve acquired URLs and
  search value, per roadmap §30 and the target architecture; they are never
  deleted or redirected automatically.
- Structured data uses `AutoDealer` (a `LocalBusiness` subtype) on the home page
  and `Vehicle` + `Offer` on detail pages. `Product`-specific markup is not added
  as a second entity because `Vehicle` already carries the offer.
- `NEXT_PUBLIC_SITE_URL` remains a development fallback only when no request
  hostname exists; production origin always comes from the request.
- Verification runs against the Next.js server over real HTTP without executing
  client JavaScript; the development server uses the repository's seeded
  in-memory database because no production database is available in this
  environment.
