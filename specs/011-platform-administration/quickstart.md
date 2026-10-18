# Quickstart: Platform Administration

**Feature**: `011-platform-administration`

## Prerequisites

- Dependencies installed.
- The development PGlite fallback is available, or migrations and seeds are
  applied to a configured PostgreSQL database.
- The deterministic seed now includes a platform-operator fixture:
  - profile/user id `50000000-0000-4000-8000-000000000003`
  - active `platform_admin` membership on the Prima tenant.

## 1. Unit proof

```bash
npx vitest run tests/unit/platform tests/unit/tenant tests/unit/db
```

Expected: validation contracts, platform authorization, atomic tenant service
operations, existing tenant isolation, and the seeded platform fixture all pass.

## 2. Operator acceptance

```bash
npx playwright test --config playwright.platform.config.ts tests/e2e/platform.spec.ts
```

Expected:

- anonymous `/platform` redirects to sign-in with `next=/platform`;
- the operator sees both seeded tenants;
- creating a tenant persists its default profile and subdomain;
- assigning an owner, changing plan/status, changing the subdomain, and
  disabling all persist after reload;
- no platform navigation appears in the showroom admin shell.

## 3. Visual evidence

```bash
node scripts/visual-qa-platform.mjs
```

Expected: desktop 1440×900 and mobile 390×844 screenshots of the tenant list,
create form, and Prima detail view under `.visual-qa/screenshots/`, a capture
report under `.visual-qa/reports/`, no horizontal overflow, and a `PASS`
verdict. The script starts the QA-only fake auth server as the platform
operator.

## 4. Detector

```bash
/home/adrputra/.agents/skills/impeccable/scripts/impeccable detect --json \
  app/platform components/platform-shell.tsx components/platform
```

Expected: no blocking findings. Record the output under `.visual-qa/reports/`.

## 5. Checkpoint

```bash
npx tsc --noEmit
npm test
```

Expected: both commands exit 0. The full suite includes the existing tenant
isolation tests; do not proceed if any of them fail.
