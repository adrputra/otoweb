# Quickstart: Connect Public Website to Database

**Feature**: `005-public-website-database`

## Prerequisites

- Node.js 24 and repository dependencies (`pnpm install`).
- No Docker, live Supabase, or network access is required for the test proof.
- The public database proof uses `@electric-sql/pglite` and the committed
  migrations/seed.
- For a production-like run, set `DATABASE_URL` to a migrated and seeded
  PostgreSQL database. In development without `DATABASE_URL`, the app uses an
  in-memory PGlite database seeded from the committed migrations.

## Run the public data suite

```bash
npx vitest run tests/unit/public
```

Expected: tenant scoping, showroom mapping, featured selection, filtering,
sorting, detail lookup, related vehicles, cross-tenant not-found, and the mock
import scan all pass.

## Run the full gates

```bash
npx tsc --noEmit
npm test
```

Both must exit 0. Any failure is a hard stop.

## Run the affected end-to-end smoke test

The public home test resolves Prima through its hostname. Playwright is
configured with a Chromium host-resolver rule so `prima.otoweb.id` reaches the
local dev server.

```bash
npx playwright test tests/e2e/home.spec.ts
```

## Run visual QA

```bash
pnpm visual:qa
```

The script starts `next dev`, captures home, inventory, vehicle detail, and the
Tenant B home at 1440×900 and 390×844, writes screenshots under
`.visual-qa/screenshots/<viewport>/`, and writes the verdict to
`.visual-qa/reports/capture.json`.

Run the mechanical design detector on the changed UI:

```bash
/home/adrputra/.agents/skills/impeccable/scripts/impeccable detect --json \
  app/page.tsx app/cars/page.tsx "app/cars/[slug]/page.tsx" components/showroom.tsx \
  > .visual-qa/reports/impeccable-detect.json
```

## Scenarios proven by the suite

1. **Tenant resolution** — Prima and Tenant B hostnames resolve to their own
   tenants; unknown hostnames resolve to no tenant outside development.
2. **Showroom mapping** — stored name, tagline, description, hero image, colours,
   contact, address, opening hours, social links, and SEO fields map to the
   public view.
3. **Listing** — only the active tenant's public vehicles are returned; drafts
   and archives are excluded.
4. **Featured** — only stored `featured` public vehicles appear.
5. **Filtering** — brand, model, price, year, transmission, fuel, and mileage
   predicates narrow the result correctly; invalid values are ignored.
6. **Sorting** — newest, price ascending/descending, newest year, and lowest
   mileage orders are correct with a deterministic tiebreaker.
7. **Detail** — a stored public slug returns the full mapped vehicle and ordered
   images; a draft or cross-tenant slug returns not-found.
8. **Related** — up to three other public units from the same tenant and body
   type are returned.
9. **Mock boundary** — public runtime modules do not import the legacy mock
   catalogue.
10. **Visual** — desktop and mobile captures preserve the incumbent layout with
    no horizontal overflow.

## Expected evidence

- `specs/005-public-website-database/` — spec, plan, research, data model,
  contract, quickstart, tasks.
- `.sdd-toolbox/waves/005-public-website-database.json` — computed wave plan.
- Vitest summary lines for the public data and full suites.
- `npx tsc --noEmit` exit 0.
- `.visual-qa/reports/capture.json` and screenshots under `.visual-qa/`.
- `docs/PUBLIC_SITE.md` — data path, tenant resolution, and local runtime note.
