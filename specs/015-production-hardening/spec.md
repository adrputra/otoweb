# Feature Specification: Production Hardening

**Feature Branch**: `015-production-hardening`

**Created**: 2026-10-19

**Status**: Draft

**Input**: Roadmap Phase 16 — perform a security audit, RLS audit, authorization audit, dependency audit, mobile QA, desktop QA, SEO audit, accessibility audit, performance audit, and failure-state testing; test with two or more realistic showrooms.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Audit and harden security, tenancy, and authorization (Priority: P1)

A platform operator preparing the first commercial showrooms needs evidence that tenant data cannot leak, privileged surfaces cannot be reached without the right membership, and the application ships defensible HTTP and redirect behavior. The audit covers the append-only migrations, tenant context, authentication proxy, admin/platform boundaries, media upload path, and environment validation.

**Why this priority**: A production launch is unsafe while tenant isolation or authorization is unproven. These are the highest-severity risks in a multi-tenant showroom platform.

**Independent Test**: Run the RLS and authorization suites, inspect the migration policy coverage, exercise the security header configuration, and confirm the documented verdict for every audited surface.

**Acceptance Scenarios**:

1. **Given** every tenant-scoped table, **When** RLS is inspected and exercised with the restricted role, **Then** each table is enabled and forced, and cross-tenant reads/writes are rejected.
2. **Given** a showroom owner, staff member, anonymous visitor, and platform operator, **When** each attempts admin and platform access, **Then** only the permitted role reaches the intended surface and every denial fails closed.
3. **Given** a production-shaped HTTP response, **When** headers are inspected, **Then** the application sends the documented hardening headers and does not advertise the framework.
4. **Given** tenant-aware public responses, **When** robots.txt is requested, **Then** platform/admin/API/auth surfaces are disallowed and the tenant sitemap is advertised.
5. **Given** the auth screens on a second showroom host, **When** the page renders, **Then** it uses that showroom's identity rather than another tenant's brand.

---

### User Story 2 - Audit dependencies and prove the build is reproducible (Priority: P1)

A maintainer needs the dependency tree, type checker, lint, tests, and production build to be clean enough for a launch decision. The audit classifies every advisory as production or development, remediates production-affecting advisories where a safe upgrade exists, and explicitly records residual or deferred risk.

**Why this priority**: Vulnerable runtime dependencies are exploitable in production; an unverified build undermines every other audit.

**Independent Test**: Run the dependency audit before and after remediation, then run typecheck, lint, the unit suite, and the production build fresh and record their actual results.

**Acceptance Scenarios**:

1. **Given** the dependency tree, **When** the audit report is read, **Then** every advisory is classified by severity and whether it reaches production.
2. **Given** a CLI-only package that pulls a large vulnerable server tree, **When** dependencies are remediated, **Then** that package is not installed as a production dependency and the production audit improves.
3. **Given** the remediated tree, **When** `npx tsc --noEmit`, `npm test`, `npm run lint`, and `npm run build` run, **Then** each completes successfully with fresh output.
4. **Given** residual advisories, **When** the report is read, **Then** each has an owner-facing rationale and a concrete follow-up rather than being silently accepted.

---

### User Story 3 - Verify two realistic showrooms across desktop, mobile, SEO, accessibility, performance, and failure states (Priority: P1)

An operator wants confidence that Prima Auto Gallery and Tenant B Test Showroom both behave as real showrooms on desktop and mobile: correct branding, inventory, contact details, metadata, keyboard/screen-reader basics, acceptable load behavior, and graceful failure when a route or service is unavailable.

**Why this priority**: Two-showroom QA is the roadmap's explicit acceptance condition and catches cross-tenant leaks and tenant-specific rendering defects that a single-fixture audit misses.

**Independent Test**: Seed both showrooms with realistic content, run the two-host end-to-end suite and the desktop/mobile visual capture, and inspect the SEO, accessibility, performance, and failure-state assertions.

**Acceptance Scenarios**:

1. **Given** Prima and Tenant B, **When** each home, inventory, and detail route is opened on desktop and mobile, **Then** the expected tenant identity and inventory render with no horizontal overflow and no other tenant's content.
2. **Given** each showroom host, **When** home, inventory, and vehicle metadata are inspected, **Then** titles, descriptions, canonicals, OpenGraph tags, sitemap URLs, and robots directives are tenant-scoped.
3. **Given** the public and admin surfaces, **When** the accessibility checks run, **Then** pages declare a language, expose one primary heading, provide accessible names for form controls and icon buttons, and keep errors programmatically associated with their fields.
4. **Given** a warm local server, **When** each showroom's home and inventory routes are measured, **Then** navigation completes within documented local budgets and the result is recorded.
5. **Given** an unknown hostname, an unknown vehicle, an unknown route, a malformed analytics beacon, or a failing analytics write, **When** the request is handled, **Then** the response is a safe 404/204 or a successful public rendering without exposing another tenant or an internal error.
6. **Given** an unexpected server error, **When** the error boundary renders, **Then** the visitor sees a recoverable message and a retry action instead of a blank or framework error page.

---

### User Story 4 - Record findings, verdicts, and deferred risk (Priority: P2)

The owner and future maintainers need one durable audit report that explains what was checked, how, what was found, what was fixed, what evidence proves it, and what is explicitly deferred.

**Why this priority**: An audit without a traceable report cannot support a launch decision or a future regression review.

**Independent Test**: Read the hardening report and verify that every roadmap audit category has a verdict, every fixed finding cites a test or command, and every deferred finding cites a reason and follow-up.

**Acceptance Scenarios**:

1. **Given** the ten roadmap audit categories, **When** the report is read, **Then** each category has a verdict and the commands or artifacts that support it.
2. **Given** a fixed defect, **When** the report is read, **Then** it names the files and the regression test.
3. **Given** a residual or deferred risk, **When** the report is read, **Then** it states the risk, why it is deferred, and the next action.
4. **Given** the two-showroom QA, **When** the report is read, **Then** it links the desktop/mobile captures and states the pass/fail outcome.

### Edge Cases

- The database is unavailable during a public request: the page must fail closed (not-found or error boundary), never fall back to another tenant or mock catalogue.
- The database is unavailable during auth-page branding resolution: the auth screen still renders with a neutral platform identity.
- A hostname resolves to a tenant with no vehicles: the inventory and home surfaces show the documented empty state without cross-tenant data.
- A custom domain is pending or unverified: it returns 404 while the platform subdomain continues to serve.
- A request contains repeated, malformed, or oversized query/body values: filters ignore invalid values and the analytics beacon answers quietly.
- An analytics write or lead write fails: the public response remains successful or degrades according to the documented contract.
- An image URL is remote, missing, or non-HTTP: the public surface falls back to the placeholder rather than rendering a broken canonical/OpenGraph URL.
- A platform operator also holds a showroom membership: the operator check is based on the explicit platform membership, not on showroom ownership.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The audit MUST cover every roadmap category: security, RLS, authorization, dependency, mobile QA, desktop QA, SEO, accessibility, performance, and failure-state testing.
- **FR-002**: Every tenant-scoped table MUST have row-level security enabled and forced, and the restriction MUST be exercised with a non-bypass role for reads and writes.
- **FR-003**: Tenant context resolution MUST fail closed for anonymous, unaffiliated, inactive, ambiguous, mismatched, and unavailable-tenant requests.
- **FR-004**: Admin and platform boundaries MUST enforce authentication plus the documented role/capability or explicit platform-operator membership.
- **FR-005**: The application MUST send hardening HTTP headers (`X-Content-Type-Options`, `Referrer-Policy`, frame protection, a restrictive `Permissions-Policy`, and a non-script-breaking CSP subset) and MUST NOT advertise the framework via `X-Powered-By`; HSTS MUST be emitted only for production HTTPS responses.
- **FR-006**: `robots.txt` MUST disallow private surfaces including `/admin/`, `/platform/`, `/api/`, `/auth/`, and the auth screens, while advertising the tenant sitemap for resolved hosts.
- **FR-007**: The dependency audit MUST classify advisories by severity and production reachability, remediate safe production-affecting findings, and document residuals.
- **FR-008**: The configured validation commands and the project quality gates MUST pass fresh: `npx tsc --noEmit`, `npm test`, `npm run lint`, and `npm run build`.
- **FR-009**: Prima Auto Gallery and Tenant B Test Showroom MUST both be seeded as realistic showrooms with tenant-specific branding, contact details, and public inventory.
- **FR-010**: Public home, inventory, and detail routes MUST remain tenant-isolated on both hosts at desktop and mobile viewports, with no horizontal overflow.
- **FR-011**: Public metadata and sitemap/robots output MUST remain tenant-scoped, self-canonical where applicable, and free of another tenant's identity.
- **FR-012**: Public and admin surfaces MUST expose the audited accessibility baseline: document language, a single primary heading, accessible form-control names, labelled icon buttons, and programmatically associated field errors.
- **FR-013**: Auth screens MUST resolve the active showroom identity from the request host and MUST fall back to a neutral platform identity when it cannot be resolved.
- **FR-014**: A performance audit MUST measure the two showrooms' public routes on a warm local server and record the results against documented budgets.
- **FR-015**: Failure-state testing MUST cover unknown host, unknown vehicle, unknown route, malformed/oversized analytics input, failing analytics writes, and the error boundary, with safe responses.
- **FR-016**: The feature MUST produce a durable report containing methodology, findings, fixes, fresh command evidence, two-showroom QA results, and explicitly deferred items.
- **FR-017**: The feature MUST NOT add live credentials, external SaaS dependencies, or weaken any existing validation, RLS, or authorization check.

### Key Entities

- **Audit Finding**: One audited observation. It has a category, severity, affected surface, evidence, disposition (fixed/accepted/deferred), and follow-up.
- **Showroom QA Matrix**: The cross-product of Prima and Tenant B with home/inventory/detail routes and desktop/mobile viewports, including pass/fail and screenshot paths.
- **Hardening Report**: The durable document under `docs/` that records every category verdict, command, finding, and residual risk.
- **Tenant Fixture**: A seeded showroom with deterministic identity, settings, domains, owner membership, inventory, and images.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of tenant-scoped tables are proven RLS-enabled and forced, and every tested cross-tenant read/write is rejected.
- **SC-002**: 100% of tested anonymous, wrong-role, wrong-tenant, and non-operator access attempts are denied without exposing protected content.
- **SC-003**: The production dependency audit has no high or critical advisories that are reachable by runtime code; any remaining advisory is documented with a follow-up.
- **SC-004**: `npx tsc --noEmit`, `npm test`, `npm run lint`, and `npm run build` all exit 0 in the checkpoint run.
- **SC-005**: Both showrooms pass the desktop (1440×900) and mobile (390×844) QA matrix for identity, inventory, isolation, and overflow.
- **SC-006**: Both showrooms pass the SEO checks for canonical URLs, tenant metadata, sitemap, and robots.
- **SC-007**: The accessibility audit finds zero critical violations in the checked surfaces after remediation.
- **SC-008**: Every measured public route completes within the documented local performance budget, or the miss is reported as a finding.
- **SC-009**: Every failure-state scenario returns a safe, documented response.
- **SC-010**: The hardening report covers all ten roadmap categories with a verdict and cites fresh command or capture evidence.

## Assumptions

- External services (live Supabase Auth, Cloudinary, DNS/SSL provisioner) are unavailable; the existing fake/injected providers are the audit vehicle, and no live credentials are invented.
- Tenant B Test Showroom becomes "realistic" by seeding two tenant-owned vehicles with images; the existing deterministic fixture IDs and settings are preserved.
- Performance is measured against a warm local Next.js server with generous budgets; production load testing, Lighthouse scoring, and CDN measurement are out of scope.
- Accessibility is audited with DOM/semantic checks plus manual capture inspection, not a third-party certification or full WCAG conformance audit.
- The audit report is documentation plus regression tests; it does not add a runtime admin UI.
- Existing public/admin design language is preserved; changes are hardening and correctness fixes, not a redesign.
- CI continues to run the existing quality gates; adding the browser matrix to CI is recorded as a follow-up rather than a hidden scope increase.

## Out of Scope

- Penetration testing, threat modelling workshops, or third-party security certification.
- Live DNS, TLS, Cloudinary, or Supabase provisioning.
- Load, stress, or soak testing at production scale.
- A full WCAG 2.2 AA conformance audit or automated axe integration.
- Redesigning the public, auth, admin, or platform surfaces.
- Changing the roadmap state, committing, or approving the feature checkpoint (owned by the outer loop).
