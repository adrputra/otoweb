# Subdomain Routing

Status: implemented in Phase 13 (F013). Source of intent:
`docs/ROADMAP.md` §55 and `specs/012-subdomain-routing/`.

One deployment serves every showroom from a wildcard tenant host. The production
example is `prima.otoweb.id`; a second tenant such as `tenant-b.otoweb.id`
serves its own branding, inventory, and contact details from the same process.

## Resolution order

```text
request Host header
  -> normalize (trim, lowercase, strip a numeric port and one trailing dot)
  -> exact active + verified tenant_domains row?
       yes -> that tenant, or fail closed if the tenant is unusable
       no  -> single-label subdomain of a configured root?
                -> tenant slug
                -> development alias (localhost only)
                -> fail closed
  -> public page: not-found when no tenant resolved
```

Exact registrations always win. If a registered hostname is inactive or
unverified, the request fails with `unknown_hostname`; it does **not** fall
through to a wildcard alias. A suspended or disabled tenant returns
`tenant_unavailable`.

## Production

| Input | Result |
|---|---|
| `prima.otoweb.id` | Prima Auto Gallery (exact registered domain) |
| `tenant-b.otoweb.id` | Tenant B Test Showroom (exact registered domain) |
| `prima-auto-gallery.otoweb.id` | Prima Auto Gallery (wildcard slug, no per-host row) |
| `tenant-b-test-showroom.otoweb.id` | Tenant B Test Showroom (wildcard slug) |
| `unknown.otoweb.id` | not-found |
| `a.b.otoweb.id` | not-found (multi-label prefixes are not tenant aliases) |
| any host outside the configured root | not-found unless registered exactly |

Infrastructure still needs:

- wildcard DNS for `*.otoweb.id` pointing at the deployment;
- a certificate covering the wildcard host (or equivalent platform TLS);
- the deployment-level `TENANT_ROOT_DOMAIN` when the root is not `otoweb.id`.

Wildcard DNS and TLS provisioning are infrastructure concerns. This feature does
not create DNS records or certificates.

### Configuration

| Variable | Scope | Default | Purpose |
|---|---|---|---|
| `TENANT_ROOT_DOMAIN` | server-only | `otoweb.id` | Root suffix for `<slug>.<root>` wildcard hosts |
| `NEXT_PUBLIC_SHOWROOM_SLUG` | server-side at resolution time | `prima-auto-gallery` | Bare-loopback development default only |

`TENANT_ROOT_DOMAIN` is validated at startup by `scripts/validate-env.mjs`. It
must be a lowercase DNS hostname and never includes a path or port.

## Development

Modern browsers resolve `*.localhost` to loopback, so no hosts-file or DNS edit
is required.

| URL | Result |
|---|---|
| `http://prima.localhost:3000` | Prima (short alias from `prima.otoweb.id`) |
| `http://tenant-b.localhost:3000` | Tenant B (short alias from `tenant-b.otoweb.id`) |
| `http://prima-auto-gallery.localhost:3000` | Prima via slug wildcard |
| `http://tenant-b-test-showroom.localhost:3000` | Tenant B via slug wildcard |
| `http://unknown.localhost:3000` | not-found |
| `http://localhost:3000` or `http://127.0.0.1:3000` | documented development default |

### How localhost aliases work

Outside production, `localhost` is an additional routing root. A label is tried
as a tenant slug first. If no tenant has that slug, the resolver looks for
exactly one active, verified `platform_subdomain` whose first DNS label matches:
`prima.otoweb.id` provides `prima.localhost`, and `tenant-b.otoweb.id` provides
`tenant-b.localhost`. Custom domains never seed a localhost alias. Zero or
multiple matches fail closed.

The bare-loopback convenience is deliberately narrow:
`NEXT_PUBLIC_SHOWROOM_SLUG` applies only to `localhost` and `127.0.0.1` in
development. An unknown named subdomain is not silently mapped to Prima.

### Production-shaped hosts locally

Use Chromium host-resolver rules when you need `*.otoweb.id` instead of
`*.localhost`:

```text
--host-resolver-rules=MAP prima.otoweb.id 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1, MAP prima-auto-gallery.otoweb.id 127.0.0.1, MAP tenant-b-test-showroom.otoweb.id 127.0.0.1
```

This is the same mechanism used by `playwright.config.ts` and the focused
visual QA script, so browser tests exercise the verified-domain resolver rather
than a test-only shortcut.

## Interaction with platform administration (F012)

`/platform` still sets an explicit platform subdomain for a tenant. That row is
the exact hostname and takes precedence. Wildcard routing means a tenant can
also be reached as `<slug>.<TENANT_ROOT_DOMAIN>` without a deployment change.
Custom-domain registration, verification, DNS instructions, and SSL are Phase 14
(F014) and are not handled by this resolver beyond exact registered hostnames.

## Safety properties

- No production default tenant. Unknown hosts render not-found.
- Exact inactive/unverified domains fail closed and never fall through.
- Suspended/disabled tenants fail closed on exact, slug, and alias paths.
- Multi-label prefixes and suffix-spoofed hosts (`prima.otoweb.id.evil.example`)
  do not resolve.
- Tenant-scoped reads still receive only the resolved tenant id; no
  browser-supplied tenant id is trusted.
- The service-role credential is not involved.

## Verification

```bash
npx vitest run tests/unit/tenant/hostname.test.ts \
  tests/unit/tenant/development-hosts.test.ts \
  tests/unit/tenant/wildcard-safety.test.ts \
  tests/unit/public/tenant-resolution.test.ts

npx playwright test tests/e2e/subdomain-routing.spec.ts
npm run visual:qa:subdomain
npx tsc --noEmit
npm test
```

The visual command writes:

- `.visual-qa/reports/f013-subdomain-routing-visual-qa.md`
- `.visual-qa/reports/f013-subdomain-routing-capture.json`
- desktop/mobile screenshots under `.visual-qa/screenshots/<viewport>/f013-*`

The raw-HTTP spec proves server responses for exact hosts, wildcard slug hosts,
localhost aliases, and unknown hosts. The visual capture proves the rendered
two-host acceptance at desktop 1440×900 and mobile 390×844.

## Troubleshooting

| Symptom | Check |
|---|---|
| `prima.localhost` shows not-found | The tenant must have an active, verified `platform_subdomain`; check the first label matches. |
| Production wildcard host shows not-found | `TENANT_ROOT_DOMAIN`, DNS wildcard, and the tenant slug. |
| A disabled domain still serves | Confirm the request host is not an active exact row for another tenant. Inactive exact rows fail closed. |
| A new tenant is unreachable | Check tenant status (`active`/`trial`) and slug; exact platform subdomains are optional under wildcard routing. |
