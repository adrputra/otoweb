# Data Model: Custom Domains

**Feature**: `013-custom-domains` | **Date**: 2026-10-19

## Tenant Domain

Existing table: `tenant_domains`. New columns are additive and nullable or have
safe defaults so existing rows and migrations remain valid.

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | uuid | no | `gen_random_uuid()` | Existing |
| `tenant_id` | uuid | no | — | Existing FK, `ON DELETE CASCADE` |
| `hostname` | text | no | — | Existing, globally unique, normalized lowercase |
| `type` | `tenant_domain_type` | no | `platform_subdomain` | Existing; custom rows use `custom_domain` |
| `status` | text | no | `active` | Existing routing status: `pending`, `active`, `disabled` |
| `verified_at` | timestamptz | yes | null | Existing; set when ownership is verified |
| `verification_status` | text | no | `pending` | New: `pending`, `verified`, `failed` |
| `verification_token` | text | yes | null | New: stable random token for the TXT record |
| `ssl_status` | text | no | `none` | New: `none`, `pending`, `active`, `failed` |
| `ssl_provisioned_at` | timestamptz | yes | null | New: set when certificate becomes active |
| `last_checked_at` | timestamptz | yes | null | New: last verification/provider attempt |
| `created_at` | timestamptz | no | `now()` | Existing |

### Migration behavior

1. Add the new columns with defaults.
2. Backfill existing rows where `status = 'active'` and `verified_at is not
   null` to `verification_status = 'verified'` and `ssl_status = 'active'`
   (platform subdomains are covered by platform wildcard TLS).
3. Keep custom rows at `pending` / `none` until verification succeeds.

### Invariants

- `hostname` is globally unique, so a hostname cannot belong to two tenants.
- A custom row is routable only when `status = 'active'`, `verified_at` is not
  null, `verification_status = 'verified'`, and `ssl_status = 'active'`.
- A platform-subdomain row is routable when `status = 'active'` and
  `verified_at` is not null (existing contract).
- `verification_token` is stable after registration.
- `type = 'custom_domain'` rows never participate in wildcard slug or
  `*.localhost` alias inference.

## State Transitions

### Registration

```text
(none) -> pending / verification=pending / ssl=none
```

### Verification

```text
pending --provider.verifyDns=pending--> pending (last_checked_at)
pending --provider.verifyDns=failed---> failed  (last_checked_at)
pending --provider.verifyDns=verified-> verified (verified_at)
verified --provider.provisionCertificate=active--> ssl=active, status=active
verified --provider.provisionCertificate=pending-> ssl=pending, status=pending
verified --provider.provisionCertificate=failed--> ssl=failed, status=pending
failed  --retry-----------------------------> pending/direct outcome
```

### Routing

```text
custom host request
  -> exact row found?
       no  -> wildcard path (custom hosts are outside the platform root) -> unknown
       yes -> status active AND verified_at AND verification=verified AND ssl=active?
                yes -> tenant usable? yes -> showroom; no -> unavailable
                no  -> unknown (fail closed, no wildcard fallthrough)
platform subdomain request
  -> independent exact/wildcard path, unaffected by custom rows
```

## View Model

`PlatformTenantDomain` adds:

| Field | Type | Purpose |
|---|---|---|
| `verificationStatus` | `pending \| verified \| failed` | Operator-visible ownership state |
| `verificationToken` | string or null | Value behind the TXT instruction |
| `sslStatus` | `none \| pending \| active \| failed` | Operator-visible certificate state |
| `sslProvisionedAt` | ISO string or null | When the certificate became active |
| `lastCheckedAt` | ISO string or null | Last provider attempt |
| `dnsInstructions` | instruction list or null | TXT + CNAME records for custom rows |

Each instruction has `type` (`TXT` or `CNAME`), `name`, `value`, `ttl`, and
`purpose`.
