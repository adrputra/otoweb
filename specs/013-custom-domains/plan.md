# Implementation Plan: Custom Domains

**Branch**: `013-custom-domains` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-custom-domains/spec.md`

## Summary

Extend platform administration with a custom-domain lifecycle for tenant-owned
hostnames. An operator registers a hostname outside the platform root; the
system stores it as pending, generates stable TXT/CNAME instructions, verifies
ownership through a configurable provider, provisions a certificate through the
same provider boundary, and only then makes the hostname routable through the
existing exact-host path. The platform subdomain and wildcard slug continue to
resolve independently, so a pending or failed custom domain never removes a
showroom's working address.

**Requirements analysis**: clean — zero open questions. Judgement calls are
recorded as assumptions in the spec: TXT ownership verification, CNAME routing,
automatic certificate issuance, platform-operator-only management, and a
provider interface with a deterministic fake for this credential-free
environment.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16 App Router, React 19

**Primary Dependencies**: Drizzle ORM 0.45, PostgreSQL/Supabase (PGlite in
development/tests), Zod 4, Vitest 5, Playwright 1.64

**Storage**: Existing `tenant_domains` table extended with verification,
certificate, and last-check columns. Migration `0003_custom-domains.sql`.

**Testing**: Vitest unit/service tests over PGlite, platform Playwright e2e with
the QA-only fake auth endpoint, focused desktop/mobile visual capture.

**Target Platform**: Next.js server runtime behind wildcard DNS; custom hosts
reach the same deployment through their CNAME.

**Project Type**: Single Next.js web application.

**Performance Goals**: Registration and verification are operator-triggered, not
per-request. Public hostname resolution remains one indexed exact-domain lookup
before wildcard inference.

**Constraints**: No real DNS/CA credentials. No live provider calls in tests.
No service-role key. No weakening of tenant isolation or platform authorization.
No regression to wildcard or platform-subdomain resolution.

**Scale/Scope**: One custom-domain management surface on an existing tenant
detail page, one provider interface, one fake provider, and one HTTP adapter
that is inert unless explicitly configured.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No ratified constitution exists (`.specify/memory/constitution.md` is the
unfilled template), so no constitution gates apply. The plan preserves the
documented boundaries in `docs/TENANCY.md` and `docs/PLATFORM.md`: explicit
platform-operator authorization, RLS, server-only credentials, and fail-closed
hostname resolution.

## Project Structure

### Documentation (this feature)

```text
specs/013-custom-domains/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── domain-lifecycle.md
│   └── domain-provider.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
db/
├── schema.ts                         # verification/certificate columns
└── migrations/0003_custom-domains.sql

lib/
├── domains/
│   ├── types.ts                      # provider + lifecycle contracts
│   ├── dns.ts                        # token, TXT/CNAME instructions
│   ├── fake-provider.ts              # deterministic test/development provider
│   ├── http-provider.ts              # configured production adapter
│   └── provider.ts                   # environment selection, fail-closed default
├── platform/
│   ├── domain-service.ts             # register/verify lifecycle + auth boundary
│   ├── tenant-service.ts             # exposes shared platform transaction helper
│   ├── validation.ts                 # custom-domain contracts
│   ├── types.ts                      # domain view model + DNS instructions
│   └── actions.ts                    # server actions
└── tenant/hostname.ts                # exact custom-domain routing guard

components/platform/custom-domains.tsx
app/platform/tenants/[id]/page.tsx

scripts/
├── validate-env.mjs                  # provider configuration validation
└── visual-qa-custom-domains.mjs      # desktop/mobile evidence

tests/
├── unit/domains/provider.test.ts
├── unit/platform/domain-service.test.ts
├── unit/platform/validation.test.ts  # extended
└── e2e/custom-domains.spec.ts

docs/
├── CUSTOM_DOMAINS.md
├── PLATFORM.md                       # link + boundary update
├── SUBDOMAIN_ROUTING.md              # fallback + custom row semantics
├── DATABASE.md                       # new columns
└── TENANCY.md                        # routing contract
```

**Structure Decision**: Keep routing in the existing tenant hostname resolver.
Custom domains are ordinary exact `tenant_domains` rows that satisfy a stronger
custom-domain guard (verified ownership + active certificate). The provider
boundary lives under `lib/domains/` so no platform UI imports provider
credentials or Node-only code.

## Domain Lifecycle

```text
register (operator)
  -> type=custom_domain, status=pending, verification=pending, ssl=none
  -> TXT  _otoweb-verify.<host> = otoweb-verify=<token>
  -> CNAME <host> -> <platform root or CUSTOM_DOMAIN_CNAME_TARGET>

verify (operator, repeatable)
  -> provider.verifyDns(host, token)
       pending/failed -> record state + last_checked_at, stay non-routable
       verified       -> record verified_at
  -> provider.provisionCertificate(host)
       active  -> ssl=active, status=active  (routable)
       pending -> ssl=pending, status=pending (not routable)
       failed  -> ssl=failed,  status=pending (not routable)

route
  -> exact active row + verified_at + (custom: verification=verified AND ssl=active)
  -> tenant usable? yes -> render showroom
  -> no -> fail closed

fallback
  -> tenant's platform subdomain / wildcard slug is a separate path and is
     unaffected by any custom-domain state.
```

## Provider Design

`DomainProvider` has two operations: `verifyDns` and `provisionCertificate`.
Selection is server-only:

| `DOMAIN_PROVIDER` | Environment | Behavior |
|---|---|---|
| unset | development/test | deterministic fake |
| unset | production | fail-closed "not configured" provider |
| `fake` | development/test | deterministic success; injectable outcomes in tests |
| `fake` | production | rejected by environment validation |
| `http` | any | POST to `DOMAIN_PROVIDER_URL` with `DOMAIN_PROVIDER_TOKEN` |

The HTTP adapter never runs in tests or in this environment. It is the
documented extension point for a real DNS/ACME provider. Provider calls happen
outside the database transaction; the final write re-runs the platform-operator
authorization check.

## Routing Rules

- Custom hostnames resolve only through exact `tenant_domains` rows.
- A custom row must be `status = 'active'`, have `verified_at`, have
  `verification_status = 'verified'`, and have `ssl_status = 'active'`.
- Inactive, pending, failed, or certificate-inactive custom rows fail closed;
  they never fall through to wildcard inference.
- The tenant's platform subdomain is a separate row (or wildcard slug) and
  remains routable while a custom domain is pending or failed.
- Suspended/disabled tenants fail closed on every host.

## Phase Plan

1. **Setup / data** — schema columns, migration, seed updates, environment
   validation.
2. **Foundational** — DNS instructions, provider contracts, fake provider,
   environment factory, shared platform helper exports.
3. **US1 registration** — validation, service, server actions, tenant detail UI.
4. **US2 verification + SSL** — verification service, state transitions,
   idempotent retries, certificate gating.
5. **US3 routing + fallback** — resolver guard, unit and e2e proof that custom
   and platform hosts both resolve while pending/failed custom hosts do not.
6. **US4 safety + observability** — operator-only checks, cross-tenant
   isolation, state display, docs.
7. **Polish** — visual QA, detector, full checkpoint.

## Complexity Tracking

No constitution violations. The only new external integration is an interface
plus an inert HTTP adapter; this environment uses the deterministic fake, which
is the same pattern as the existing Cloudinary media provider.
