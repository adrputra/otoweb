# Quickstart: Custom Domains

**Feature**: `013-custom-domains` | **Date**: 2026-10-19

## Prerequisites

- Dependencies installed (`pnpm install`).
- No `DATABASE_URL` is required in development; the in-memory PGlite fallback is
  migrated and seeded automatically.
- The fake domain provider is the development default, so no DNS or CA
  credentials are needed.

## 1. Register and verify through the platform console

```bash
pnpm dev
```

Sign in as the seeded platform operator, then open:

```text
http://prima.otoweb.id:3000/platform/tenants/11111111-1111-4111-8111-111111111111
```

1. Under **Domain kustom**, enter `showroom.prima.test` and choose
   **Daftarkan domain**.
2. Confirm the pending state and the two DNS instructions (TXT + CNAME).
3. Choose **Verifikasi DNS**. With the fake provider the domain moves to
   verified and the certificate to active.

Expected: the domain list shows `showroom.prima.test` as a custom domain with
verification verified, SSL active, and a last-check timestamp.

## 2. Verify routing and fallback

Use Chromium host-resolver rules (no DNS edit):

```text
--host-resolver-rules=MAP showroom.prima.test 127.0.0.1, MAP prima.otoweb.id 127.0.0.1
```

| URL | Expected |
|---|---|
| `http://showroom.prima.test:3000/` | Prima Auto Gallery showroom |
| `http://prima.otoweb.id:3000/` | Same showroom via the platform subdomain |
| `http://prima.otoweb.id:3000/cars` | Prima inventory still reachable |

Then register a second domain and leave it pending:

| URL | Expected |
|---|---|
| `http://pending.prima.test:3000/` | Not found; no showroom |
| `http://prima.otoweb.id:3000/` | Still the Prima showroom |

## 3. Run focused tests

```bash
npx vitest run tests/unit/domains tests/unit/platform/domain-service.test.ts tests/unit/platform/validation.test.ts
npx vitest run tests/unit/tenant/hostname.test.ts tests/unit/public/tenant-resolution.test.ts
npx playwright test --config playwright.platform.config.ts tests/e2e/custom-domains.spec.ts
npm run visual:qa:custom-domains
```

Expected:

- Service tests cover registration, pending/failed/verified transitions,
  certificate gating, cross-tenant isolation, authorization, custom routing, and
  platform-subdomain fallback.
- The platform e2e registers and verifies through the real UI, then fetches the
  custom Host and the platform subdomain from one server.
- The visual script writes desktop/mobile screenshots and a PASS report under
  `.visual-qa/`.

## 4. Full checkpoint

```bash
npx tsc --noEmit
npm test
```

Both must pass. Do not weaken tenant-isolation, platform-authorization, or
wildcard-routing tests.

## Production configuration

Set a real provider adapter's server-only values:

```dotenv
DOMAIN_PROVIDER=http
DOMAIN_PROVIDER_URL=https://provisioner.example.internal
DOMAIN_PROVIDER_TOKEN=<server-only-token>
CUSTOM_DOMAIN_CNAME_TARGET=otoweb.id
```

The adapter contract is documented in
[`contracts/domain-provider.md`](./contracts/domain-provider.md). Without a
provider, production verification fails closed rather than reporting a fake
success.

## Rollback

Revert the feature commit and apply the migration rollback equivalent in a
controlled environment: drop the added `tenant_domains` columns. Existing
platform subdomains and wildcard routing continue to work because their contract
is unchanged.
