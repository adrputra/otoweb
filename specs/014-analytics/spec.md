# Feature Specification: Analytics

**Feature Branch**: `014-analytics`

**Created**: 2026-10-19

**Status**: Draft

**Input**: Roadmap Phase 15 — track `vehicle_view`, `inventory_search`, `filter_use`, `whatsapp_click`, `contact_submit`, and `vehicle_share`, and expose dashboard metrics for vehicle views, most viewed vehicles, WhatsApp clicks, new leads, and conversion percentage. Analytics must not block MVP launch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record first-party showroom interactions for the resolved tenant (Priority: P1)

A visitor browses a showroom's public site. When they open a vehicle detail page, run a search or apply filters on the inventory page, tap the WhatsApp call to action, submit the contact form, or share a vehicle, the platform records the interaction against that showroom only. Recording is best-effort: if the analytics store is unavailable, the page still renders, the WhatsApp redirect still happens when lead capture succeeds, and the contact form still confirms the inquiry.

**Why this priority**: Every dashboard metric depends on trustworthy, tenant-scoped events. Without the six tracked events there is nothing to report.

**Independent Test**: Seed two tenants, drive each public interaction against one tenant, and confirm every event lands under that tenant with the expected type and vehicle association while the other tenant has no matching rows. Force the analytics write to fail and confirm the public response is unchanged.

**Acceptance Scenarios**:

1. **Given** a visitor opens an available vehicle detail page, **When** the page mounts, **Then** one `vehicle_view` event is recorded for the resolved tenant and, when the slug belongs to that tenant, linked to the vehicle.
2. **Given** a visitor loads the inventory page with at least one query parameter, **When** the page mounts, **Then** one `inventory_search` event is recorded with the applied search parameters (no personal data).
3. **Given** a visitor loads the inventory page with one or more filter parameters, **When** the page mounts, **Then** one `filter_use` event is recorded listing the filter keys and values used.
4. **Given** a visitor follows the WhatsApp call to action, **When** the existing WhatsApp route creates the lead successfully, **Then** one `whatsapp_click` event is recorded for the resolved tenant and the same vehicle, and the visitor is redirected to the showroom's WhatsApp number.
5. **Given** a visitor submits the public contact form successfully, **When** the tenant lead is stored, **Then** one `contact_submit` event is recorded for that tenant.
6. **Given** a visitor shares a vehicle detail page, **When** the share action succeeds, **Then** one `vehicle_share` event is recorded for that tenant and vehicle.
7. **Given** the analytics write fails or the analytics table is unavailable, **When** any public page or lead flow runs, **Then** the public page still renders, the contact form still confirms success, the WhatsApp route still redirects, and no error is shown to the visitor.

---

### User Story 2 - See showroom performance metrics in the admin dashboard (Priority: P1)

A showroom owner or staff member opens the admin dashboard and sees the current all-time analytics for their showroom: total vehicle views, the most viewed vehicles, WhatsApp clicks, new leads, and a conversion percentage. Every number is scoped to the authenticated tenant and uses the existing admin authorization boundary.

**Why this priority**: The tracked events only create value when the operator can read them. These are the roadmap's required dashboard metrics.

**Independent Test**: Record known events and leads for two tenants, open the admin dashboard as an owner of each tenant, and confirm the metrics reflect only that tenant's data, including a correctly calculated conversion percentage and a most-viewed ordering with stable ties.

**Acceptance Scenarios**:

1. **Given** recorded vehicle views and leads for the authenticated tenant, **When** the owner opens the admin dashboard, **Then** the dashboard shows the total number of `vehicle_view` events.
2. **Given** multiple vehicles with different view counts, **When** the owner reads the most viewed vehicles panel, **Then** the vehicles are ordered by view count descending and ties resolve deterministically.
3. **Given** recorded `whatsapp_click` events, **When** the owner opens the dashboard, **Then** the WhatsApp click count is shown.
4. **Given** leads with status `new`, **When** the owner opens the dashboard, **Then** the new-lead count is shown.
5. **Given** recorded vehicle views and new leads, **When** the owner reads conversion percentage, **Then** the value equals new leads divided by vehicle views, expressed as a percentage with one decimal place.
6. **Given** no vehicle views for the tenant, **When** the owner opens the dashboard, **Then** conversion is shown as `0.0%` rather than an error or a division by zero.
7. **Given** another tenant's events and leads exist, **When** the owner opens the dashboard, **Then** no other tenant's events, vehicles, or leads contribute to any metric.

---

### User Story 3 - Keep analytics safe, isolated, and non-blocking (Priority: P2)

A platform operator and showroom owner can trust that analytics never exposes personal data, never leaks across tenants, and never becomes a launch blocker. Events contain only interaction facts, the analytics table is protected by the same tenant isolation as the rest of the schema, and an analytics outage degrades metrics rather than the public site.

**Why this priority**: The roadmap explicitly says analytics must not block MVP launch. Isolation and non-blocking behavior are the safety contract that makes that true.

**Independent Test**: Attempt cross-tenant analytics reads and writes with the restricted database role, confirm RLS rejects them, confirm unauthenticated access to admin metrics redirects, and force a failing analytics insert during a contact submission to prove the lead still succeeds.

**Acceptance Scenarios**:

1. **Given** events recorded for Tenant A, **When** Tenant B's restricted database session queries analytics, **Then** Tenant B sees zero Tenant A events.
2. **Given** an analytics write for a tenant, **When** a restricted session attempts to write an event for another tenant, **Then** the row is rejected by tenant isolation.
3. **Given** an unauthenticated visitor, **When** they request the admin dashboard, **Then** the existing authentication boundary redirects them and no metric is exposed.
4. **Given** a public interaction with a malformed analytics payload or an unknown tenant, **When** the beacon is received, **Then** no event is stored and the response is a quiet no-content response without an error surfaced to the visitor.
5. **Given** a visitor submits the contact form while analytics inserts are failing, **When** the lead insert succeeds, **Then** the visitor still receives the success state.

### Edge Cases

- The hostname resolves to no tenant: analytics beacons are dropped with a no-content response and never fall back to another tenant.
- A vehicle slug belongs to another tenant or no longer exists: the event is stored for the resolved tenant without a vehicle association, and the public page is unchanged.
- The same interaction triggers duplicate beacon attempts (for example a retry or React Strict Mode): the UI sends one event per page mount; duplicate server events are acceptable and are not de-duplicated in this phase.
- Search or filter query strings contain unexpected or repeated values: only recognized, bounded values are stored; unknown values are ignored rather than persisted wholesale.
- The contact form and WhatsApp route record their server-side events only after the lead is stored, so a failed lead never produces a conversion event.
- The analytics table is empty: the dashboard shows zeros and an empty state for most viewed vehicles.
- Conversion percentage denominator is zero: the dashboard shows `0.0%`.
- Analytics writes must never throw into the caller. Client beacons swallow network errors; server-side recording catches every error.
- No IP address, user agent, referrer, email, phone number, or free-text message is stored in analytics events.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST record a `vehicle_view` event when a public vehicle detail page is viewed, scoped to the tenant resolved from the request hostname.
- **FR-002**: The system MUST record an `inventory_search` event when the public inventory page is loaded with at least one recognized inventory query parameter (brand, model, transmission, fuel, year, minPrice, maxPrice, maxMileage, or sort), scoped to the resolved tenant.
- **FR-003**: The system MUST record a `filter_use` event when the public inventory page is loaded with at least one recognized filter parameter, scoped to the resolved tenant, including the filter keys and values used.
- **FR-004**: The system MUST record a `whatsapp_click` event through the existing public WhatsApp route after the WhatsApp lead is stored successfully, using that same request and vehicle so the click is not double-counted.
- **FR-005**: The system MUST record a `contact_submit` event after a public contact-form lead is stored successfully.
- **FR-006**: The system MUST record a `vehicle_share` event after a visitor successfully invokes the share action on a vehicle detail page.
- **FR-007**: Every analytics event MUST store the resolved tenant id, the event type, an optional same-tenant vehicle id, bounded metadata, and a creation timestamp.
- **FR-008**: Analytics recording MUST be non-fatal: a failure to record MUST NOT prevent public rendering, contact-form success, or the WhatsApp redirect.
- **FR-009**: Analytics events MUST NOT store personal data, IP addresses, user agents, referrers, or free-text inquiry content.
- **FR-010**: The analytics table MUST be tenant-isolated with row-level security matching the existing schema conventions, and cross-tenant reads and writes MUST fail safely.
- **FR-011**: The admin dashboard MUST show the authenticated tenant's total vehicle views, most viewed vehicles, WhatsApp clicks, new leads, and conversion percentage.
- **FR-012**: The most viewed vehicles panel MUST order by view count descending and resolve ties deterministically.
- **FR-013**: Conversion percentage MUST equal new leads divided by vehicle views, expressed as a percentage with one decimal place, and MUST render `0.0%` when there are no views.
- **FR-014**: All dashboard metrics MUST be tenant-scoped and available only inside the existing authenticated admin boundary.
- **FR-015**: The public tracking transport MUST accept only the six defined event types, validate payload shape and size, and respond quietly for invalid, unknown-tenant, or failed writes.
- **FR-016**: The feature MUST NOT require an external analytics vendor, a new third-party script, or a launch-blocking configuration value.

### Key Entities

- **Analytics Event**: A first-party interaction record. It has a tenant, an event type drawn from the six defined names, an optional vehicle, bounded JSON metadata, an optional page path, and a creation timestamp.
- **Tracked Event Type**: One of `vehicle_view`, `inventory_search`, `filter_use`, `whatsapp_click`, `contact_submit`, or `vehicle_share`.
- **Vehicle View Count**: The number of `vehicle_view` events linked to a vehicle for a tenant, used by the most-viewed ordering.
- **Dashboard Metric Set**: The tenant-scoped aggregate of vehicle views, most viewed vehicles, WhatsApp clicks, new leads, and conversion percentage.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A scripted public journey covering all six interactions produces exactly one stored event of each type for the resolved tenant.
- **SC-002**: In cross-tenant isolation checks, Tenant B observes 0 of Tenant A's analytics events and a restricted cross-tenant insert is rejected.
- **SC-003**: With a forced analytics write failure, 100% of public page renders, contact-form successes, and WhatsApp redirects still complete.
- **SC-004**: The admin dashboard displays all five required metrics for a tenant with seeded events, and 0/`0.0%`/empty-state values for a tenant with no events.
- **SC-005**: Conversion percentage equals `round(new_leads / vehicle_views * 100, 1)` for every tested fixture, including the zero-view case.
- **SC-006**: Desktop and mobile captures show the analytics dashboard section and the working share control with no layout regression to the incumbent neutral/amber admin and showroom design.

## Assumptions

- No external analytics vendor is configured or required; this phase uses first-party events stored in the application's PostgreSQL database.
- Metrics are all-time totals. This phase does not add a date-range selector, realtime updates, cohort analysis, or export.
- A "view" is one event per detail-page mount initiated by the visitor. Bot filtering and unique-visitor de-duplication are out of scope.
- `inventory_search` means the inventory page was loaded with at least one query parameter; `filter_use` means at least one recognized filter parameter was present. A filtered search legitimately produces both events because they describe different facts.
- `whatsapp_click` is emitted only by the existing `/api/public/whatsapp` route after the lead insert succeeds. No separate client-side WhatsApp beacon is added.
- Conversion percentage uses new leads divided by vehicle views because vehicle views are the top of the tracked funnel. This definition is displayed alongside the metric so the operator can interpret it.
- The analytics beacon is sent by the browser after the public page renders. Server-side events (`whatsapp_click`, `contact_submit`) are written after the corresponding lead insert.
- Analytics retention and cleanup jobs are out of scope for this phase.
- The existing admin authentication, tenant context, RLS helpers, and neutral/amber incumbent visual system are the integration surface and are not redesigned.

## Out of Scope

- Third-party analytics vendors, pixels, cookies, or cross-site tracking.
- Unique-visitor identification, sessions, funnels, attribution, or campaign tracking.
- Date-range filters, comparisons, realtime dashboards, exports, or scheduled reports.
- Analytics for platform administration beyond the showroom dashboard.
- Historical backfill of pre-existing page views.
- Alerting, anomaly detection, or revenue analytics.
