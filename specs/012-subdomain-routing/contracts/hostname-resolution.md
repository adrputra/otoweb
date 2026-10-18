# Contract: Hostname Resolution

**Feature**: `012-subdomain-routing` | **Date**: 2026-10-19

## Configuration

| Variable | Scope | Required | Default | Contract |
|---|---|---|---|---|
| `TENANT_ROOT_DOMAIN` | server-only | no | `otoweb.id` | A valid DNS hostname. Determines the production suffix for wildcard tenant hosts. |
| `NODE_ENV` | server/runtime | yes | — | `development` and `test` add `localhost` as a root and enable development aliases; `production` never accepts `localhost`. |
| `NEXT_PUBLIC_SHOWROOM_SLUG` | server-only at resolution time | no | `prima-auto-gallery` | Development convenience for bare `localhost` / `127.0.0.1` only. |

## Exported Resolution Surface

```ts
// lib/tenant/hostname.ts
export function normalizeHostname(input: string | null | undefined): string | null
export function normalizeRootDomain(input: string | null | undefined): string | null
export function platformSubdomainLabel(
  hostname: string | null | undefined,
  rootDomain: string | null | undefined,
): string | null
export function isLoopbackHostname(hostname: string | null | undefined): boolean

export interface HostnameResolutionOptions {
  rootDomains?: readonly string[]
  developmentRootDomains?: readonly string[]
  allowDevelopmentAliases?: boolean
}

export function findTenantByHostname(
  db: Database,
  hostname: string | null | undefined,
  options?: HostnameResolutionOptions,
): Promise<HostnameTenantResult>
```

`HostnameTenantResult` remains:

```ts
type HostnameDenialCode = 'unknown_hostname' | 'tenant_unavailable'
type HostnameTenantResult =
  | { ok: true; tenant: TenantIdentity }
  | { ok: false; error: HostnameDenialCode }
```

## Resolution Contract

| Request host | Condition | Result |
|---|---|---|
| `prima.otoweb.id` | active, verified exact domain; usable tenant | Prima tenant |
| `tenant-b.otoweb.id` | active, verified exact domain; usable tenant | Tenant B tenant |
| `prima-auto-gallery.otoweb.id` | no exact row; slug matches usable tenant | Prima tenant |
| `tenant-b-test-showroom.otoweb.id` | no exact row; slug matches usable tenant | Tenant B tenant |
| `prima.localhost` | development/test; alias from `prima.otoweb.id` | Prima tenant |
| `tenant-b.localhost` | development/test; alias from `tenant-b.otoweb.id` | Tenant B tenant |
| `prima-auto-gallery.localhost` | development/test; slug wildcard | Prima tenant |
| `unknown.otoweb.id` | no exact row, no matching slug/alias | `unknown_hostname` |
| `unknown.localhost` | development/test; no matching slug/alias | `unknown_hostname` |
| `a.b.otoweb.id` | multi-label prefix | `unknown_hostname` |
| `nototoweb.id` | unrelated suffix | `unknown_hostname` |
| `prima.otoweb.id` with inactive/unverified domain | exact row exists but is unusable | `unknown_hostname` (no wildcard fallback) |
| `tenant-b.otoweb.id` with suspended tenant | exact row usable, tenant unusable | `tenant_unavailable` |
| `prima.otoweb.id.evil.example` | suffix spoof | `unknown_hostname` |
| `prima.example.com` | non-platform domain | `unknown_hostname` unless registered exactly |

## Public Resolver Contract

```ts
// lib/public/tenant.ts
export async function resolvePublicTenant(
  deps?: { db?: AppDatabase; hostname?: string | null },
): Promise<TenantIdentity | null>
```

- Calls `findTenantByHostname`.
- Returns the resolved tenant on success.
- In development only, a bare loopback host may use `NEXT_PUBLIC_SHOWROOM_SLUG`.
- Any other unresolved host returns `null`; the page renders not-found.
- Never returns a default tenant in production.

## Non-Goals

- No middleware rewrite.
- No new database table, column, or migration.
- No custom-domain verification, DNS instruction, or SSL provisioning.
- No change to exact-host admin/platform authorization.
