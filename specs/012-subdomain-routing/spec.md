# Feature Specification: Subdomain Routing

**Feature Branch**: `012-subdomain-routing`

**Created**: 2026-10-19

**Status**: Draft

**Input**: Roadmap Phase 13 — implement wildcard tenant routing for production hosts such as `prima.otoweb.id`, provide easy local tenant testing such as `prima.localhost` and `tenant-b.localhost`, and prove that two hostnames display different showroom branding, inventory, and contact details from one deployment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reach the right showroom from a tenant hostname (Priority: P1)

A visitor opens a showroom hostname such as `prima.otoweb.id` or `tenant-b.otoweb.id`. The deployment resolves the hostname to exactly one showroom and renders that showroom's branding, inventory, and contact details. The same deployment serves every showroom; a hostname never falls back to a different showroom.

**Why this priority**: This is the production routing contract. Without it, the multi-tenant public site cannot be served from wildcard DNS.

**Independent Test**: Start one deployment, request the site with two different tenant hostnames, and verify that each response contains only its own showroom name, inventory, and contact details.

**Acceptance Scenarios**:

1. **Given** the deployment is running with the seeded Prima and Tenant B showrooms, **When** a visitor opens `prima.otoweb.id`, **Then** the page shows Prima Auto Gallery branding, Prima inventory, and Prima contact details.
2. **Given** the same deployment, **When** a visitor opens `tenant-b.otoweb.id`, **Then** the page shows Tenant B Test Showroom branding, Tenant B contact details, and none of Prima's inventory or identity.
3. **Given** a tenant whose hostname is not individually registered but whose identifier is a valid subdomain of the platform root, **When** a visitor opens that hostname, **Then** the tenant is resolved by wildcard routing without a per-host deployment change.
4. **Given** an unknown, malformed, or non-platform hostname, **When** a visitor opens it, **Then** the site returns not-found and never renders a default showroom.

---

### User Story 2 - Test multiple tenants locally without manual host mapping (Priority: P2)

A developer starts the app locally and opens short tenant hostnames such as `prima.localhost` and `tenant-b.localhost`. Each hostname shows the matching seeded showroom, so cross-tenant behavior can be exercised in a browser without editing DNS, the hosts file, or request headers.

**Why this priority**: The acceptance proof depends on exercising two tenants in development. A documented, low-friction local strategy keeps the routing testable and prevents ad-hoc workarounds.

**Independent Test**: Start `next dev`, open `prima.localhost` and `tenant-b.localhost` in a browser, and compare branding, inventory, and contact details. Open an unknown local subdomain and confirm it does not silently render Prima.

**Acceptance Scenarios**:

1. **Given** the local development server and the seeded fixtures, **When** the developer opens `prima.localhost`, **Then** the Prima showroom renders.
2. **Given** the same server, **When** the developer opens `tenant-b.localhost`, **Then** the Tenant B showroom renders with its own contact details.
3. **Given** the same server, **When** the developer opens an unknown `*.localhost` hostname, **Then** the site fails closed rather than showing a default showroom.
4. **Given** the developer opens the bare `localhost` or loopback address, **When** no tenant hostname is supplied, **Then** the existing documented development default still applies.

---

### User Story 3 - Keep hostname resolution safe and predictable (Priority: P3)

An operator relies on explicit domain records and tenant status to control public access. Exact registered hostnames remain authoritative, disabled domains and suspended tenants stop serving, and wildcard routing only applies to the platform root rather than arbitrary domains.

**Why this priority**: Wildcard routing must not become an authorization bypass or a source of accidental cross-tenant aliases.

**Independent Test**: Disable a registered domain, suspend a tenant, and request hosts under and outside the platform root. Confirm the domain, tenant, and non-platform host all fail closed while unrelated tenants are unaffected.

**Acceptance Scenarios**:

1. **Given** an exact registered hostname, **When** it is requested, **Then** the exact domain record is used before any wildcard inference.
2. **Given** a registered hostname whose domain record is inactive or unverified, **When** it is requested, **Then** it does not resolve through wildcard fallback.
3. **Given** a tenant whose lifecycle status is suspended or disabled, **When** its hostname is requested, **Then** the request fails closed.
4. **Given** a hostname under a non-platform domain such as another company's domain, **When** it is requested, **Then** wildcard inference does not apply.

---

### Edge Cases

- Hostname casing, a numeric port, or one trailing dot is normalized before resolution.
- A hostname with multiple subdomain labels is not treated as a tenant identifier unless it exactly matches a registered domain.
- A hostname that merely ends with the platform root as part of a longer unrelated domain is rejected.
- Two tenants cannot both answer to the same short development alias; an ambiguous alias fails closed.
- Bare loopback development hosts keep the documented default-tenant convenience; an unknown named local subdomain does not.
- Existing all-tenant public surfaces (metadata, sitemap, robots, contact form, WhatsApp tracking) keep using the hostname-resolved tenant.
- Custom-domain behavior remains out of scope for this feature; only the platform root participates in wildcard routing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST resolve a tenant from a valid single-label subdomain of the configured platform root, even when no per-hostname record exists for that host.
- **FR-002**: The system MUST continue to treat an active, verified registered hostname as authoritative before wildcard inference.
- **FR-003**: An inactive or unverified registered hostname MUST fail closed and MUST NOT fall through to wildcard inference.
- **FR-004**: Only tenants in a usable lifecycle state (active or trial) MAY be served; suspended or disabled tenants MUST fail closed.
- **FR-005**: Unknown, malformed, multi-label, non-platform, or ambiguous hostnames MUST NOT resolve to a tenant and MUST NOT fall back to a default showroom outside the documented development convenience.
- **FR-006**: Development MUST support short tenant hostnames of the form `<tenant-alias>.localhost` for the seeded showrooms, with a documented way to discover each alias.
- **FR-007**: The bare `localhost`/loopback development convenience MUST remain available and MUST be limited to loopback hosts, not every unmatched host.
- **FR-008**: The same deployment MUST serve at least two tenant hostnames with visibly different showroom branding, inventory, and contact details.
- **FR-009**: Tenant-scoped public reads (showroom settings, inventory, vehicle detail, metadata, sitemap, robots, lead submission, WhatsApp redirect) MUST remain scoped to the hostname-resolved tenant.
- **FR-010**: Hostname normalization MUST accept case differences, a numeric port, and one trailing dot, and MUST reject paths, queries, userinfo, spaces, IPv6 literals, and malformed labels.
- **FR-011**: The platform root MUST be configurable per deployment and MUST default to the documented production root; local development MUST support the `localhost` root.
- **FR-012**: The resolution behavior and development strategy MUST be documented for operators and developers.
- **FR-013**: Existing exact-host flows (showroom admin, platform administration, SEO origin) MUST continue to resolve tenants exactly as before.

### Key Entities

- **Tenant**: A showroom identity with a stable identifier, a public slug, and a lifecycle status.
- **Platform Domain**: The deployment-owned root domain under which tenant subdomains are served.
- **Tenant Domain**: A registered hostname for a tenant, with optional custom-domain entries, a status, and verification metadata.
- **Development Alias**: A short local label mapped to a seeded tenant for testing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Two different tenant hostnames served by one deployment return different showroom names, different inventory contents, and different contact details in 100% of verification runs.
- **SC-002**: A wildcard hostname that has no per-host registration but matches a tenant identifier resolves successfully, while an unknown identifier returns not-found (0 default-tenant fallbacks).
- **SC-003**: In development, `prima.localhost` and `tenant-b.localhost` render their respective seeded showrooms in both desktop and mobile browser captures.
- **SC-004**: Cross-tenant leakage checks find zero occurrences of the other showroom's name, contact details, or vehicle inventory in either hostname's response.
- **SC-005**: Disabling a registered domain or suspending a tenant results in 0 successful requests through the affected hostname.
- **SC-006**: The documented development strategy requires no DNS, hosts-file, or browser-extension edits beyond standard `*.localhost` loopback behavior.

## Assumptions

- The platform owns a production root such as `otoweb.id`; DNS for `*.otoweb.id` points at the deployment. Certificates for wildcard hosts are an infrastructure concern outside this feature.
- The seeded Prima and Tenant B showrooms remain the acceptance fixtures. Tenant B may have an empty public inventory; proving that it does not expose Prima inventory satisfies the "different inventory" criterion.
- Exact registered hostnames continue to come from the existing tenant-domain records managed by platform administration.
- Custom-domain verification, DNS instructions, and SSL provisioning belong to Phase 14 and are not implemented here.
- Local `*.localhost` hostnames resolve to loopback in modern browsers; no application-level host mapping is required.
- The development default tenant remains an explicit, documented convenience for bare loopback hosts only.
