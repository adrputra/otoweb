# Quickstart: Subdomain Routing

**Feature**: `012-subdomain-routing` | **Date**: 2026-10-19

## Prerequisites

- Dependencies installed (`pnpm install`).
- No `DATABASE_URL` is required in development; the in-memory PGlite fallback is
  migrated and seeded automatically.
- Modern Chromium resolves `*.localhost` to loopback.

## 1. Start one deployment

```bash
pnpm dev
```

Expected: Next.js starts on `http://localhost:3000` and seeds Prima Auto Gallery
and Tenant B Test Showroom.

## 2. Verify tenant hostnames in a browser

| URL | Expected |
|---|---|
| `http://prima.localhost:3000` | Prima Auto Gallery branding, Prima inventory, Prima contact details |
| `http://tenant-b.localhost:3000` | Tenant B Test Showroom branding, Tenant B contact details, no Prima inventory |
| `http://prima-auto-gallery.localhost:3000` | Prima via slug wildcard |
| `http://tenant-b-test-showroom.localhost:3000` | Tenant B via slug wildcard |
| `http://unknown.localhost:3000` | Not found; no default showroom |
| `http://localhost:3000` | Documented development default (Prima) |

For production-shaped hosts without editing DNS, use Chromium host-resolver
rules:

```text
--host-resolver-rules=MAP prima.otoweb.id 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1, MAP prima-auto-gallery.otoweb.id 127.0.0.1, MAP tenant-b-test-showroom.otoweb.id 127.0.0.1
```

Then open:

| URL | Expected |
|---|---|
| `http://prima.otoweb.id:3000` | Prima (exact registered domain) |
| `http://tenant-b.otoweb.id:3000` | Tenant B (exact registered domain) |
| `http://prima-auto-gallery.otoweb.id:3000` | Prima (wildcard slug, no exact row) |
| `http://tenant-b-test-showroom.otoweb.id:3000` | Tenant B (wildcard slug, no exact row) |

## 3. Run focused tests

```bash
npx vitest run tests/unit/tenant/hostname.test.ts tests/unit/public/tenant-resolution.test.ts
npx playwright test tests/e2e/subdomain-routing.spec.ts
npm run visual:qa:subdomain
```

Expected:

- Unit tests cover exact, wildcard, development alias, inactive domain,
  suspended tenant, ambiguity, and suffix-spoof cases.
- The raw-HTTP e2e spec proves both hosts return their own branding, inventory,
  and contact details from one server.
- The visual script writes desktop and mobile screenshots plus a report under
  `.visual-qa/` with a PASS verdict.

## 4. Full checkpoint

```bash
npx tsc --noEmit
npm test
```

Both must pass. Do not weaken or skip tenant-isolation tests.

## Rollback

Revert the feature commit. No database migration or data backfill is involved;
exact registered hostnames continue to resolve through the pre-existing path.
