# Feature Specification: Lead Capture

**Feature Branch**: `009-lead-capture`

**Created**: 2026-10-19

**Status**: Ready for planning

**Input**: Roadmap §52 — implement the lead table, contact form, WhatsApp
tracking, lead dashboard, and lead status updates. Do NOT create advanced CRM
features. Acceptance: a customer inquiry becomes a tenant lead and appears in
the admin dashboard.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit an inquiry and create a tenant lead (Priority: P1)

A visitor browsing a showroom's public website opens the contact area, enters
their name, phone number, optional email, and message, and submits the form. The
showroom receives a new lead in its own admin dashboard. The submission belongs
to the showroom resolved from the request hostname and never to another tenant.

**Why this priority**: The inquiry-to-lead path is the roadmap's explicit
acceptance loop and the reason the feature exists.

**Independent Test**: On the Prima hostname, submit a distinctive contact form
entry; assert a `new` lead exists for the Prima tenant with the submitted values,
that Tenant B has no matching lead, and that the entry appears in the Prima admin
lead dashboard.

**Acceptance Scenarios**:

1. **Given** a visitor on a showroom hostname, **When** they submit a valid
   contact form, **Then** a lead is stored for that hostname's tenant with
   source `contact_form` and status `new`.
2. **Given** an invalid submission (missing name, phone, or message, or an
   invalid email), **When** the visitor submits, **Then** the form shows
   readable field errors and no lead is stored.
3. **Given** a submission while another tenant exists, **When** the lead is
   read back, **Then** only the inquiry hostname's tenant owns the lead and no
   cross-tenant value is exposed.
4. **Given** a successful submission, **When** the response completes, **Then**
   the visitor sees a success confirmation and the form is reset.

---

### User Story 2 - Review and update leads in the admin dashboard (Priority: P2)

An authorized showroom member opens the admin lead dashboard, sees the tenant's
leads with their contact details, vehicle context, source, message, and status,
and moves each lead through the roadmap statuses. The dashboard shows a summary
of lead counts and supports finding a lead.

**Why this priority**: The lead is only actionable when the showroom can see it
and record follow-up progress.

**Independent Test**: As the Prima owner, open `/admin/leads`, find a stored
lead, change its status from `new` to `contacted`, reload, and assert the stored
status and summary counts updated while Tenant B data stays invisible.

**Acceptance Scenarios**:

1. **Given** stored leads, **When** an authorized member opens the lead
   dashboard, **Then** only the active tenant's leads render with name, contact,
   source, message, vehicle context when present, and creation date.
2. **Given** a lead, **When** the member selects any roadmap status (`new`,
   `contacted`, `qualified`, `won`, `lost`), **Then** the status persists and the
   summary counts reflect it after reload.
3. **Given** a tenant with no leads, **When** the dashboard opens, **Then** a
   clear empty state renders instead of mock data.
4. **Given** a staff membership, **When** the member updates a lead status,
   **Then** the update is allowed because staff may manage leads.
5. **Given** a member of another tenant, **When** they target this tenant's lead
   id, **Then** the update is rejected and no row changes.

---

### User Story 3 - Track WhatsApp inquiries (Priority: P3)

A visitor taps a WhatsApp call-to-action on the public site. Before the visitor
is sent to WhatsApp, the showroom records a durable inquiry record with source
`whatsapp`, optionally tied to the viewed vehicle. The record appears in the lead
dashboard alongside contact-form inquiries.

**Why this priority**: WhatsApp is the primary inquiry channel for the target
market, but the contact form alone already delivers the acceptance loop.

**Independent Test**: Request the public WhatsApp redirect for a Prima vehicle,
assert the tenant receives a `whatsapp` lead associated with that vehicle and
that the response redirects to the showroom's configured WhatsApp address; then
assert no lead is created for another tenant.

**Acceptance Scenarios**:

1. **Given** a public vehicle page with a configured WhatsApp number, **When**
   the visitor activates the WhatsApp action, **Then** a `whatsapp` lead is
   recorded for the resolved tenant and the browser is redirected to `wa.me`.
2. **Given** the visitor activates a generic WhatsApp action, **When** tracking
   succeeds, **Then** a `whatsapp` lead without a vehicle association is
   recorded for the resolved tenant.
3. **Given** tracking cannot resolve a tenant, **When** the endpoint is called,
   **Then** no lead is written and the request does not fall back to another
   tenant.
4. **Given** the showroom has no WhatsApp number configured, **When** the action
   is used, **Then** no external redirect invents a number and the visitor is
   returned to the showroom contact area.

---

### Edge Cases

- A contact form is submitted from an unknown hostname: no lead is written and
  the visitor receives a generic failure (not another tenant's data).
- A WhatsApp request names a vehicle slug that belongs to another tenant or does
  not exist: the lead may still record the generic inquiry for the resolved
  tenant, but it must not attach the foreign vehicle.
- A lead's vehicle is later deleted: the lead remains with vehicle context
  cleared rather than being deleted, so the inquiry history survives.
- Phone numbers contain spaces, dashes, parentheses, or a leading `+`: accepted
  and stored as entered after trimming; WhatsApp links derive digits only.
- Email is optional; a blank email persists as empty rather than an invalid
  value.
- Very long or empty messages are rejected with field errors and zero writes.
- Anonymous WhatsApp leads have no visitor name or phone; the dashboard labels
  them clearly instead of showing blank or fake contact data.
- Two tenants with the same contact name and message still produce separate
  tenant-owned leads.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST persist leads in a tenant-owned table with
  `tenant_id`, optional `vehicle_id`, name, phone, email, message, source,
  status, and created/updated timestamps.
- **FR-002**: Lead sources MUST be exactly `contact_form`, `whatsapp`, `phone`,
  and `manual`. Lead statuses MUST be exactly `new`, `contacted`, `qualified`,
  `won`, and `lost`.
- **FR-003**: The public home MUST provide a contact form collecting name, phone,
  optional email, and message, with client-visible validation and a success
  state.
- **FR-004**: The server MUST re-validate every contact submission and MUST write
  a `contact_form` lead with status `new` for the tenant resolved from the
  request hostname.
- **FR-005**: Public lead creation MUST never accept a tenant identifier from the
  browser and MUST never attach a vehicle owned by another tenant.
- **FR-006**: The public WhatsApp actions MUST record a durable `whatsapp` lead
  for the resolved tenant before redirecting to the showroom's configured
  WhatsApp address; vehicle-page actions MUST associate the viewed vehicle.
- **FR-007**: The admin lead dashboard MUST list only the active tenant's leads,
  newest first, including contact details, source, status, message, vehicle
  context, and creation date.
- **FR-008**: The dashboard MUST show tenant-scoped lead summary counts and a
  clear empty state.
- **FR-009**: An authorized member MUST be able to update a lead's status to any
  of the five roadmap statuses; updates MUST be server-authorized and
  tenant-scoped, and staff MUST be allowed by the existing `manage_leads`
  capability.
- **FR-010**: The admin dashboard home MUST show the tenant's real new-lead count
  and recent leads instead of static mock data.
- **FR-011**: PostgreSQL row-level security MUST be enabled and forced on the
  lead table, with SELECT/INSERT/UPDATE/DELETE policies matching the existing
  tenant boundary.
- **FR-012**: The feature MUST NOT add advanced CRM behaviour: no pipelines,
  deal values, assignments, notes, tasks, automation, bulk export, email/SMS
  sending, or WhatsApp Business API integration.
- **FR-013**: The public contact form and admin lead dashboard MUST preserve the
  incumbent neutral/amber visual language and remain usable on desktop and
  mobile.
- **FR-014**: Database credentials, the service-role key, and provider secrets
  MUST never reach the browser.

### Key Entities *(include if data involved)*

- **Lead**: A tenant-owned inquiry. Key attributes: optional vehicle reference,
  visitor name, phone, email, message, source, status, timestamps. Leads are
  created by public inquiries or by the showroom, never shared across tenants.
- **Tenant**: The showroom boundary resolved from the public hostname that owns
  the inquiry and the dashboard view.
- **Vehicle**: Optional context for an inquiry; must belong to the same tenant.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid contact-form submissions create exactly one lead for
  the resolved tenant and appear in that tenant's dashboard.
- **SC-002**: 0 cross-tenant lead reads or writes occur in the isolation suite,
  including direct id targeting.
- **SC-003**: Every roadmap status can be selected and persists across a reload.
- **SC-004**: Invalid submissions produce zero database writes and at least one
  readable field error.
- **SC-005**: A WhatsApp action creates a durable lead before the redirect and
  the redirect target always comes from the resolved tenant's settings.
- **SC-006**: Desktop and mobile captures of the public contact form and admin
  lead dashboard pass visual QA with no horizontal overflow, no unreadable
  contrast, and no cross-tenant leakage.
- **SC-007**: The feature introduces no CRM, automation, export, or messaging
  surface beyond the five roadmap items.

## Assumptions

- "Contact form" lives in the existing public home contact area and uses the
  showroom's tenant identity; no separate public route is required.
- "WhatsApp tracking" is a minimal durable lead record created before the
  redirect. Each action records an inquiry; deduplication and analytics are out
  of scope. Anonymous WhatsApp leads may have empty name/phone because the
  visitor has not supplied them.
- Lead management is available to owner, staff, and platform admin through the
  existing `manage_leads` capability. No new role is introduced.
- The existing F005 hostname resolution, tenant session, RLS helper functions,
  and permission matrix are reused unchanged.
- The admin dashboard home already has a "Lead baru" and "Lead terbaru" area;
  this feature replaces its mock source rather than redesigning the page.
- Anti-spam protections beyond input validation and honeypot-free simplicity are
  out of scope for the MVP.
