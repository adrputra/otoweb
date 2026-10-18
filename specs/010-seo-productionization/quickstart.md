# Quickstart: SEO Productionization

## Prerequisites

- Dependencies installed (`pnpm install`).
- No `DATABASE_URL` is required in development: the app seeds an in-memory
  PGlite database from `db/migrations` on first request.
- The seeded tenants are `prima.otoweb.id` (Prima Auto Gallery) and
  `tenant-b.otoweb.id` (Tenant B Test Showroom).
- The seeded sold vehicle is `/cars/toyota-camry-2019-11`; the seeded draft is
  `/cars/toyota-raize-2022-10`.

## Start the server

```bash
pnpm dev
```

Requests must use a tenant hostname. In a browser, add a host rule or use
`curl` with an explicit `Host` header:

```bash
curl -s -H 'Host: prima.otoweb.id:3000' http://127.0.0.1:3000/
curl -s -H 'Host: prima.otoweb.id:3000' http://127.0.0.1:3000/cars
curl -s -H 'Host: prima.otoweb.id:3000' http://127.0.0.1:3000/cars/toyota-camry-2019-11
curl -s -H 'Host: prima.otoweb.id:3000' http://127.0.0.1:3000/sitemap.xml
curl -s -H 'Host: prima.otoweb.id:3000' http://127.0.0.1:3000/robots.txt
curl -s -H 'Host: tenant-b.otoweb.id:3000' http://127.0.0.1:3000/sitemap.xml
```

These responses are raw server output; no JavaScript runs.

## What to assert

1. Home HTML contains the tenant title, description, canonical, OpenGraph tags,
   and `AutoDealer`/`LocalBusiness` JSON-LD.
2. Inventory HTML contains an inventory title and canonical `<origin>/cars`
   without query parameters.
3. Vehicle HTML contains the roadmap title pattern and self-canonical.
4. The sold vehicle returns a successful response, contains “Terjual”, is not
   `noindex`, contains `SoldOut`, and appears in the sitemap.
5. The Prima sitemap contains only Prima URLs; the Tenant B sitemap contains
   only Tenant B URLs and no Prima vehicles.
6. Tenant B's sitemap does not contain the sold Prima vehicle.
7. Draft `/cars/toyota-raize-2022-10` is absent from the sitemap.
8. `robots.txt` references the request host's `sitemap.xml` and disallows the
   admin/API/auth surfaces.

## Automated validation

```bash
npx tsc --noEmit
npm test
npx playwright test tests/e2e/seo-html.spec.ts
```

The Playwright spec starts the Next.js dev server through the existing
`playwright.config.ts`, then makes raw Node HTTP requests with explicit `Host`
headers. It never evaluates client-side JavaScript.

If a visible UI file must change, also run the Visual QA capture:

```bash
pnpm visual:qa
```
