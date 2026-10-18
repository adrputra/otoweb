# Research: Production Hardening

**Date**: 2026-10-19

## Decision 1 — Dependency remediation scope

**Decision**: Move `shadcn` from `dependencies` to `devDependencies` and add
version-scoped pnpm overrides for safe patch-level transitive advisories
(`fast-uri`, `postcss`, `nanoid`), then re-run `pnpm audit --prod`.

**Rationale**: `shadcn` is a CLI used at development time; it is not imported by
the application runtime. Its dependency tree alone accounts for the only
critical advisory and most high advisories in the production audit. Moving it
removes that reachability without changing application behavior. The overrides
address advisories that remain reachable through `next`, `postcss`, and
`@hookform/resolvers`.

**Alternatives considered**:
- Upgrade every transitive package ad hoc: rejected because pnpm dedupe cannot
  patch packages locked by parents without overrides.
- Remove `shadcn` entirely: rejected because the project uses its generated
  primitives and may need future component additions.
- Accept all advisories: rejected because the launch decision needs a
  production-reachable high/critical count of zero.

## Decision 2 — Security headers without breaking Next

**Decision**: Add `X-Frame-Options: DENY`, `Permissions-Policy`,
`Cross-Origin-Opener-Policy`, a CSP subset (`frame-ancestors 'none'`,
`base-uri 'self'`, `object-src 'none'`, `form-action 'self'`), production-only
HSTS, and `poweredByHeader: false`.

**Rationale**: These directives take effect without a nonce and do not interfere
with Next's inline bootstrap scripts. A full `script-src` CSP would require
nonce plumbing and broad verification; it is a reasonable follow-up, not a
launch blocker for this phase.

**Alternatives considered**:
- Full nonce-based CSP now: rejected as a high-risk change across every route
  with no dedicated CSP test harness.
- Headers via a reverse proxy only: rejected because the repository should ship
  safe defaults and the audit must be verifiable from the app.

## Decision 3 — RLS and authorization proof

**Decision**: Extend the restricted-role PGlite tests to cover
`analytics_events`, assert every tenant-scoped table has a policy, and add a
focused authorization suite over capability and tenant-boundary helpers.

**Rationale**: Inspection alone is not evidence. The existing harness already
applies all migrations and a non-bypass role, so extending it gives the same
production-shaped proof for the newest table and makes future tables fail the
audit if they are added without RLS.

**Alternatives considered**:
- A static SQL scan only: rejected because it proves text, not database
  behavior.
- A live Supabase project: unavailable and would require credentials.

## Decision 4 — Two realistic showrooms

**Decision**: Seed Tenant B with two tenant-owned vehicles and images, featured
so the home page has content, and update count-based tests to assert tenant
ownership rather than a fixed total.

**Rationale**: An empty second showroom cannot exercise inventory, detail,
metadata, or visual QA meaningfully. Deterministic seed rows keep the fixture
idempotent and let both hosts be tested against the real public query path.

**Alternatives considered**:
- Keep Tenant B empty and test only branding: rejected because it does not
  satisfy "two or more realistic showrooms".
- Insert fixtures only inside e2e: rejected because the public dev server and
  visual QA would still see an empty showroom, and the production code path
  would not be exercised for tenant B inventory.

## Decision 5 — Accessibility and performance evidence

**Decision**: Add Playwright DOM assertions for language, heading structure,
accessible names, labels, error association, and landmarks; measure warm local
navigation/resource timings and record them. Review desktop/mobile captures
manually for hierarchy and overflow.

**Rationale**: A third-party axe integration would add a dependency and still
not replace human visual review. The project already has Playwright and a
capture harness, so the audit stays reproducible and offline-friendly.

**Alternatives considered**:
- Add `@axe-core/playwright`: reasonable follow-up, but the dependency audit is
  already under remediation and the DOM baseline covers the launch-critical
  issues.
- Lighthouse on a dev server: would measure the dev bundle and produce
  misleading scores.

## Decision 6 — Auth-page branding

**Decision**: Resolve the showroom name from the request host through a
server-only helper that catches every failure and falls back to `OtoWeb`; pass
the result to the shared auth shell and page metadata.

**Rationale**: A Tenant B owner currently sees Prima branding on the sign-in and
recovery screens. That is a real cross-tenant identity leak. A small resolver
keeps the auth screens resilient when the database is unavailable.

**Alternatives considered**:
- Hardcode a neutral platform brand everywhere: rejected because tenant owners
  lose useful context and the fix is small.
- Resolve the tenant in a client component: rejected because hostname
  resolution and database reads are server-only.
