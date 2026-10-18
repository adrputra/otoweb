# Implementation Plan: Subdomain Routing

**Branch**: `012-subdomain-routing` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-subdomain-routing/spec.md`

## Summary

Formalize wildcard tenant routing on top of the existing hostname resolver. Exact
active/verified `tenant_domains` records remain authoritative. When a hostname
has no domain record, a single-label subdomain of the configured platform root
resolves to a tenant by slug, with fail-closed handling for unknown, malformed,
inactive, and suspended targets. Development adds `*.localhost` support, short
aliases derived from each tenant's platform subdomain (`prima.localhost`,
`tenant-b.localhost`), and keeps the bare-loopback default convenience. One
deployment is proven to serve two hostnames with distinct branding, inventory,
and contact details through unit, raw-HTTP e2e, and desktop/mobile visual
evidence.

**Requirements analysis**: clean — zero open questions. The only judgement
calls are documented as assumptions: wildcard identity is the tenant slug,
development aliases come from platform-subdomain labels, and the production root
defaults to `otoweb.id` with an environment override.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16 App Router, React 19

**Primary Dependencies**: Drizzle ORM 0.45, PostgreSQL/Supabase (PGlite in
development/tests), Playwright 1.64, Vitest 5

**Storage**: Existing `tenants` and `tenant_domains` tables. No migration is
required; wildcard routing reads the existing schema.

**Testing**: Vitest unit tests (`tests/unit`), Playwright raw-HTTP/browser e2e
(`tests/e2e`), and the existing visual QA capture pattern.

**Target Platform**: Next.js server runtime on a wildcard DNS deployment;
Chromium for visual capture.

**Project Type**: Single Next.js web application.

**Performance Goals**: Hostname resolution adds at most one indexed tenant
lookup or alias lookup per request. Public routes are already dynamic and
request-scoped.

**Constraints**: No default-tenant fallback outside bare loopback development;
no service-role credential; no weakening of tenant isolation; no change to
existing admin/platform exact-host behavior.

**Scale/Scope**: Every public request, two seeded tenants, and future tenants
created by platform administration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No ratified constitution exists (`.specify/memory/constitution.md` is the
unfilled template). No constitution gates apply. The feature preserves the
existing tenant-isolation, RLS, and server-only boundaries documented in
`docs/TENANCY.md`.

## Project Structure

### Documentation (this feature)

```text
specs/012-subdomain-routing/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # Phase 1 entities and resolution model
├── quickstart.md        # Phase 1 verification guide
├── contracts/
│   └── hostname-resolution.md
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
lib/tenant/
├── hostname.ts          # normalization, exact lookup, wildcard + dev alias resolution
├── types.ts             # existing denial codes and tenant identity
└── server.ts            # admin request resolver (unchanged call site)

lib/public/
└── tenant.ts            # public tenant resolver; narrow development fallback

scripts/
├── validate-env.mjs     # optional TENANT_ROOT_DOMAIN validation
└── visual-qa-subdomain.mjs

tests/
├── unit/tenant/hostname.test.ts
├── unit/public/tenant-resolution.test.ts
└── e2e/subdomain-routing.spec.ts

docs/
├── SUBDOMAIN_ROUTING.md
├── TENANCY.md
├── PUBLIC_SITE.md
└── PLATFORM.md

.env.example
next.config.mjs          # unchanged unless dev-origin coverage proves insufficient
package.json             # visual:qa:subdomain script
```

**Structure Decision**: Keep resolution in the existing server-only tenant
module. Pages already read the request host through `resolvePublicTenant`; no
middleware rewrite or route restructuring is needed. The public resolver narrows
its development fallback to bare loopback hosts so `*.localhost` is resolved by
the wildcard path rather than by a default tenant.

## Resolution Design

```text
normalize hostname
  -> exact tenant_domains row?
       yes: active + verified + usable tenant -> tenant
            inactive/unverified -> unknown_hostname (no wildcard fallback)
            unusable tenant -> tenant_unavailable
       no: single-label subdomain of a configured root?
            slug lookup -> usable tenant -> tenant
            development alias lookup (localhost root only)
              one active verified platform-subdomain label -> tenant
              zero or multiple -> unknown_hostname
            no match -> unknown_hostname
  -> public resolver: bare loopback development default only
```

- Production roots: `TENANT_ROOT_DOMAIN` or `otoweb.id`.
- Development/test roots: configured root plus `localhost`.
- Production never treats `.localhost` as a tenant root.
- Wildcard inference requires exactly one label; multi-label and suffix-spoofed
  hosts do not match.
- Exact registered domains win before wildcard inference, so custom domains
  (F014) can continue to be added without changing this path.

## Phase Plan

1. **Foundational** — add pure root/label helpers and exact-then-wildcard
   resolution with configurable roots; keep denial codes unchanged.
2. **US1 production routing** — wire public resolver, add unit and raw-HTTP tests
   proving distinct branding/inventory/contact and fail-closed behavior.
3. **US2 development testing** — add `*.localhost` aliases, narrow the loopback
   fallback, document the strategy, and capture desktop/mobile evidence.
4. **US3 safety** — cover inactive registered domains, suspended tenants,
   non-platform hosts, suffix spoofing, ambiguous aliases, and production
   exclusion of `localhost`.
5. **Polish** — env/docs updates, visual QA report, full checkpoint validation.

## Complexity Tracking

No constitution violations. The design adds no new table, migration, service,
or dependency; it extends the existing resolver with pure helpers and one
fallback lookup.
