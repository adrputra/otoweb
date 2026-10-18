# Feature Specification: Custom Domains

**Feature Branch**: `013-custom-domains`

**Created**: 2026-10-19

**Status**: Draft

**Input**: Roadmap Phase 14 — after wildcard subdomains are stable, implement domain registration, verification state, DNS instructions, domain routing, and SSL provisioning integration. Keep the platform subdomain available as a fallback.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register a showroom's custom domain and receive DNS instructions (Priority: P1)

A platform operator opens a tenant in the platform console, enters the showroom's own hostname (for example `showroom.example.com`), and registers it. The console stores the registration as pending and immediately shows the exact DNS records the showroom owner must publish: a verification record proving domain ownership and a routing record pointing the hostname at the platform.

**Why this priority**: Registration and instructions are the entry point for every custom-domain lifecycle. Without them an operator cannot start verification or explain the required DNS work.

**Independent Test**: Open a tenant detail page as a platform operator, register a new custom hostname, and confirm the pending record plus both DNS instructions appear without any external service call.

**Acceptance Scenarios**:

1. **Given** an authenticated platform operator and a tenant with a platform subdomain, **When** the operator registers `showroom.example.com`, **Then** the domain is stored as pending for that tenant and the page shows the hostname with a pending verification state.
2. **Given** a newly registered custom domain, **When** the operator reads the DNS instructions, **Then** the console shows a TXT record for ownership verification and a CNAME record for routing, each with an exact record name and target value.
3. **Given** a hostname already used by another tenant, **When** the operator registers it, **Then** the registration is rejected with a conflict and no record changes.
4. **Given** a hostname under the platform's own tenant root (for example `new.otoweb.id`), **When** the operator registers it as a custom domain, **Then** the registration is rejected because platform subdomains are managed separately.
5. **Given** a malformed or single-label hostname, **When** the operator registers it, **Then** the registration is rejected with a field error and no record changes.

---

### User Story 2 - Verify ownership and provision SSL before the domain serves traffic (Priority: P1)

After the showroom publishes the DNS records, the platform operator triggers verification. The console reports the current verification state, and once DNS ownership is confirmed it provisions a certificate through the configured provider. The domain becomes routable only when ownership is verified and the certificate is active.

**Why this priority**: Routing an unverified or unencrypted hostname would let an unrelated party claim a showroom's domain and would serve traffic without TLS. Verification and certificate state are the safety contract.

**Independent Test**: Register a custom domain, run verification with a deterministic fake provider, and confirm the stored states move from pending to verified and from no certificate to active; then confirm the same hostname resolves to the tenant.

**Acceptance Scenarios**:

1. **Given** a pending custom domain with its DNS records published, **When** the operator runs verification and the provider confirms ownership and an active certificate, **Then** the domain state becomes verified, its certificate state becomes active, and the hostname resolves to the tenant.
2. **Given** the provider reports that DNS is still propagating, **When** the operator runs verification, **Then** the domain stays pending, the last-check time is recorded, and the console explains that the records are not visible yet.
3. **Given** the provider reports a DNS mismatch, **When** the operator runs verification, **Then** the verification state becomes failed, the domain does not route, and the operator can retry.
4. **Given** ownership is verified but certificate provisioning fails, **When** the operator runs verification, **Then** the certificate state becomes failed, the domain does not route, and retrying verification is possible.
5. **Given** a domain that is not yet verified or whose certificate is not active, **When** a visitor requests the custom hostname, **Then** the site fails closed instead of rendering any showroom.

---

### User Story 3 - Route the custom hostname while the platform subdomain remains a fallback (Priority: P1)

A visitor opens the verified custom hostname and sees the same showroom that is served on the tenant's platform subdomain. The platform subdomain continues to work for the tenant before, during, and after custom-domain verification, so a DNS or certificate problem never removes the showroom's only public address.

**Why this priority**: The roadmap explicitly requires the platform subdomain to remain available as a fallback, and losing it would turn a domain change into an outage.

**Independent Test**: Register and verify a custom domain for a tenant, request both the custom hostname and the tenant's platform subdomain, and confirm both return the same showroom.

**Acceptance Scenarios**:

1. **Given** a tenant with a verified custom domain and an active platform subdomain, **When** a visitor opens the custom hostname, **Then** the showroom's branding, inventory, and contact details render.
2. **Given** the same tenant, **When** a visitor opens the platform subdomain, **Then** the same showroom still renders.
3. **Given** a tenant whose custom domain is pending, failed, or certificate-inactive, **When** a visitor opens the platform subdomain, **Then** the showroom still renders normally.
4. **Given** a disabled or suspended tenant, **When** a visitor opens either the custom hostname or the platform subdomain, **Then** both fail closed.

---

### User Story 4 - Keep custom-domain operations safe and observable (Priority: P2)

A platform operator can see every domain on a tenant with its registration type, verification state, certificate state, last check, and the DNS instructions needed for recovery. Showroom owners and staff cannot register, verify, or inspect custom domains through the platform console.

**Why this priority**: Operators need an honest state view to diagnose DNS and certificate problems, and the platform surface must remain operator-only.

**Independent Test**: Open the platform console as an operator and as a showroom owner; confirm the operator sees domain state and controls while the owner receives not-found.

**Acceptance Scenarios**:

1. **Given** an active platform operator, **When** the operator inspects a tenant with a custom domain, **Then** the console shows its type, verification state, certificate state, last-check time, and DNS instructions.
2. **Given** a showroom owner or staff member, **When** they request the platform tenant page or invoke a custom-domain action, **Then** access is denied and no domain state changes.
3. **Given** a custom domain registered for one tenant, **When** another tenant's detail page is inspected, **Then** the domain does not appear there.
4. **Given** an unauthenticated request, **When** the platform tenant page is requested, **Then** the visitor is redirected to sign in.

---

### Edge Cases

- Hostname casing, a numeric port, and one trailing dot are normalized before storage and lookup.
- A custom domain that is a suffix of, or identical to, the platform root is rejected as a custom registration.
- Attempting to register the same hostname twice for the same tenant returns a conflict rather than creating a duplicate.
- A domain registered for one tenant cannot be transferred implicitly by re-registering it under another tenant.
- Verification can be retried after a failed DNS check or a failed certificate provision; the DNS token and instructions remain stable for the domain.
- A custom domain with verified ownership but no active certificate does not serve traffic.
- A platform subdomain remains routable even when a sibling custom domain is pending or failed.
- SSL and DNS provider credentials are server-only and are never exposed to the browser.
- When no DNS/SSL provider is configured in production, verification and certificate provisioning fail closed with an operator-visible message rather than pretending to succeed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Platform operators MUST be able to register a custom hostname for a specific tenant.
- **FR-002**: A new custom domain MUST be stored with a pending verification state and MUST NOT route until ownership is verified and its certificate is active.
- **FR-003**: The platform MUST generate stable, domain-specific DNS instructions consisting of a TXT ownership-verification record and a CNAME routing record.
- **FR-004**: The system MUST reject malformed hostnames, hostnames under the platform tenant root, and hostnames already registered to another tenant; rejection MUST leave stored state unchanged.
- **FR-005**: Platform operators MUST be able to trigger verification for a registered custom domain.
- **FR-006**: Verification MUST record one of pending, verified, or failed, plus the last-check time, and MUST preserve the ability to retry after failure.
- **FR-007**: SSL provisioning MUST be attempted after ownership verification and MUST record one of none, pending, active, or failed.
- **FR-008**: A custom domain MUST become routable only when ownership is verified, the certificate state is active, and the tenant is in a usable lifecycle state.
- **FR-009**: A verified custom hostname MUST resolve to the same tenant as the tenant's platform subdomain.
- **FR-010**: The platform subdomain MUST remain available as a fallback for a tenant regardless of that tenant's custom-domain state.
- **FR-011**: Suspended or disabled tenants MUST fail closed on both custom domains and platform subdomains.
- **FR-012**: DNS verification and SSL provisioning MUST be performed through a configurable provider interface, with a deterministic fake provider for development and tests and a documented production configuration path.
- **FR-013**: Provider credentials and provider endpoint configuration MUST remain server-only.
- **FR-014**: The platform tenant view MUST show each domain's type, verification state, certificate state, last-check time, and DNS instructions.
- **FR-015**: Custom-domain registration and verification MUST be authorized by the existing explicit platform-operator rule at the route, action, and data layers.
- **FR-016**: Showroom owners and staff MUST NOT be able to inspect or mutate custom domains.

### Key Entities

- **Tenant Domain**: A hostname registered to a tenant. It has a type (platform subdomain or custom domain), a routing status, a verification state, a verification token, a certificate state, a last-check time, and timestamps.
- **DNS Instruction**: The record type, record name, value, and purpose a showroom owner must publish for a custom domain.
- **Verification Check**: The outcome of asking the configured provider whether the ownership TXT record exists, including pending, verified, failed, and an explanatory message.
- **SSL Certificate State**: The outcome of asking the configured provider to issue a certificate for the hostname, including none, pending, active, failed, and an explanatory message.
- **Provider Configuration**: Server-only environment settings that select and authenticate the DNS/SSL integration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can register a custom hostname and see pending state plus both DNS instructions in a single tenant-detail visit.
- **SC-002**: In verification runs against the deterministic fake provider, a verified domain reaches certificate state active and resolves to its tenant in 100% of runs.
- **SC-003**: A pending, failed, or certificate-inactive custom hostname returns no showroom (0 successful renders) while the platform subdomain continues to return the showroom.
- **SC-004**: Cross-tenant checks find 0 custom domains visible on another tenant's platform page.
- **SC-005**: Showroom owners and staff receive 0 successful custom-domain actions or platform page reads.
- **SC-006**: No DNS or SSL credential appears in any browser-reachable response or bundle.
- **SC-007**: Desktop and mobile captures show the domain management surface and both the custom hostname and platform-subdomain fallback rendering the correct showroom.

## Assumptions

- The platform owns a production root such as `otoweb.id`; custom domains are hostnames outside that root.
- DNS verification uses a TXT record at `_otoweb-verify.<hostname>` with a domain-specific token, and routing uses a CNAME from the custom hostname to the platform root (or a configured target).
- Certificate issuance is automatic once ownership is verified; the platform does not ask the operator to upload certificates.
- No real DNS or certificate authority credentials exist in this environment. The provider interface, deterministic fake provider, and documented production adapter configuration are the integration boundary.
- Platform operators, not showroom owners, perform custom-domain registration and verification in this phase.
- The existing tenant hostname resolver is the single routing path; custom domains become routable by meeting its active-and-verified contract.
- Wildcard subdomain routing (F013) is already stable and is a hard prerequisite.

## Out of Scope

- A showroom-owner self-service domain console.
- Billing for custom domains.
- Transferring a domain between tenants.
- Automatic DNS record creation at third-party registrars.
- Email, traffic analytics, or certificate renewal UI.
