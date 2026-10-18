# Research: Platform Administration

**Feature**: `011-platform-administration` | **Date**: 2026-10-19

## Decision 1 — Authorization model

**Decision**: Platform access requires an active `tenant_members` row with
`role = 'platform_admin'` for the signed-in identity. The check is independent of
the current hostname, showroom tenant context, and tenant status.

**Rationale**: The schema already contains the explicit `platform_admin` role,
and the F005 RLS helper `app.is_platform_admin()` already re-verifies a real
active membership rather than trusting a flag. Reusing it keeps one definition
of platform authority. Showroom owner/staff roles deliberately do not satisfy
the check.

**Alternatives considered**:

- Email allow-list in configuration: rejected because it does not use the
  existing data model and creates a second authorization source.
- A new `platform_operators` table: rejected as unnecessary schema churn; the
  role already exists.
- Deriving operator status from `isPlatformAdmin` on a resolved tenant context:
  rejected because that context can fail when the operator's own tenant is
  disabled, and it requires a tenant/hostname signal that `/platform` does not
  have.

## Decision 2 — No migration

**Decision**: Do not add a migration. Use the existing columns and tables.

**Rationale**: `tenants` already has `status` (`active`/`trial`/`suspended`/
`disabled`) and `plan`; `tenant_domains` already stores platform subdomains with
status and verification; `tenant_members` already stores the `platform_admin`
role. All required capabilities map to existing fields.

**Alternatives considered**:

- A `platform_audit_log` table: useful later, but the roadmap does not require
  it and adding it would expand scope.
- A separate `tenant_subdomains` table: duplicates `tenant_domains`.

## Decision 3 — Assign owner by user identifier

**Decision**: The assign-owner form accepts the identity's stable UUID. If no
`profiles` row exists for that UUID, provision a minimal profile row so the
membership foreign key is valid. Preserve an existing `platform_admin` role
when the identity is already a member.

**Rationale**: The application has no privileged Supabase Admin API access and
must never read a service-role key. Profiles store no email, so email lookup
cannot be implemented safely. Operators already invite accounts through the
identity provider and can copy the user id. Provisioning the profile mirrors the
existing seed convention (`profiles.id` equals the auth user id).

**Alternatives considered**:

- Email lookup through Supabase Admin API: rejected (requires a service-role
  credential in the server environment and a new privileged integration).
- Requiring a pre-existing profile: rejected because real invited identities may
  not have a profile row yet.

## Decision 4 — Subdomain contract

**Decision**: `set subdomain` accepts a full hostname (for example
`new-showroom.otoweb.id`), normalizes case/port/trailing dot, validates labels,
and stores it as the tenant's primary `platform_subdomain`. A hostname already
owned by another tenant is rejected. The previous hostname row is updated in
place, so the tenant does not accumulate duplicate platform subdomains.

**Rationale**: Full-hostname input is unambiguous and does not hardcode a base
domain that will be introduced properly in F013 (Subdomain Routing). Updating in
place makes "set subdomain" idempotent and keeps hostname uniqueness simple.

**Alternatives considered**:

- Accepting only a label and appending a configured base domain: rejected
  because no base domain is configured yet and F013 owns wildcard routing.
- Inserting a new row each time: rejected because it leaves stale hostnames
  resolving to the tenant.

## Decision 5 — Transaction and RLS strategy

**Decision**: Add `withPlatformSession(db, { userId }, callback)` to
`lib/tenant/session.ts`. It opens a transaction and sets transaction-local
`app.user_id` and `app.is_platform_admin = true` with an empty tenant id. Inside
the transaction, platform services re-query the actor's active `platform_admin`
membership before doing work.

**Rationale**: The RLS helper already requires a real membership even when the
flag is set, so this does not create a self-promotion path. Setting the values
transaction-locally avoids leaking platform authority through a pooled
connection. The explicit re-query gives a typed authorization error even on a
privileged connection.

**Alternatives considered**:

- Rely on the privileged application connection: rejected as defense-in-depth
  gap.
- Reuse `withTenantSession`: it requires a tenant id that is meaningless for
  cross-tenant administration.

## Decision 6 — UI approach

**Decision**: Build a separate `PlatformShell` with a dark neutral navigation
rail, the incumbent Inter/Jakarta typography, square corners, thin borders, and
the same form vocabulary as the admin. Do not add `/platform` to
`components/admin-shell.tsx`.

**Rationale**: The roadmap requires a separate surface and "visually separate in
route and navigation". A dark rail distinguishes operations from showroom admin
without introducing a new design system or decorative effects. Operate-mode
guidance applies: scanability, consistent controls, and no ornamental motion.

**Alternatives considered**:

- Reuse `AdminShell` with a nav item hidden for owners: rejected because a
  rendering bug could expose the link and it blurs the security boundary.
- A new visual identity: rejected because the policy requires preserving the
  incumbent design language.

## Decision 7 — QA fixture

**Decision**: Add a deterministic third profile and a `platform_admin`
membership on the Prima tenant in `db/seed-core.ts`. Update seed-count
assertions accordingly.

**Rationale**: Visual QA, Playwright, and local development need an operator
identity. The fixture is dev/seed data only and does not grant platform authority
in production. Keeping it deterministic makes tests repeatable.

**Alternatives considered**:

- Env-gated seeding: rejected as a hidden mode that makes local behavior
  surprising.
- Reusing the Prima owner as platform admin: rejected because it weakens the
  distinction between showroom owner and platform operator that this feature is
  required to prove.

## Decision 8 — Status vs. disable

**Decision**: Provide both a plan/status editor (all four lifecycle statuses)
and an explicit "disable tenant" danger action that sets `disabled`.

**Rationale**: The roadmap lists "disable tenant" and "set plan/status" as
separate capabilities. Both are useful: status editing supports trial/suspended
transitions, while disable is a prominent, safe guardrail.

**Alternatives considered**:

- Only status editing: rejected because the explicit disable capability would be
  less discoverable and harder to audit.
- Only a disable button: rejected because it cannot set trial/suspended/active.
