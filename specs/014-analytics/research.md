# Research: Analytics

## Decision: First-party events in PostgreSQL

Store the six required events in the application's existing PostgreSQL database
rather than adding an analytics vendor. The platform already resolves every
request to a tenant, owns RLS conventions, and has a documented database
migration path. A vendor would add a new external dependency, a consent/cookie
surface, and a launch-blocking configuration value, all of which contradict the
roadmap's "do not block MVP launch on analytics" constraint.

**Alternatives considered**: Vercel Analytics (already a transitive dependency
but not configured for tenant-scoped business metrics), Plausible/GA (external
scripts and privacy surface), and log scraping (no durable tenant association).

## Decision: Client beacon for page events, server-side events for lead-backed actions

`vehicle_view`, `inventory_search`, `filter_use`, and `vehicle_share` originate
in the browser after the public page renders. A small client component sends a
same-origin beacon (`navigator.sendBeacon`, falling back to `fetch` with
`keepalive`) so the event does not delay navigation or share behavior.
`whatsapp_click` and `contact_submit` are emitted server-side after the existing
lead write succeeds, which guarantees they reflect real conversions and avoids a
second WhatsApp client beacon that would double-count clicks.

**Alternatives considered**: recording views in a server component (double
counts metadata/prefetch/revalidation and couples rendering to analytics),
client-only tracking for WhatsApp (double-counts the existing route signal), and
a queue/worker (unnecessary scale for this phase).

## Decision: Events are best-effort and never throw

The recorder validates input, resolves an optional same-tenant vehicle, inserts
the row, and catches every error. The beacon route always returns `204`; server
callers ignore the boolean result. Public rendering, contact confirmation, and
the WhatsApp redirect are therefore independent of analytics availability.

**Alternatives considered**: retries and a durable outbox (adds operational
complexity without a launch requirement), and failing the request on analytics
errors (explicitly forbidden by the roadmap).

## Decision: Tenant isolation follows existing RLS conventions

`analytics_events` is forced through RLS with the same policy shape as `leads`:
`tenant_id = app.current_tenant_id() OR app.is_platform_admin()` for reads and
writes. Public writes use the same database path as public lead writes; the
admin dashboard reads only inside the existing authenticated tenant context.

**Alternatives considered**: application-only filtering (already used together
with RLS, but not sufficient alone), and platform-admin-only access (showroom
owners need their own metrics).

## Decision: All-time metrics and a documented conversion definition

The dashboard reports all-time totals because the roadmap names metrics, not a
reporting period. Conversion percentage is `new leads / vehicle views * 100`,
rounded to one decimal, with `0.0%` when there are no views. New leads are the
existing `leads.status = 'new'` count. The definition is displayed with the
metric so it is inspectable rather than implied.

**Alternatives considered**: a date-range selector (out of scope, more UI and
query surface), WhatsApp clicks as the denominator (measures only one channel),
and unique visitors (requires identifiers the privacy constraint excludes).

## Decision: Supported query parameters are explicit

`inventory_search` and `filter_use` only consider the inventory filters the
application actually supports: brand, model, transmission, fuel, year, minPrice,
maxPrice, maxMileage, and sort. Values are trimmed, length-bounded, and stored
as metadata only. Unknown or repeated parameters are ignored.

**Alternatives considered**: storing the raw query string (unbounded and may
contain unrelated or personal data) and instrumenting each filter control with
separate events (more surface than the roadmap requires).

## Decision: One event per page mount, no de-duplication

Client trackers guard against duplicate effect runs (for example React Strict
Mode) with a ref, but server-side duplicate events are acceptable in this phase.
Vehicle views are page views, not unique visitors, and no session identifier is
introduced.

**Alternatives considered**: session storage or visitor IDs (privacy and
complexity cost that the roadmap does not require).
