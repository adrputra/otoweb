# Contract: Domain Lifecycle

**Feature**: `013-custom-domains` | **Date**: 2026-10-19

## Registration

**Input**: `tenantId` (UUID), `hostname` (full DNS hostname).

**Validation**:
- Normalize: trim, lowercase, strip a numeric port and one trailing dot.
- Must contain at least two labels, each 1–63 characters, total ≤253.
- Reject paths, queries, userinfo, whitespace, IPv6 literals, and `..`.
- Must not equal or be a subdomain of the configured platform root.
- Must not already exist for any tenant.

**Success**: one `tenant_domains` row with `type = 'custom_domain'`,
`status = 'pending'`, `verification_status = 'pending'`, a stable
`verification_token`, `ssl_status = 'none'`, and no `verified_at`.

**Failure**: `invalid` (field errors) or `conflict` (hostname in use);
no state change.

## DNS Instructions

For hostname `H`, token `T`, and CNAME target `C`:

| Type | Name | Value | TTL | Purpose |
|---|---|---|---|---|
| TXT | `_otoweb-verify.H` | `otoweb-verify=T` | 300 | Prove domain ownership |
| CNAME | `H` | `C` | 300 | Route traffic to the platform |

`C` is `CUSTOM_DOMAIN_CNAME_TARGET` when configured, otherwise the platform
tenant root (`TENANT_ROOT_DOMAIN`, default `otoweb.id`).

## Verification

**Input**: `tenantId`, `domainId`.

The operator must be an active `platform_admin` at the route/action boundary and
again inside the platform transaction.

1. Load the custom row; unknown or platform-subdomain rows return not found.
2. Call `provider.verifyDns({ hostname, token, recordName, recordValue })`.
3. Record `verification_status`, `last_checked_at`, and `verified_at` (only on
   verified). If not verified, `status` stays `pending`.
4. On verified ownership call `provider.provisionCertificate({ hostname })`.
   Record `ssl_status`, `ssl_provisioned_at` (only on active), and set
   `status = 'active'` only when the certificate is active.
5. Return the refreshed tenant detail.

Provider failures are recorded as `failed` states with a human-readable
message; they do not throw away the registration. Repeated verification uses
the same token and instructions.

## Routing

```text
custom host -> exact tenant_domains row
  inactive / missing verified_at / verification != verified / ssl != active
    -> unknown_hostname (no wildcard fallback)
  tenant active or trial -> showroom
  tenant suspended or disabled -> tenant_unavailable
```

The tenant's platform subdomain and wildcard `<slug>.<root>` host remain
independent and continue to resolve while a custom domain is pending or failed.
