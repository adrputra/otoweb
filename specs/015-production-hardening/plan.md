# Implementation Plan: Production Hardening

**Branch**: `015-production-hardening` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-production-hardening/spec.md`

## Summary

Run the ten roadmap audits against the implemented platform, fix the genuine
defects the audits expose, and leave durable evidence. The work is deliberately
bounded: harden HTTP/SEO/auth behavior, prove RLS and authorization with
regression tests, remediate the production dependency tree where safe, make
Tenant B a realistic second showroom with inventory, add a two-showroom
desktop/mobile QA matrix plus SEO/accessibility/performance/failure-state
checks, and publish `docs/PRODUCTION_HARDENING.md` with findings and residuals.

The audit does not add a new product surface. It changes configuration,
fixtures, accessibility wiring, failure boundaries, and tests, plus targeted
auth-branding and robots fixes.

**Requirements analysis**: clean — zero open questions. The spec records the
judgement calls as assumptions: fake providers for unavailable external
services, warm-local performance budgets, Tenant B seeded with two vehicles,
DOM/semantic accessibility checks rather than certification, and CI browser
coverage deferred with a follow-up.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16 App Router, React 19

**Primary Dependencies**: Drizzle ORM 0.45, PostgreSQL/Supabase, Zod 4, Vitest 5,
Playwright 1.64, Tailwind 4, pnpm 12.3.4

**Storage**: PostgreSQL schema plus migrations `0000`–`0004`; development and
tests use PGlite with the same migrations and deterministic seed. Tenant B gains
two seeded vehicles and images in `db/seed-core.ts`.

**Testing**: Vitest unit/component tests over PGlite; Playwright e2e against the
seeded dev server with host-resolver rules for `prima.otoweb.id` and
`tenant-b.otoweb.id`; a Playwright desktop/mobile capture script for Visual QA.

**Target Platform**: Single Next.js deployment behind wildcard and custom
hostnames.

**Performance Goals**: Warm local public routes complete within generous audit
budgets (home/inventory TTFB and DOMContentLoaded reported per showroom), with
the result recorded rather than used as a manufacturing gate.

**Constraints**: No live credentials; fake/injected providers for auth, media,
and DNS/SSL. No weakening of RLS, authorization, or validation. Preserve the
incumbent showroom/admin design language. Do not edit roadmap state or commit.

**Scale/Scope**: Ten audit categories, two showrooms, three public routes per
showroom, desktop 1440×900 and mobile 390×844, plus failure-state and
authorization regression coverage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is the unfilled template, so no ratified
constitution gates apply. The plan preserves the documented boundaries in
`docs/TENANCY.md`, `docs/AUTH.md`, `docs/DATABASE.md`, `docs/PUBLIC_SITE.md`, and
`docs/SEO.md`: fail-closed tenant resolution, forced RLS, explicit capability
checks, tenant-scoped metadata, and no secrets in the repository.

## Project Structure

### Documentation (this feature)

```text
specs/015-production-hardening/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
app/
├── error.tsx                      # new recoverable error boundary
├── not-found.tsx                  # new tenant-aware 404 page
├── login/page.tsx                 # tenant-aware auth branding
├── forgot-password/page.tsx       # tenant-aware auth branding
└── reset-password/page.tsx        # tenant-aware auth branding

components/
├── auth/auth-shell.tsx            # accepts resolved brand identity
├── public-contact-form.tsx        # field-error association
└── showroom.tsx                   # control labels and menu state

lib/
└── public/branding.ts             # host-resolved auth brand with neutral fallback

db/
└── seed-core.ts                   # two realistic Tenant B vehicles + images

scripts/
├── hardening-audit.mjs            # deterministic offline audit checks
└── visual-qa-hardening.mjs        # F016 two-showroom desktop/mobile capture

tests/
├── unit/security/                 # headers, robots, roles, RLS coverage
├── unit/db/                       # updated seed expectations
├── unit/tenant/                   # updated two-showroom expectations
└── e2e/                           # hardening, accessibility, two-showroom QA

docs/
└── PRODUCTION_HARDENING.md        # findings, verdicts, evidence, residuals
```

**Structure Decision**: Single Next.js web application. Changes stay inside the
existing app/lib/db/tests/docs layout; no new deployable unit.

## Phase 0 — Research summary

See [research.md](./research.md). Decisions include: move the `shadcn` CLI out of
runtime dependencies and use pnpm overrides for safe patch-level transitive
fixes; add non-script-breaking security headers rather than a nonce CSP; extend
RLS coverage and authorization tests instead of relying on inspection; seed
Tenant B inventory so the two-showroom QA is meaningful; and use DOM/semantic
accessibility assertions plus manual capture review rather than a third-party
certification.

## Phase 1 — Design decisions

- **Audit evidence**: a deterministic `scripts/hardening-audit.mjs` performs
  offline checks (RLS migration coverage, security headers, secret/unsafe-HTML
  scan, seeded showroom readiness) and writes JSON. Network dependency audit is
  run separately and quoted in the report.
- **Security headers**: add `X-Frame-Options`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`, a CSP subset (`frame-ancestors`, `base-uri`,
  `object-src`, `form-action`), and production-only HSTS; disable
  `X-Powered-By`. Avoid script-src/nonce changes that would break Next's
  runtime.
- **Auth branding**: a server-only helper resolves the request tenant's
  showroom name with a neutral `OtoWeb` fallback; auth screens and metadata use
  it. Resolution failure never blocks the auth screen.
- **Robots**: add `/platform/` to the disallow list and assert it.
- **RLS**: extend the table audit to `analytics_events` and add a policy-count
  assertion for every tenant-scoped table.
- **Authorization**: add a focused regression suite over the capability matrix,
  tenant mismatch, platform-operator independence, and anonymous denial.
- **Two showrooms**: seed two tenant-owned vehicles with images and featured
  flags for Tenant B; update count-based fixtures to assert ownership rather
  than a magic total.
- **Failure states**: add a root `not-found.tsx` and `error.tsx`; e2e covers
  unknown host, unknown vehicle, unknown route, malformed analytics, and the
  tenant-aware 404.
- **Accessibility**: label the public search/filter controls, expose mobile-menu
  state, associate contact-form errors with `aria-describedby`, and test the
  baseline across both showrooms.
- **Performance**: warm dev-server navigation/resource measurements for both
  showrooms; report actual values and treat over-budget as a finding.
- **Visual QA**: a dedicated F016 capture script covers both showrooms' home,
  inventory, and detail routes at desktop and mobile, plus an unknown-host 404.

## Complexity Tracking

No constitution violations and no new architectural unit. The only added
abstraction is `lib/public/branding.ts`, which keeps tenant resolution out of
the auth components and makes the neutral fallback testable.
