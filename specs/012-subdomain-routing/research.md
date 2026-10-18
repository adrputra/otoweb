# Research: Subdomain Routing

**Feature**: `012-subdomain-routing` | **Date**: 2026-10-19

## Decision: Resolve wildcard hosts by tenant slug

**Decision**: After an exact `tenant_domains` lookup fails, treat a single-label
subdomain of the configured platform root as a tenant slug. A hostname such as
`prima-auto-gallery.otoweb.id` resolves to the tenant with slug
`prima-auto-gallery`.

**Rationale**: The slug is the stable public identity already used by the
development fallback and platform validation. It requires no duplicate mapping
table and makes any tenant reachable as `<slug>.<root>` without a per-host
deployment change. Exact registered hostnames still cover branded or legacy
labels such as `prima.otoweb.id`.

**Alternatives considered**:
- Require a `tenant_domains` row for every host. Rejected: this is per-tenant
  configuration, not wildcard routing, and leaves new tenants unreachable until
  an operator adds a row.
- Rewrite requests in middleware to an internal path. Rejected: the App Router
  already reads the `Host` header in server components; a rewrite would add a
  second source of truth for the tenant and complicate SEO origin handling.
- Decode a tenant id into the hostname. Rejected: opaque identifiers are worse
  for users, SEO, and operability than the existing slug.

## Decision: Exact registered domains are authoritative and never fall through

**Decision**: If a hostname matches a `tenant_domains` row, that row decides the
result. An inactive or unverified row returns `unknown_hostname` and an unusable
tenant returns `tenant_unavailable`; neither continues to wildcard inference.

**Rationale**: Operators disable a domain to stop that hostname. Falling through
to wildcard would silently defeat the control. It also keeps F014 custom-domain
verification behavior compatible.

**Alternatives considered**:
- Always try wildcard after an exact miss. Rejected: it would make disabled
  domains continue serving through a slug alias.
- Prefer wildcard over exact rows. Rejected: explicit registration must win.

## Decision: Configure the platform root with `TENANT_ROOT_DOMAIN`

**Decision**: Read an optional server-only `TENANT_ROOT_DOMAIN`, defaulting to
`otoweb.id`. In development and tests, also accept `localhost` as a root.
Production never accepts `localhost`.

**Rationale**: The root differs between production, QA, and local environments.
A single server-only value is enough; no browser bundle needs it. Excluding
`localhost` in production prevents a forged `Host: tenant.localhost` from
resolving a tenant on a public deployment.

**Alternatives considered**:
- Hardcode `otoweb.id`. Rejected: no staging/QA root and no test isolation.
- Derive the root from `NEXT_PUBLIC_SITE_URL`. Rejected: that value is a
  canonical origin, may include a path or port, and is not a tenant root.
- Allow any domain suffix. Rejected: turns arbitrary attacker-controlled hosts
  into tenant lookups and conflicts with F014 custom-domain verification.

## Decision: Development aliases come from platform-subdomain labels

**Decision**: Under the `localhost` root, first try slug resolution. If that
fails, look for exactly one active, verified `platform_subdomain` whose first
DNS label equals the requested label (for example `prima.otoweb.id` provides
`prima.localhost`). Multiple matches are ambiguous and fail closed.

**Rationale**: The roadmap names `prima.localhost` and `tenant-b.localhost`, but
the seeded slugs are longer (`prima-auto-gallery`, `tenant-b-test-showroom`).
Deriving the short alias from the configured platform subdomain keeps the
suggested hosts working without adding dev-only rows to `tenant_domains` or
changing the public slugs. Slug hosts (`prima-auto-gallery.localhost`) also work
through the normal wildcard path.

**Alternatives considered**:
- Add `prima.localhost` / `tenant-b.localhost` rows to the seed. Rejected: it
  changes domain counts and fixtures, conflates local hostnames with production
  registrations, and does not help newly created tenants.
- Rename seed slugs to `prima` / `tenant-b`. Rejected: public identity and many
  tests depend on the current slugs.
- Require developers to edit the hosts file or Chromium resolver rules. Rejected:
  `*.localhost` already resolves to loopback in modern browsers; this is not
  "easy tenant testing".

## Decision: Keep the bare-loopback development default, narrow its scope

**Decision**: `resolvePublicTenant` may fall back to
`NEXT_PUBLIC_SHOWROOM_SLUG` only when the normalized host is `localhost` or
`127.0.0.1`. Unknown named local subdomains and unknown production hosts return
no tenant.

**Rationale**: `next dev` at `http://localhost:3000` should keep working. The
current fallback applies to every unmatched host in development, which would
make `unknown.localhost` render Prima and hide routing bugs. Restricting it to
bare loopback hosts keeps the convenience while making wildcard failures
honest.

**Alternatives considered**:
- Remove the fallback entirely. Rejected: regresses the documented developer
  default and bare-localhost workflow.
- Keep the broad fallback. Rejected: masks unknown-host behavior and undermines
  the wildcard proof.

## Decision: Prove routing with raw HTTP and browser captures

**Decision**: Add a raw-HTTP Playwright spec for the host matrix (exact hosts,
wildcard slug hosts, localhost aliases, unknown hosts) and a focused
desktop/mobile visual script for the two acceptance hostnames.

**Rationale**: Raw HTTP proves the generated server response, including
branding, inventory, and contact details, without hydration. Browser captures
prove the rendered public surfaces, responsive layout, and absence of
cross-tenant leaks. This reuses the existing Chromium host-resolver and visual
QA conventions instead of introducing a new harness.

**Alternatives considered**:
- Browser-only tests. Rejected: they do not prove server-side resolution and
  metadata for all hosts.
- Rewriting the F006 visual script. Rejected: it is existing evidence for a
  different feature; a focused script keeps both reports stable.
