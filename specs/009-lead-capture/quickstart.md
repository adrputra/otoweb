# Quickstart: Lead Capture

**Feature**: `009-lead-capture`

## Prerequisites

- Dependencies installed.
- Migrations applied (`pnpm db:migrate`) or the development PGlite fallback
  available.
- For the admin loop, the QA fake auth server and cookie flow documented in
  `docs/ADMIN.md`.

## 1. Schema and RLS

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:verify
```

Expected: `leads` exists with the two enums, the tenant/vehicle foreign keys,
and RLS enabled and forced.

## 2. Unit proof

```bash
npx vitest run tests/unit/validation/lead.test.ts \
  tests/unit/public/lead-capture.test.ts \
  tests/unit/admin/leads.test.ts \
  tests/unit/tenant/rls.test.ts
```

Expected: valid submissions create one tenant lead; invalid submissions write
nothing; cross-tenant reads/updates return no rows; statuses round-trip.

## 3. End-to-end acceptance

```bash
npx playwright test --config playwright.admin.config.ts tests/e2e/admin-leads.spec.ts
```

Expected: a public contact submission appears in `/admin/leads`, a status change
persists after reload, and a WhatsApp activation creates a source-`whatsapp`
lead with a vehicle association.

## 4. Visual evidence

```bash
node scripts/visual-qa-leads.mjs
```

Expected: desktop 1440×900 and mobile 390×844 screenshots of the public contact
form and admin lead dashboard under `.visual-qa/screenshots/`, a capture report
under `.visual-qa/reports/`, no horizontal overflow, no cross-tenant text, and a
`PASS` verdict.

## 5. Checkpoint

```bash
npx tsc --noEmit
npm test
```
