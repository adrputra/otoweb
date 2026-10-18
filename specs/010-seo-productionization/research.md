# Research: SEO Productionization

## Runtime metadata strategy

**Decision**: Use per-route `generateMetadata` backed by a shared `lib/seo/`
builder; keep `showroomMetadata()` as the facade.

**Rationale**: The App Router already renders these routes dynamically because
they read request headers and the database. A shared builder keeps title,
description, canonical, OpenGraph, and robots rules consistent and unit-testable.
The existing pages already call `showroomMetadata()`, so extending its signature
minimizes churn.

**Alternatives considered**:

- Root layout metadata only: rejected because it cannot be hostname-aware and
  would leak one tenant's identity to another.
- Mutating metadata inside page components: rejected because Next.js expects
  metadata through the metadata API, not arbitrary DOM mutation.

## Dynamic sitemap and robots

**Decision**: Use `app/sitemap.ts` and `app/robots.ts` with `headers()` and
`export const dynamic = 'force-dynamic'`.

**Rationale**: Next.js metadata routes are cached unless they use request-time
APIs. Both routes resolve the tenant from the Host header, which makes the
request-time dependency explicit and prevents one tenant's sitemap from being
served to another host. The returned `MetadataRoute` objects produce the
standard XML and text bodies, which can be fetched and asserted as raw HTTP.

**Alternatives considered**:

- Static `public/robots.txt` / `public/sitemap.xml`: rejected because they
  cannot be tenant-specific.
- Route handlers under `app/sitemap.xml/route.ts`: viable, but the metadata-file
  convention is the idiomatic Next.js surface and yields the same raw output.

## Canonical origin and hostnames

**Decision**: Derive the canonical origin from the request's forwarded host and
protocol; validate the host; fall back to `NEXT_PUBLIC_SITE_URL` only when no
request host exists.

**Rationale**: Tenants may use platform subdomains or custom domains. The
current schema has no primary-domain flag, so canonicalizing to the request
origin is the only tenant-correct choice without a schema change. In
development this preserves the port (`prima.otoweb.id:3000`).

**Alternatives considered**:

- Always use `NEXT_PUBLIC_SITE_URL`: rejected because it would canonicalize all
  tenants to one hostname and break white-label domains.
- Add a primary-domain column: deferred; not required by the roadmap phase and
  would expand the schema/feature scope.

## OpenGraph image selection

**Decision**: Home and inventory use the showroom logo when present, otherwise
the hero image; vehicle detail uses the cover image. All image URLs are resolved
against the request origin.

**Rationale**: The current data model always provides a hero image fallback and
a vehicle cover fallback (`/placeholder.jpg`), so an absolute image is always
available without new upload fields or dependencies.

## Structured data

**Decision**: Home emits `AutoDealer` typed as
`["LocalBusiness", "AutoDealer"]`; detail emits `Vehicle` with a nested `Offer`.

**Rationale**: `AutoDealer` is the Schema.org subtype for a car dealership and
`LocalBusiness` satisfies the roadmap's explicit entity suggestion. `Vehicle`
already supports `offers`, so a separate `Product` node would duplicate the same
entity and conflict with the vehicle-specific properties.

**Alternatives considered**:

- `Product` with `additionalType: Vehicle`: rejected because it loses
  vehicle-specific fields such as mileage and model year.
- Both `Vehicle` and `Product` nodes for the same URL: rejected as duplicate,
  lower-quality markup.

## Sold listing policy

**Decision**: Keep sold detail pages reachable, self-canonical, indexable, in
the tenant sitemap, and marked `SoldOut`, with related `available`/`reserved`
vehicles.

**Rationale**: Roadmap §30 says not to delete sold pages because the acquired
URL and search value should be preserved. The target architecture repeats that
sold pages remain accessible and show “Terjual” with related available vehicles.
`noindex` would discard the search value the roadmap explicitly wants to keep.
The public inventory still lists sold units (existing behavior), and the sitemap
only includes public statuses (`available`, `reserved`, `sold`).

**Alternatives considered**:

- `noindex` and removal from the sitemap: rejected because it contradicts the
  roadmap's "preserve search value" intent.
- Redirect sold pages to `/cars`: rejected because it destroys the acquired URL
  and the unit's history.

## Raw HTML verification

**Decision**: Add a Playwright test that issues raw Node `http.request` calls to
the running Next.js server with an explicit `Host` header and asserts the raw
HTML/XML body.

**Rationale**: The acceptance criterion explicitly requires generated HTML, not
browser-rendered metadata. `http.request` never runs JavaScript and exercises the
same hostname-based tenant resolution as production. The development server is
used because the repository has no production database in this environment; the
response is still server-generated HTML/XML.

**Alternatives considered**:

- `page.goto` + `page.locator('meta')`: rejected because it proves the DOM, not
  the server response.
- A browser `request` fixture: host-resolver rules are a Chromium launch option
  and do not apply to the Node API request context; explicit `Host` headers are
  deterministic.

## Safe JSON-LD serialization

**Decision**: Serialize with `JSON.stringify`, then escape `<`, `>`, `&`,
U+2028, and U+2029 before rendering inside a `<script type="application/ld+json">`.

**Rationale**: Prevents tenant-controlled strings (showroom description,
vehicle description) from closing the script element or creating HTML. The
serialized value remains valid JSON-LD.
