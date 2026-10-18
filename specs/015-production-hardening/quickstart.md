# Quickstart: Production Hardening

## Prerequisites

- Node.js 24, pnpm 12.3.4, dependencies installed (`pnpm install`).
- No live credentials are required. Development uses the seeded PGlite database
  and `scripts/fake-supabase-auth.mjs`.

## Audit commands (fresh output required)

```bash
# Offline hardening audit (RLS coverage, headers, secrets/unsafe HTML, seeds)
node scripts/hardening-audit.mjs

# Dependency audit
pnpm audit --prod --json
pnpm audit --json

# Quality gates
npx tsc --noEmit
npm test
pnpm lint
pnpm build
```

## Two-showroom QA

```bash
# Public e2e, including hardening/accessibility/performance checks
pnpm test:e2e -- hardening.spec.ts accessibility.spec.ts

# Two-showroom desktop/mobile captures
pnpm visual:qa:hardening
```

The capture writes screenshots under `.visual-qa/screenshots/{desktop,mobile}/`
and a report under `.visual-qa/reports/f016-production-hardening-visual-qa.md`.

## Expected outcomes

- Every tenant-scoped table is RLS-enabled/forced and cross-tenant access is
  rejected.
- Both `prima.otoweb.id` and `tenant-b.otoweb.id` serve their own branding,
  inventory, metadata, and contact details with no cross-tenant leakage.
- Unknown hosts, unknown vehicles, unknown routes, malformed analytics, and
  rendering errors fail safely.
- `npx tsc --noEmit`, `npm test`, `pnpm lint`, and `pnpm build` exit 0.
- The production dependency audit reports no high/critical advisory reachable
  by runtime code, or the residual is documented in
  `docs/PRODUCTION_HARDENING.md`.
