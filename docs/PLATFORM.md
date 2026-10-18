# Platform Administration

Status: implemented in Phase 12 (F012). Source of intent:
`docs/ROADMAP.md` §54 and `specs/011-platform-administration/`.

The platform surface is the cross-tenant operations console for OtoWeb. It is
separate from every showroom admin area: a different route (`/platform`), a
different shell, and a different authorization rule. Showroom owners and staff
never see or reach it.

## What exists

| Artifact | Purpose |
|---|---|
| `app/platform/` | Operator-only layout, tenant list, create route, tenant detail |
| `components/platform-shell.tsx` | Dark, separate platform shell with two-item navigation |
| `components/platform/status-badge.tsx` | Shared lifecycle status labels and state colors |
| `components/platform/create-tenant-form.tsx` | Create tenant + default profile + subdomain + owner |
| `components/platform/tenant-controls.tsx` | Plan, status, owner, subdomain, and disable controls |
| `components/platform/custom-domains.tsx` | Custom-domain registration, DNS instructions, verification, and SSL state |
| `lib/platform/domain-service.ts` | Registration and verification lifecycle over the provider boundary |
| `lib/domains/` | Server-only DNS/SSL provider interface, fake provider, HTTP adapter |
| `lib/platform/auth.ts` | Explicit platform-operator authorization |
| `lib/platform/validation.ts` | Client-safe zod contracts and hostname normalization |
| `lib/platform/tenant-service.ts` | Cross-tenant reads and atomic mutations |
| `lib/platform/actions.ts` | `'use server'` boundary and path revalidation |
| `lib/platform/types.ts` | Serializable view models |
| `lib/tenant/session.ts` | `withPlatformSession` transaction-local RLS helper |
| `proxy.ts` | Session guard for `/platform/:path*` in addition to `/admin/:path*` |
| `db/seed-core.ts` | Deterministic `platform_admin` QA fixture |

No database migration is required. The existing `tenants`, `tenant_domains`,
`profiles`, `tenant_members`, `showroom_settings`, `vehicles`, and `leads`
tables already model every capability.

## Routes

| Route | Access | Purpose |
|---|---|---|
| `/platform` | Active platform operator | List every tenant with status, plan, subdomain(s), owners, and counts |
| `/platform/tenants/new` | Active platform operator | Create a tenant |
| `/platform/tenants/[id]` | Active platform operator | Inspect and configure one tenant |
| `/login?next=/platform` | Unauthenticated visitor | Sign in and return to the platform |

Unknown or malformed tenant ids return not-found. An authenticated showroom
owner or staff member also receives not-found, so the surface is not disclosed.

## Authorization

Platform access requires an **active `tenant_members` row with
`role = 'platform_admin'`** for the signed-in identity. This is deliberately:

- independent of the request hostname,
- independent of the operator's own showroom tenant status,
- never satisfied by a showroom `owner` or `staff` role.

The check runs at three layers:

1. **Proxy** — a server-verified Supabase session is required for
   `/platform/:path*`.
2. **Layout/page** — `requirePlatformOperatorPage()` resolves the explicit
   membership; otherwise it redirects unauthenticated users to sign-in and
   returns not-found to authenticated non-operators.
3. **Data layer** — every service call opens `withPlatformSession`, then
   re-queries the actor's active `platform_admin` membership inside the
   transaction before reading or writing. A privileged application connection
   therefore cannot skip the authorization decision.

Server actions use `requirePlatformOperatorAction()` and return a typed
`forbidden` result instead of navigating, so an XHR can never be turned into an
HTML redirect.

## Capabilities

| Capability | Surface | Behavior |
|---|---|---|
| Create tenant | `/platform/tenants/new` | One transaction: tenant, default showroom profile, optional platform subdomain, optional owner |
| Disable tenant | Detail → Zona berbahaya | Sets status `disabled`; public hostname and slug resolution fail closed |
| Assign owner | Detail → Pemilik | Accepts the identity UUID, provisions a minimal profile when missing, upserts the membership |
| Inspect tenant | Detail | Identity, theme, creation date, domains, members/owners, vehicle and lead counts |
| Set subdomain | Detail → Subdomain | Normalizes a full hostname, rejects another tenant's hostname, updates the primary platform subdomain in place |
| Set plan/status | Detail → Plan / Status | Persists a plan label and one of `active`, `trial`, `suspended`, `disabled` |
| Register custom domain | Detail → Domain kustom | Stores a pending `custom_domain` row and shows TXT/CNAME instructions |
| Verify custom domain | Detail → Domain kustom | Checks DNS ownership, provisions SSL, and activates routing only when both succeed |

### Owner assignment

Profiles do not store email addresses and the application must never read a
service-role key, so the operator supplies the identity's stable UUID (visible
in the identity provider). If no `profiles` row exists, a minimal row is created
with that id. Assigning ownership preserves an existing `platform_admin` role
instead of downgrading it.

### Subdomains

Input is a full hostname such as `prima.otoweb.id`. It is trimmed, lowercased,
and stripped of a numeric port and one trailing dot, then validated as DNS
labels. The hostname is stored with `type = 'platform_subdomain'`, status
`active`, and `verified_at` set. Another tenant's hostname is a conflict.

Wildcard routing is implemented in F013 and documented in
[`SUBDOMAIN_ROUTING.md`](./SUBDOMAIN_ROUTING.md): a tenant is also reachable as
`<slug>.<TENANT_ROOT_DOMAIN>` without a per-host row, and `*.localhost` provides
development aliases. Custom-domain registration, verification, DNS
instructions, SSL provisioning, and the platform-subdomain fallback are
implemented in F014 and documented in [`CUSTOM_DOMAINS.md`](./CUSTOM_DOMAINS.md).

### Disable

`disabled` and `suspended` tenants already fail closed in
`findTenantByHostname` / `findTenantBySlug`, so disabling a tenant immediately
stops public traffic. Data is retained. The status editor can re-enable it.

## Validation

The create form and every mutation share the same contracts in
`lib/platform/validation.ts`:

| Field | Rule |
|---|---|
| Tenant name | 1–120 characters, trimmed |
| Slug | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1–63 characters |
| Plan | `^[a-z0-9][a-z0-9_-]*$`, 1–40 characters |
| Status | `active`, `trial`, `suspended`, `disabled` |
| Hostname | Full DNS hostname, 2+ labels, 253 characters max |
| User id | UUID |

Invalid input returns field errors and writes nothing. Duplicate slugs and
hostnames are conflicts. Tenant creation is atomic: a conflict leaves the
database unchanged.

## Seed fixture

The deterministic seed now includes:

| Fixture | Value |
|---|---|
| Profile / user id | `50000000-0000-4000-8000-000000000003` |
| Name | Platform Operator |
| Membership | active `platform_admin` on the Prima tenant |

This fixture exists for development and QA only. In production, platform
authorization is provisioned by the operator through the identity provider and
the membership table; it is never self-service.

## Verification

```bash
# Unit: authorization, validation, atomic service transactions, RLS behavior
npx vitest run tests/unit/platform tests/unit/tenant tests/unit/db

# Operator acceptance (QA fake auth as the platform operator)
npx playwright test --config playwright.platform.config.ts tests/e2e/platform.spec.ts
npx playwright test --config playwright.platform.config.ts tests/e2e/custom-domains.spec.ts

# Detector
/home/adrputra/.agents/skills/impeccable/scripts/impeccable detect --json \
  app/platform components/platform-shell.tsx components/platform

# Visual QA: desktop 1440×900 + mobile 390×844
node scripts/visual-qa-platform.mjs

# Full checkpoint
npx tsc --noEmit
npm test
```

Visual evidence is written under `.visual-qa/screenshots/` and
`.visual-qa/reports/`. The operator acceptance suite covers the anonymous
redirect, tenant inspection, tenant creation, owner assignment, subdomain
change, plan/status persistence, disable, and the absence of platform links in
showroom admin navigation. Unit tests cover owner/staff/inactive/unknown
denial, including under the restricted RLS role.

## Boundaries

- Never read or expose a service-role credential.
- Never add `/platform` to `components/admin-shell.tsx`.
- Never authorize platform actions from a showroom role or a resolved tenant
  context alone.
- Never weaken the tenant isolation suite to make a platform change pass.
- No billing integration or invite email.
- Custom-domain management is operator-only and lives in
  [`CUSTOM_DOMAINS.md`](./CUSTOM_DOMAINS.md). The platform subdomain remains a
  fallback for every tenant.
