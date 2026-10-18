# Feature Specification: Multi-Tenant Security

**Feature Branch**: `004-multi-tenant-security`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Multi-Tenant Security: implement tenant memberships, tenant context, hostname resolver, tenant-scoped queries, RLS, permission helpers, and tenant isolation tests. Fixtures: prima and tenant-b. Attempt cross-tenant attacks. Acceptance: all cross-tenant tests fail safely; tenant B data cannot appear for tenant A; direct DB/API attempts are protected; service role never reaches browser. Do not proceed if tenant isolation tests fail."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Resolve a safe tenant context for every request (Priority: P1)

A signed-in showroom member requests an admin surface. The application resolves the
active tenant from the member's active tenant memberships (and, where a hostname is
present, from the verified tenant domain). A member with no active membership, a
membership in a different tenant than the requested one, or a disabled/suspended
tenant is denied rather than shown another showroom's data.

**Why this priority**: Tenant context is the root of every isolation decision. If the
application cannot prove which tenant a request belongs to, every later query and
permission check is unsafe.

**Independent Test**: With the deterministic prima and tenant-b fixtures, resolve a
context for a prima member and a tenant-b member, then attempt a tenant mismatch, a
missing membership, an inactive membership, an inactive tenant, an unknown hostname,
and multiple memberships without a disambiguator. Every unsafe case is denied.

**Acceptance Scenarios**:

1. **Given** an active prima member and no conflicting hostname or requested tenant,
   **When** the context is resolved, **Then** the context is the prima tenant.
2. **Given** an active tenant-b member, **When** the context is resolved, **Then**
   the context is the tenant-b tenant.
3. **Given** a prima member requesting the tenant-b tenant, **When** the context is
   resolved, **Then** the request is denied with a cross-tenant error and no tenant
   data is returned.
4. **Given** an authenticated user with no active membership, **When** an admin
   tenant context is requested, **Then** access is denied.
5. **Given** a member whose active tenant is suspended or disabled, **When** the
   context is resolved, **Then** access is denied.
6. **Given** a member with memberships in more than one tenant and no hostname or
   explicit tenant to disambiguate, **When** an admin context is requested, **Then**
   the request is denied as ambiguous instead of choosing a tenant silently.
7. **Given** a platform administrator membership, **When** they explicitly select
   another active tenant, **Then** the cross-tenant context is allowed.

---

### User Story 2 - Resolve tenants from hostnames without a default fallback (Priority: P2)

A public request arrives with a hostname such as `prima.otoweb.id` or
`tenant-b.otoweb.id`. The application normalizes the hostname, looks up the verified
domain, and returns the matching tenant only when that tenant is active. Unknown,
inactive, or malformed hostnames resolve to no tenant rather than to a default
showroom.

**Why this priority**: Hostname routing is how public visitors reach the correct
showroom. A silent default would leak one tenant's catalogue onto another tenant's
domain.

**Independent Test**: Resolve `prima.otoweb.id`, `tenant-b.otoweb.id`, mixed-case
hostnames with ports and trailing dots, an unknown hostname, and a hostname mapped to
a suspended tenant. The two fixtures resolve correctly and every unsafe case returns
no tenant.

**Acceptance Scenarios**:

1. **Given** the prima domain fixture, **When** `prima.otoweb.id` is resolved,
   **Then** the prima tenant is returned.
2. **Given** the tenant-b domain fixture, **When** `tenant-b.otoweb.id` is resolved,
   **Then** the tenant-b tenant is returned.
3. **Given** mixed case, a port, or a trailing dot, **When** the hostname is
   normalized and resolved, **Then** it resolves to the same tenant.
4. **Given** an unknown hostname, **When** it is resolved, **Then** no tenant is
   returned and no default tenant is substituted.
5. **Given** a hostname whose tenant is suspended or disabled, **When** it is
   resolved, **Then** no tenant is returned.

---

### User Story 3 - Keep tenant data isolated in queries and in the database (Priority: P3)

Every tenant-owned read or write runs through a tenant-scoped path. Even if a caller
supplies another tenant's identifier, the query cannot return or mutate that tenant's
rows. PostgreSQL row-level security independently enforces the same boundary when a
request runs under a tenant-scoped database role.

**Why this priority**: Application scoping prevents accidental cross-tenant reads;
row-level security protects against direct database and API attempts that bypass the
normal repository path. The roadmap requires both.

**Independent Test**: Seed the two fixtures, add a tenant-b vehicle, then run the same
vehicle, image, settings, and membership queries under a prima context and a tenant-b
context. Each context sees only its own rows; cross-tenant select, insert, update, and
delete attempts fail safely. Repeat the reads and writes through PostgreSQL row-level
security under a restricted database role.

**Acceptance Scenarios**:

1. **Given** a prima context, **When** tenant-scoped vehicles, images, settings, and
   memberships are read, **Then** no tenant-b row is returned.
2. **Given** a tenant-b context, **When** the same reads run, **Then** no prima row is
   returned.
3. **Given** a prima context, **When** a tenant-b row is requested by its exact
   identifier, **Then** the result is empty or not found rather than the row.
4. **Given** a prima context, **When** an insert or update targets the tenant-b
   tenant, **Then** the write is rejected or affects zero rows.
5. **Given** a restricted database role with the prima tenant setting, **When** it
   selects from tenant-owned tables, **Then** PostgreSQL row-level security returns
   only prima rows.
6. **Given** a restricted database role with the prima tenant setting, **When** it
   inserts a tenant-b row or updates/deletes a tenant-b row, **Then** PostgreSQL
   rejects the write and the tenant-b data is unchanged.
7. **Given** a write path with no tenant identifier, **When** it is called, **Then**
   it fails closed instead of running an unscoped query.

---

### User Story 4 - Enforce role permissions inside a tenant (Priority: P4)

A tenant member's role determines which admin capabilities are available. Owners can
manage the showroom, vehicles, staff, and leads; staff can operate vehicles and leads
but cannot manage staff or showroom settings; platform administrators can act across
tenants.

**Why this priority**: Tenant isolation stops data crossing between showrooms; role
permissions stop a lower-privileged member from performing owner-only actions inside
their own showroom.

**Independent Test**: Evaluate each capability for owner, staff, and platform
administrator memberships, including inactive memberships and mismatched tenants.
Every matrix cell matches the documented policy and every cross-tenant operation is
denied before the role check.

**Acceptance Scenarios**:

1. **Given** an active owner in the request tenant, **When** any supported capability
   is checked, **Then** it is allowed.
2. **Given** an active staff member in the request tenant, **When** vehicle and lead
   capabilities are checked, **Then** they are allowed; staff and showroom-settings
   capabilities are denied.
3. **Given** an inactive membership, **When** any capability is checked, **Then** it
   is denied.
4. **Given** a membership for a different tenant than the request tenant, **When** any
   capability is checked, **Then** it is denied before role evaluation.
5. **Given** a platform administrator, **When** a capability is checked against any
   active tenant, **Then** it is allowed.

---

### User Story 5 - Keep the service role out of the browser (Priority: P5)

The elevated database/service credential is used only by server-side code, is never
exposed through a public environment variable, and is never imported by browser
modules. Source, environment, and client-boundary checks prove the boundary.

**Why this priority**: A leaked service role bypasses row-level security entirely and
would invalidate every other isolation control.

**Independent Test**: Scan the repository and the browser-facing Supabase client for
service-role references, assert only placeholder values appear in `.env.example`, and
assert the server-only tenant modules fail if evaluated in a browser context.

**Acceptance Scenarios**:

1. **Given** the delivered repository, **When** environment examples and source files
   are scanned, **Then** no real service-role key is present and no service-role
   variable is exposed with a public (`NEXT_PUBLIC_`) prefix.
2. **Given** the browser Supabase client module, **When** its imports are inspected,
   **Then** it does not import a server-only tenant or database module.
3. **Given** the server-only tenant database module, **When** it is evaluated in a
   browser-like context, **Then** it refuses to run.
4. **Given** the automated suite, **When** the service-role boundary tests run,
   **Then** any future public service-role reference fails the suite.

---

### Edge Cases

- A hostname arrives with uppercase letters, a port (`prima.otoweb.id:3000`), a
  trailing dot, or surrounding whitespace; normalization must resolve it correctly.
- A hostname arrives empty, malformed, or with path/query text; it resolves to no
  tenant rather than throwing.
- A tenant domain points at a suspended or disabled tenant; resolution fails closed.
- A user has memberships in two tenants and supplies neither a hostname nor an
  explicit tenant; the request is denied as ambiguous.
- A user supplies an explicit tenant identifier that is not in their memberships;
  the request is denied without revealing whether that tenant exists.
- A membership exists but its status is not `active`; it grants no context or
  capability.
- A tenant row is active but the specific domain is not active/verified; hostname
  resolution fails closed.
- A tenant-scoped query is called without a tenant identifier, with an empty
  identifier, or with a malformed identifier; it fails closed before touching the
  database.
- A restricted database role has no tenant setting; row-level security returns no
  rows and rejects writes rather than defaulting to all rows.
- A platform administrator setting is supplied by the application server only; it is
  never derived from browser input.
- Two tenants use the same vehicle slug; lookups are always qualified by tenant and
  never return the other tenant's vehicle.
- Tenant B has its own settings, membership, and a test vehicle; none of it is
  visible from a prima context.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose active tenant memberships for a server-verified
  user, including the tenant, role (`platform_admin`, `owner`, `staff`), membership
  status, and tenant status. Only memberships with status `active` and tenants in an
  active state MUST participate in access decisions.
- **FR-002**: The system MUST resolve an admin tenant context using a deterministic
  precedence: an explicitly requested tenant, then a hostname-resolved tenant, then
  the user's single active membership. A context is valid only when the resolved
  tenant matches an active membership for that user, unless the user holds a
  platform-administrator membership.
- **FR-003**: The system MUST deny a tenant context when the user has no active
  membership, the membership is inactive, the tenant is suspended/disabled, the
  requested tenant is outside the user's memberships, the hostname conflicts with the
  membership, or multiple memberships remain ambiguous. Denials MUST NOT reveal
  another tenant's data or existence.
- **FR-004**: The system MUST normalize hostnames (case, port, trailing dot,
  whitespace) and resolve them through active tenant domains. Unknown, inactive,
  unverified, or malformed hostnames MUST resolve to no tenant; a default tenant MUST
  NOT be substituted.
- **FR-005**: The system MUST provide tenant-scoped query functions for tenants,
  domains, showroom settings, memberships, vehicles, and vehicle images. Every
  function MUST require a non-empty tenant identifier and MUST filter by that tenant
  in addition to row-level security.
- **FR-006**: Tenant-scoped query functions MUST NOT expose an unscoped variant for
  tenant-owned data. A missing, empty, or malformed tenant identifier MUST fail
  closed.
- **FR-007**: The system MUST add PostgreSQL row-level security for all tenant-owned
  tables (`tenants`, `tenant_domains`, `profiles`, `tenant_members`,
  `showroom_settings`, `vehicles`, `vehicle_images`) using the current tenant and
  user settings. Policies MUST cover SELECT, INSERT, UPDATE, and DELETE with matching
  `USING` and `WITH CHECK` clauses.
- **FR-008**: The system MUST provide a server-side tenant session helper that sets
  the database tenant, user, and platform-administrator settings for the duration of a
  transaction and resets them afterwards, so row-level security applies to scoped
  work instead of trusting a process-wide setting.
- **FR-009**: The system MUST provide permission helpers for at least: view tenant
  data, manage vehicles, manage leads, manage staff, and manage showroom settings.
  Owners receive all in-tenant capabilities; staff receive vehicle and lead
  capabilities only; platform administrators receive all capabilities for active
  tenants. Inactive memberships and tenant mismatches MUST be denied before the role
  is evaluated.
- **FR-010**: Cross-tenant reads by exact identifier MUST return empty/not-found, and
  cross-tenant writes MUST be rejected or affect zero rows. The system MUST NOT
  return a row from another tenant with an authorization flag attached.
- **FR-011**: The Supabase service-role credential MUST NEVER be read by browser code
  or exposed through a `NEXT_PUBLIC_` variable. Server-only tenant/database modules
  MUST refuse to initialize in a browser-like environment. `.env.example` MUST contain
  only placeholders and no service-role secret.
- **FR-012**: The automated suite MUST include deterministic fixtures named `prima`
  and `tenant-b`, and MUST prove: tenant context resolution, hostname resolution,
  tenant-scoped reads and writes, PostgreSQL row-level security for SELECT/INSERT/
  UPDATE/DELETE, the permission matrix, direct DB/API-style cross-tenant attacks, and
  the service-role browser boundary.
- **FR-013**: Tenant isolation tests MUST fail safely (deny/empty/rejected, never
  throw an unhandled cross-tenant leak) and MUST NOT be weakened or skipped. The
  feature MUST NOT be reported complete while any isolation test fails.
- **FR-014**: The feature MUST reuse the existing F003 schema, migrations, and seed
  fixtures. It MUST NOT rewrite or duplicate the existing tenant tables, and it MUST
  NOT add public-site queries, admin CRUD, image upload, or lead features that belong
  to later phases.
- **FR-015**: The feature MUST NOT redesign or restyle existing public or admin
  screens. If any presentation surface is changed, it MUST receive a fresh passing
  visual QA before completion; otherwise the feature is non-UI.
- **FR-016**: The feature MUST document the tenant model, hostname resolution,
  context precedence, permission matrix, row-level security behavior, and how to run
  the isolation suite.

### Key Entities

- **Tenant**: An active showroom organization with a stable id, slug, status, and
  plan. Existing F003 rows for Prima Auto Gallery (`prima`) and Tenant B Test
  Showroom (`tenant-b`) are the fixtures.
- **Tenant domain**: A hostname mapped to exactly one tenant, with a type, status,
  and verification timestamp. Used only for hostname-to-tenant resolution.
- **Membership**: The link between a server-verified user profile and a tenant, with
  a role (`platform_admin`, `owner`, `staff`) and status. Membership status and
  tenant status jointly gate access.
- **Tenant context**: The validated `{ tenant, membership, user }` triple for a
  request, or a typed denial (`unauthenticated`, `no_membership`, `inactive`,
  `tenant_mismatch`, `ambiguous`, `unknown_tenant`, `tenant_unavailable`).
- **Tenant-scoped query**: A data-access function that requires a tenant identifier
  and cannot return or mutate rows from any other tenant.
- **Permission capability**: A named action (`view`, `manage_vehicles`,
  `manage_leads`, `manage_staff`, `manage_settings`) evaluated against the context's
  role and membership state.
- **Tenant session settings**: Server-controlled database values for the current
  tenant, user, and platform-administrator flag used by row-level security.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of cross-tenant read attempts in the isolation suite return zero
  rows from the other tenant, including exact-identifier lookups.
- **SC-002**: 100% of cross-tenant insert, update, and delete attempts are rejected or
  affect zero rows, and the target tenant's data is unchanged afterwards.
- **SC-003**: 100% of invalid tenant-context cases (no membership, inactive
  membership, inactive tenant, tenant mismatch, ambiguous memberships, unknown
  hostname) are denied with a typed result and no tenant payload.
- **SC-004**: The prima and tenant-b fixtures resolve correctly from their hostnames,
  while 100% of unknown and inactive hostnames resolve to no tenant.
- **SC-005**: The permission matrix matches the documented policy for every
  owner/staff/platform-administrator and active/inactive/mismatched combination.
- **SC-006**: 100% of repository, environment, and client-boundary scans find no
  service-role reference in browser-reachable code or public configuration.
- **SC-007**: `npx tsc --noEmit` and `npm test` exit 0 on the delivered repository,
  including the isolation suite.
- **SC-008**: No public or admin presentation surface is restyled; existing public
  page and auth-screen behavior is unchanged.

## Assumptions

- Admin requests are authenticated by F004 and authorized to a tenant by this
  feature. Admin context is derived from the signed-in user's memberships; the
  hostname is an additional disambiguator/verification signal for admin requests and
  the primary resolver for public requests.
- A `platform_admin` membership grants cross-tenant access to any active tenant.
  `owner` and `staff` roles are scoped to the tenant of the membership.
- The existing seed fixtures are authoritative: Prima Auto Gallery has the twelve
  legacy vehicles and Tenant B has no legacy catalogue. Tests may insert a
  tenant-b vehicle through a privileged setup path to prove isolation, without
  changing the committed seed's documented shape.
- The production application may connect with an elevated database credential, so
  application-level scoping is mandatory in addition to row-level security. The
  row-level-security proof runs under a restricted, non-owning database role, matching
  how a tenant-facing client would connect.
- Row-level security reads server-controlled transaction settings; browser input can
  never set the tenant, user, or platform-administrator values.
- Existing public and admin screens continue to render as they do today. This feature
  adds server-side enforcement primitives and tests, not a visual redesign.
- The service-role key is a server deployment secret and is not required for this
  feature's tests. Only the browser-safe URL and anon key remain public.
- Later phases connect the public site to database reads (F006) and implement admin
  CRUD (F007); those capabilities are out of scope here.
