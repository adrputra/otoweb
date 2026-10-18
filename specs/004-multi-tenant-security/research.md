# Research: Multi-Tenant Security

**Feature**: `004-multi-tenant-security`  
**Date**: 2026-10-19

## Decision: Context precedence

Resolve an admin tenant context in this order:

1. An explicit tenant identifier supplied by a trusted server route.
2. A hostname that maps to an active tenant domain.
3. The user's single active membership.

If the explicit tenant, hostname tenant, and membership disagree, deny with
`tenant_mismatch`. If more than one active membership remains and no explicit tenant
or hostname disambiguates, deny with `ambiguous`. Unknown hostnames do not block a
single-membership request; they simply contribute no tenant candidate.

**Rationale**: Explicit intent outranks ambient signals, and a verified hostname is a
stronger signal than an arbitrary default. Refusing ambiguity avoids silently exposing
one showroom's data on another's domain. **Alternatives considered**: hostname first
(wrong for admin users working from a shared localhost), always pick the first
membership (silent cross-tenant risk).

## Decision: Active tenant states

`active` and `trial` tenants are usable. `suspended` and `disabled` deny all access.
Memberships must have status `active`.

**Rationale**: The F003 seed fixture Tenant B is `trial` and must work for isolation
tests; suspended/disabled are administrative lock states. **Alternatives
considered**: only `active` (would break the required tenant-b fixture), treating
`trial` as read-only (adds unrequested policy).

## Decision: Platform administrator semantics

A membership with role `platform_admin` grants cross-tenant access to any active
tenant when a tenant is explicitly selected. A platform administrator without an
explicit tenant still resolves to their own single membership; multiple memberships
remain ambiguous. The platform-admin flag passed to the database is derived
server-side from the membership, never from a request header.

**Rationale**: F012 platform administration needs cross-tenant inspection, but global
access must still be an explicit, auditable action. **Alternatives considered**:
automatic access to every tenant (leaks data by default), separate platform-admin
table (schema rewrite, out of scope).

## Decision: Hostname normalization

Trim whitespace, lowercase, strip one trailing dot, strip a port, reject path/query
characters and malformed labels, and cap at 253 characters. Resolve only domains with
status `active`, a non-null `verified_at`, and an active/trial tenant. Unknown or
invalid input returns no tenant.

**Rationale**: Host headers are attacker-influenced; a strict parser plus no default
fallback is the only safe behavior. **Alternatives considered**: query the raw header
(port/case mismatches), default to prima (cross-tenant leak).

## Decision: Application scoping plus RLS

Every tenant-owned query takes a required tenant id and filters by it. RLS policies
independently restrict rows using transaction-local server settings. The scoped
session helper issues `set_config(..., true)` inside a transaction and runs the
callback on that transaction.

**Rationale**: The application may connect with an elevated credential (Supabase
pooler/postgres role) that bypasses RLS; thus RLS alone is insufficient for normal
queries. Conversely, application scoping alone is bypassed by direct database access;
RLS provides the independent boundary. **Alternatives considered**: RLS only
(privileged connection bypass), application only (no direct-DB protection),
session-wide `SET` (leaks across pooled connections).

## Decision: RLS helper functions and policies

Create stable SQL helpers in schema `app`: `current_tenant_id()`,
`current_user_id()`, `is_platform_admin()`, and a `SECURITY DEFINER`
`is_tenant_owner()`. Enable and force RLS on `tenants`, `tenant_domains`, `profiles`,
`tenant_members`, `showroom_settings`, `vehicles`, and `vehicle_images`. Use
`USING` + `WITH CHECK` for read/write policies. The owner check is
`SECURITY DEFINER` so it can read `tenant_members` without recursive policy
evaluation.

**Rationale**: Policies must work for both Supabase tenant-facing roles and the
restricted test role. Safe GUC casts keep malformed settings from erroring or
defaulting open. **Alternatives considered**: JWT claims only (not available to the
Drizzle/pglite path), a separate policy per role (duplicative).

## Decision: Restricted role in the RLS proof

The PGlite proof creates a `NOLOGIN` role with no `BYPASSRLS`, grants the needed
table privileges, `SET ROLE`s to it, and sets the tenant GUC. The owner/superuser path
is used only for setup and for asserting the fixture data.

**Rationale**: PostgreSQL superusers and (without `FORCE`) owners bypass RLS; a test
as the owner would be vacuous. **Alternatives considered**: `FORCE` alone (owner still
bypasses as superuser in PGlite/Supabase), separate database (no Docker).

## Decision: Service-role boundary

Never read a service-role key in application code for this feature. Keep the existing
browser client restricted to `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`; put a runtime
browser guard in server-only tenant modules; add a source scan test that fails on a
public service-role variable or a client import of server-only tenant/database
modules.

**Rationale**: The service role bypasses RLS; a single accidental browser import
would defeat every isolation control. **Alternatives considered**: a build-time lint
rule only (not enough for dynamic imports), trusting code review (not evidence).

## Decision: No presentation changes

The admin layout's existing `requireAdminUser()` guard is extended in
`lib/auth/server.ts` to require a tenant context and redirect to the public home when
it is invalid. No markup, classes, or components change. This keeps the feature
non-UI while enforcing tenant context at the admin boundary.

**Rationale**: The roadmap requires tenant context enforcement but forbids a UI
redesign. A server-library guard gives enforcement without a new visual surface.
**Alternatives considered**: a new 403 page (new UI surface requiring visual QA),
tenant switcher UI (F012/F013 scope).
