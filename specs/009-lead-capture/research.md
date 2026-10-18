# Research: Lead Capture

**Feature**: `009-lead-capture` | **Date**: 2026-10-19

## Decision: Reuse the existing tenant resolution and RLS boundary

**Rationale**: F005 already resolves public requests from the verified hostname
and guards tenant writes with RLS helper functions. A new resolver would create a
second source of truth and a bypass risk. Public creation will pass only the
resolved tenant id into the insert; admin status changes will run inside
`withTenantSession`.

**Alternatives considered**: A tenant id hidden in the form (rejected: browser
control of tenancy); a service-role client (rejected: credential exposure and
policy bypass).

## Decision: One `leads` table, nullable contact identity

**Rationale**: Roadmap §28 defines one lead model with `source = whatsapp`.
WhatsApp click-throughs do not provide a name or phone, so those columns must be
nullable. The contact form still requires them through validation. This keeps a
single dashboard and avoids a second event table.

**Alternatives considered**: A separate `lead_events` table (more schema and more
dashboard logic for no roadmap benefit); refusing to track WhatsApp without a
form (breaks the roadmap source).

## Decision: Track WhatsApp via a server redirect

**Rationale**: Navigation to a server route guarantees the insert happens before
the browser leaves the site and needs no client JavaScript or beacon support.
The redirect target is built server-side from the tenant's stored WhatsApp
number, which also prevents an open redirect.

**Alternatives considered**: `navigator.sendBeacon` with a direct `wa.me` link
(rejected: fire-and-forget can be dropped, and the link target would be built in
the browser); WhatsApp Business API (explicitly out of scope).

## Decision: Five roadmap statuses, no transition matrix

**Rationale**: The roadmap lists `new`, `contacted`, `qualified`, `won`, `lost`
without ordering rules. The dashboard lets a member choose any status; a
transition matrix would be CRM behaviour and is not required.

**Alternatives considered**: Enforced funnel transitions (rejected: extra policy
the roadmap does not state); legacy `closed` status (rejected: not a roadmap
status).

## Decision: Dashboard is a scoped list plus summary counts

**Rationale**: The acceptance loop is inquiry -> tenant lead -> admin dashboard.
A list with search/filter and counts satisfies it. No analytics, assignment, or
pipeline views are added.

**Alternatives considered**: Detail pages and notes (out of scope); kanban board
(CRM surface, out of scope).

## Decision: Shared Zod schema and the existing form styles

**Rationale**: F007–F009 use a client-safe Zod schema for the form resolver and
server re-validation. Reusing that pattern keeps error shapes consistent and
ensures the browser cannot bypass validation.

**Alternatives considered**: Server-only validation (worse feedback); HTML-only
validation (not authoritative).

## Decision: Preserve the incumbent design

**Rationale**: There is no design brief in the repository. The existing public
site and admin shell are the contract: neutral/amber palette, square borders,
compact labels, and the established mobile breakpoints. The form and table use
those tokens; no new visual language is introduced.

**Alternatives considered**: A new marketing-style contact panel (would break the
white-label showroom design).
