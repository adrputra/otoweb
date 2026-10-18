# Research: Custom Domains

**Feature**: `013-custom-domains` | **Date**: 2026-10-19

## Decision: TXT ownership record plus CNAME routing record

**Decision**: Verify ownership with a TXT record at
`_otoweb-verify.<hostname>` whose value is `otoweb-verify=<token>`. Route the
hostname with a CNAME to the configured platform root (or
`CUSTOM_DOMAIN_CNAME_TARGET`).

**Rationale**: The TXT record proves control of the exact hostname without
requiring an HTTP challenge or opening an unverified host to traffic. A CNAME
is the standard way to point a subdomain at a multi-tenant deployment and keeps
certificate issuance at the platform edge. The record values are deterministic
from the stored token, so retries show the same instructions.

**Alternatives considered**:
- HTTP file challenge. Rejected: it would require serving an unverified custom
  hostname before ownership is proven.
- A/AAAA records. Rejected: they pin the deployment's IP addresses and do not
  model the platform edge/proxy.
- Manual certificate upload. Rejected: the roadmap asks for SSL provisioning
  integration, not an operator-managed certificate workflow.

## Decision: Strengthen the existing exact-domain resolver

**Decision**: Custom rows must additionally be `verification_status =
'verified'` and `ssl_status = 'active'` before the resolver returns a tenant.
Platform-subdomain rows keep the existing active-and-verified contract.

**Rationale**: The resolver already treats exact rows as authoritative and fails
closed when a row is inactive or unverified. Adding the custom-only guard
prevents a row from routing while its certificate is still pending or failed,
without changing wildcard or seeded platform behavior. It also preserves the
"never fall through to wildcard" rule.

**Alternatives considered**:
- A separate middleware for custom hosts. Rejected: two resolution paths would
  drift and complicate SEO origin and tenant scoping.
- Route as soon as DNS verifies. Rejected: it would serve plaintext or
  certificate-error traffic.

## Decision: Provider interface with fake and HTTP adapters

**Decision**: Define a server-only `DomainProvider` with `verifyDns` and
`provisionCertificate`. Select it from `DOMAIN_PROVIDER`. Development and tests
default to a deterministic fake. Production with no provider fails closed.
`DOMAIN_PROVIDER=http` uses `DOMAIN_PROVIDER_URL` and
`DOMAIN_PROVIDER_TOKEN` against a documented JSON contract.

**Rationale**: This environment has no DNS/CA credentials. The fake provider
lets the full lifecycle, UI, routing, and tests run end to end without
fabricating credentials. The HTTP adapter makes the production integration real
and configurable without hardcoding a vendor. Failing closed in production is
safer than silently pretending to verify a domain.

**Alternatives considered**:
- Hardcode a specific DNS vendor SDK. Rejected: no credentials, no vendor
  decision in the roadmap, and it would add an unused dependency.
- Mock at the service layer instead of the provider boundary. Rejected: it would
  leave the actual integration point untested and make production behavior
  implicit.
- Let production default to fake. Rejected: it would fabricate successful
  verification and certificates.

## Decision: Verify and provision outside the database transaction

**Decision**: Load the domain with the platform-operator check, call the
provider, then open a second platform-scoped transaction to write the result.
The final write repeats the authorization check.

**Rationale**: External DNS/ACME calls can take seconds and must not hold a
database transaction open. Re-checking authorization at the data boundary keeps
the existing three-layer platform guarantee.

**Alternatives considered**:
- Provider call inside `withPlatformSession`. Rejected: long external calls in
  a transaction, and a failed provider would roll back the recorded attempt.
- Trust the route guard for the write. Rejected: violates the documented
  data-layer authorization rule.

## Decision: Stable token per registration, retryable states

**Decision**: Generate the verification token once at registration and keep it
for the life of the domain. Verification and certificate failures are recorded
with `last_checked_at` and can be retried without changing the DNS
instructions.

**Rationale**: An operator may need to ask the showroom owner to re-publish a
record. Rotating the token on every retry would invalidate work already done.
The fake provider proves both success and retry after a configured failure.

**Alternatives considered**:
- Rotate tokens after failure. Rejected: breaks stable instructions and adds no
  security value when the token is random and domain-bound.
- Delete and re-register the domain after failure. Rejected: loses history and
  creates a race with DNS propagation.

## Decision: Prove the lifecycle through service tests, platform e2e, and visual QA

**Decision**: Use PGlite service tests for state transitions and resolution,
a platform e2e spec that registers and verifies through the real UI then fetches
the custom Host header, and a focused desktop/mobile visual script.

**Rationale**: The service tests prove routing and fail-closed behavior; the e2e
proves the operator workflow and the real Next server; the visual pass proves
the new surface and the platform-subdomain fallback at both viewports.

**Alternatives considered**:
- Unit-only proof. Rejected: does not exercise the UI or the server action
  boundary.
- Seed a custom domain fixture. Rejected: it changes shared fixture counts and
  hides whether registration actually works.
