# Data Model: Subdomain Routing

**Feature**: `012-subdomain-routing` | **Date**: 2026-10-19

No database migration is required. The feature reads the existing `tenants` and
`tenant_domains` tables and adds configuration-derived values.

## Existing Entities

### Tenant (`tenants`)

| Field | Type | Routing relevance |
|---|---|---|
| `id` | uuid | Stable tenant identity returned to public queries |
| `name` | text | Showroom branding shown to visitors |
| `slug` | text, unique | Wildcard identity: `<slug>.<platform-root>` |
| `status` | enum (`active`, `trial`, `suspended`, `disabled`) | Only `active` and `trial` are usable |
| `plan` | text | Passed through to the tenant identity |

### Tenant Domain (`tenant_domains`)

| Field | Type | Routing relevance |
|---|---|---|
| `id` | uuid | Stable domain identity |
| `tenant_id` | uuid | Owner tenant |
| `hostname` | text, unique | Exact hostname key |
| `type` | enum (`platform_subdomain`, `custom_domain`) | Platform subdomains seed development aliases; custom domains remain F014 |
| `status` | text | Must be `active` for an exact match |
| `verified_at` | timestamptz | Must be non-null for an exact match |

## Derived Values

### Platform Root

- Source: `TENANT_ROOT_DOMAIN` (server-only), default `otoweb.id`.
- Development/test additionally include `localhost`.
- Production uses only the configured/default root.
- A request host matches a root when it ends with `.<root>` and the prefix is
  exactly one DNS label.

### Wildcard Label

- The single DNS label preceding a configured root, for example `prima` in
  `prima.otoweb.id` or `prima-auto-gallery` in
  `prima-auto-gallery.otoweb.id`.
- Multi-label prefixes (`a.b.otoweb.id`), the root itself, and unrelated
  suffixes do not produce a label.

### Development Alias

- Derived, not stored.
- Valid only for the `localhost` root outside production.
- Resolves a label to the tenant owning exactly one active, verified
  `platform_subdomain` whose first label equals the requested label.
- Example: `prima.otoweb.id` → `prima.localhost`; `tenant-b.otoweb.id` →
  `tenant-b.localhost`.
- Zero matches or multiple matches fail closed.

## Resolution State Model

```text
input hostname
  |
  +-- malformed ------------------------------------> unknown_hostname
  |
  +-- exact active + verified domain
  |     +-- tenant active/trial ---------------------> tenant
  |     +-- tenant suspended/disabled ---------------> tenant_unavailable
  |
  +-- exact inactive/unverified domain --------------> unknown_hostname
  |
  +-- single-label subdomain of a configured root
  |     +-- slug matches usable tenant --------------> tenant
  |     +-- slug matches unusable tenant ------------> tenant_unavailable
  |     +-- localhost development alias, one match ---> tenant or tenant_unavailable
  |     +-- localhost development alias, 0 or >1 -----> unknown_hostname
  |     +-- no match --------------------------------> unknown_hostname
  |
  +-- bare loopback in development
  |     +-- configured development slug -------------> tenant (documented convenience)
  |
  +-- otherwise -------------------------------------> unknown_hostname / no tenant
```

## Invariants

- A request never resolves to a default tenant in production.
- An exact domain record never falls through to wildcard inference.
- Wildcard inference never crosses tenant boundaries: it returns exactly one
  tenant or a denial.
- Tenant-scoped reads receive the resolved tenant id; no browser-supplied tenant
  id is trusted.
- No new persistent identifier, migration, or service-role read is introduced.
