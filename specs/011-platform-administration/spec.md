# Feature Specification: Platform Administration

**Feature Branch**: `011-platform-administration`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "Platform administration surface with tenant inspection, creation, disable, owner assignment, subdomain, and plan/status management for platform operators only."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Inspect every tenant from one dedicated surface (Priority: P1)

A platform operator opens the platform surface and sees every showroom tenant
in one place. The operator can open a tenant and review its identity, lifecycle
status, plan, subdomain, owners, member count, vehicle count, and lead count
without entering any showroom's admin area.

**Why this priority**: Inspection is the foundation for every other platform
action. Without a complete cross-tenant view, an operator cannot make safe
lifecycle decisions.

**Independent Test**: Sign in as a platform operator, open the platform surface,
and confirm both seeded tenants appear with their status, plan, subdomain, and
counts. Open one tenant and confirm the detail view matches the seeded data and
contains no data from the other tenant's private surfaces beyond the permitted
cross-tenant operator view.

**Acceptance Scenarios**:

1. **Given** an active platform operator and two seeded tenants, **When** the
   operator opens the platform surface, **Then** both tenants are listed with
   name, slug, status, plan, subdomain(s), and owner/count summaries.
2. **Given** a listed tenant, **When** the operator opens its detail view,
   **Then** the tenant's identity, domains, owners, member count, vehicle
   count, and lead count are shown.
3. **Given** a tenant that does not exist, **When** the operator requests its
   detail view, **Then** the surface reports that the tenant was not found and
   exposes no other tenant's data.

---

### User Story 2 - Create and configure a tenant (Priority: P1)

A platform operator creates a new showroom tenant, optionally assigns its owner,
sets or changes its platform subdomain, and sets its plan and lifecycle status.
The operator can disable an existing tenant so it stops serving visitors.

**Why this priority**: These are the roadmap's explicit platform capabilities.
Completing them makes OtoWeb operable as a multi-tenant platform rather than a
fixed pair of showrooms.

**Independent Test**: As a platform operator, create a tenant with a unique
name, slug, plan, and subdomain; assign an owner; change the plan and status;
then disable the tenant. Re-open the tenant and confirm every value persisted
and that the disabled tenant no longer serves public traffic.

**Acceptance Scenarios**:

1. **Given** a platform operator, **When** they submit a valid new tenant, **Then**
   the tenant, its default showroom profile, and its platform subdomain are
   created and visible on the platform surface.
2. **Given** an existing tenant and a user identity, **When** the operator
   assigns that identity as owner, **Then** the identity holds an active owner
   membership for that tenant and appears in the tenant's detail view.
3. **Given** an existing tenant, **When** the operator sets a new platform
   subdomain, **Then** the normalized hostname is stored for that tenant and
   no other tenant owns it.
4. **Given** an existing tenant, **When** the operator changes its plan or
   lifecycle status, **Then** the new values persist and are shown in the list
   and detail views.
5. **Given** an active or trial tenant, **When** the operator disables it,
   **Then** the tenant status becomes disabled and its public hostname no
   longer resolves to a serving showroom.
6. **Given** invalid input (duplicate slug, duplicate subdomain, malformed
   hostname, unknown tenant, unknown user identity), **When** the operator
   submits it, **Then** the action is rejected with a clear message and no
   partial write occurs.

---

### User Story 3 - Keep the platform surface away from showroom users (Priority: P1)

A normal showroom owner or staff member cannot reach the platform surface,
cannot see it in showroom navigation, and cannot invoke its actions.

**Why this priority**: Platform administration is a cross-tenant capability.
Exposing it to a showroom role would break the tenant isolation model that the
product depends on.

**Independent Test**: Sign in as an owner or staff member and request the
platform routes and actions directly. Confirm the surface is not found or is
otherwise denied, no platform navigation appears in the showroom admin, and no
tenant or membership changes occur.

**Acceptance Scenarios**:

1. **Given** an unauthenticated visitor, **When** they request the platform
   surface, **Then** they are sent to sign in.
2. **Given** an authenticated showroom owner or staff member, **When** they
   request the platform surface, **Then** the platform interface is not
   rendered and no platform data is disclosed.
3. **Given** a showroom owner or staff member, **When** they invoke a platform
   action directly, **Then** the action is denied before any write occurs.
4. **Given** the showroom admin navigation, **When** an owner or staff member
   uses it, **Then** no platform link or platform capability is presented.

---

### Edge Cases

- A platform operator's own membership becomes inactive while their session is
  still valid: the surface must deny access on the next request.
- A tenant is disabled while its owner is signed in: showroom access must fail
  closed, while platform operators may still inspect and re-enable it.
- A subdomain changes: the previous hostname must stop resolving to the tenant
  and the new hostname must resolve only after the change is saved.
- A hostname already belongs to another tenant or a custom domain: the change
  must be rejected without altering either tenant.
- An owner identity is already a member: assigning ownership must update the
  existing membership rather than create a duplicate.
- An owner identity already holds platform-operator authorization: assigning
  ownership must not silently remove that authorization.
- Creating a tenant with an owner identity that has no profile record: the
  assignment may provision the minimal profile record so the membership is
  valid, or reject it with a clear message; the implementation must document
  which behavior it chose.
- Empty tenant list: the surface must show an instructive empty state, not a
  broken table.
- Invalid or missing tenant identifiers in a route: no other tenant's data may
  be rendered.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a dedicated platform administration
  surface separate from the showroom admin surface.
- **FR-002**: The system MUST list every tenant with name, slug, lifecycle
  status, plan, platform subdomain(s), owner summary, and record counts.
- **FR-003**: The system MUST allow a platform operator to inspect a tenant's
  identity, domains, owners, member count, vehicle count, and lead count.
- **FR-004**: The system MUST allow a platform operator to create a tenant with
  a name, unique slug, plan, lifecycle status, and optional platform subdomain.
- **FR-005**: Creating a tenant MUST also create its default showroom profile
  so the tenant is usable immediately.
- **FR-006**: The system MUST allow a platform operator to assign an owner by
  user identity, creating or updating that tenant's owner membership.
- **FR-007**: The system MUST allow a platform operator to set or change a
  tenant's platform subdomain, rejecting malformed or already-used hostnames.
- **FR-008**: The system MUST allow a platform operator to set a tenant's plan
  and lifecycle status.
- **FR-009**: The system MUST allow a platform operator to disable a tenant,
  after which that tenant no longer serves public traffic.
- **FR-010**: Platform access MUST require an explicit active platform-operator
  authorization; showroom owner and staff roles MUST NOT grant it.
- **FR-011**: Platform routes MUST NOT be linked from showroom admin
  navigation, and showroom users MUST NOT be able to render platform content.
- **FR-012**: Every platform read and write MUST reject unauthorized callers
  before disclosing cross-tenant data or mutating tenant state.
- **FR-013**: Every platform mutation MUST be atomic: invalid input or a failed
  dependent write MUST leave the tenant state unchanged.
- **FR-014**: The surface MUST never expose service-role credentials or
  privileged database configuration to the browser.
- **FR-015**: The surface MUST preserve the incumbent visual language and MUST
  remain usable at desktop and mobile widths.

### Key Entities *(include if feature involves data)*

- **Platform operator**: An authenticated identity holding an active explicit
  platform-operator authorization. The authorization is independent of any
  showroom owner or staff role.
- **Tenant**: A showroom organization with a name, unique slug, lifecycle
  status, plan, and theme. It owns domains, memberships, settings, vehicles, and
  leads.
- **Tenant domain**: A hostname owned by exactly one tenant, typed as a
  platform subdomain or custom domain, with a status and verification state.
- **Tenant membership**: The relationship between an identity and a tenant,
  carrying an owner, staff, or platform-operator role plus an active/inactive
  status.
- **Showroom profile**: The tenant's persisted public configuration, created
  with sensible defaults when a tenant is created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform operator can locate any tenant and read its status,
  plan, subdomain, owner, and counts from at most two navigations (list, then
  detail).
- **SC-002**: A platform operator can create a complete tenant, including its
  default profile and subdomain, in one submission that either fully succeeds
  or writes nothing.
- **SC-003**: 100% of attempted platform actions by showroom owners or staff
  are denied without a tenant or membership change.
- **SC-004**: A disabled tenant stops serving public traffic immediately after
  the status change is saved, verified through its public hostname.
- **SC-005**: Every invalid create, owner, subdomain, plan, or status
  submission is rejected with an actionable message and zero state changes.
- **SC-006**: The platform surface renders without horizontal overflow at
  1440×900 and 390×844 and passes visual QA with no cross-tenant content leak.

## Assumptions

- Platform-operator authorization is the existing explicit platform-operator
  membership role; it is provisioned out of band by an administrator, never by
  showroom self-service.
- Showroom accounts and identities are operator-invited through the identity
  provider; the product exposes no public registration.
- The existing tenant schema already carries lifecycle status, plan, and
  platform subdomains, so no new tenant capability category is required.
- The existing tenant/domain/membership tables and their isolation rules are
  the source of truth; platform administration consumes them rather than
  duplicating tenant data.
- "Assign owner" receives the identity's stable user identifier from the
  operator. Email-based lookup is out of scope because it would require
  privileged identity-provider credentials.
- Plan names are operator-supplied labels; the roadmap does not define a fixed
  pricing catalogue.
- The platform surface is an internal operations tool and does not need a
  public marketing entry point.
