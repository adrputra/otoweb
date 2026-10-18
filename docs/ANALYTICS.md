# Analytics

Status: implemented in Phase 15 (F015). Source of intent:
`docs/ROADMAP.md` §57 and `specs/014-analytics/`.

The platform records first-party, tenant-scoped interaction events in its own
PostgreSQL database. There is no analytics vendor, third-party script, pixel,
or cookie. Recording is best-effort: an analytics failure never blocks public
rendering, contact capture, or the WhatsApp redirect.

## Tracked events

| Event | Emitted by | Vehicle link | Metadata |
|---|---|---|---|
| `vehicle_view` | Public vehicle detail page mount | Same-tenant lookup by slug | none |
| `inventory_search` | Public inventory page with a recognized query parameter | none | `filters` |
| `filter_use` | Public inventory page with a recognized filter parameter | none | `filters` |
| `whatsapp_click` | `/api/public/whatsapp` after a successful WhatsApp lead | Lead's vehicle id | `vehicleSlug` when supplied |
| `contact_submit` | Contact server action after a successful lead | none | none |
| `vehicle_share` | Share control after a native share or clipboard copy | Same-tenant lookup by slug | `method` (`native`/`clipboard`) |

Recognized inventory keys are `brand`, `model`, `transmission`, `fuel`, `year`,
`minPrice`, `maxPrice`, `maxMileage`, and `sort`. A sort-only change counts as an
inventory search but not as filter use. Values are trimmed, length-bounded, and
limited to ten entries; unknown keys are dropped.

## Write paths

### Browser beacon

`lib/analytics/client.ts` sends JSON to
`POST /api/public/analytics` with `navigator.sendBeacon`, falling back to
`fetch(..., { keepalive: true })`. The route resolves the tenant from the
verified request hostname, accepts only the four public event types, enforces a
4 KB body cap, and always answers `204`. Invalid payloads, unknown tenants, and
database errors are dropped quietly.

The client trackers live in `components/analytics/page-trackers.tsx` and
`components/analytics/vehicle-share-button.tsx`. They send once per distinct
page state and swallow every exception.

### Server events

The WhatsApp route and the contact server action record their events only after
the existing lead write succeeds. Analytics is awaited but wrapped so a rejection
cannot alter the response. This reuses the lead as the conversion signal and
avoids a second client beacon that would double-count WhatsApp clicks.

### Recorder

`lib/analytics/record.ts` validates the tenant, resolves an optional same-tenant
vehicle, sanitizes metadata, inserts the row, and returns `false` on every
failure. It never rejects.

## Data model

`analytics_events` has `id`, `tenant_id`, `event_type`, optional `vehicle_id`,
`metadata`, optional `path`, and `created_at`. It is append-only. Deleting a
tenant cascades its events; deleting a vehicle sets `vehicle_id` null while
keeping the historical event. RLS is enabled and forced with the standard tenant
policy. See `docs/DATABASE.md` and `specs/014-analytics/data-model.md`.

## Dashboard metrics

The admin dashboard (`app/admin/page.tsx`) shows, for the authenticated tenant
only:

- **Kunjungan unit**: count of `vehicle_view`.
- **Paling banyak dilihat**: top five vehicles by linked view count, with
  deterministic tie-breakers.
- **Klik WhatsApp**: count of `whatsapp_click`.
- **Lead baru**: existing `leads.status = 'new'` count.
- **Konversi**: `new leads / vehicle views` as a percentage with one decimal,
  or `0.0%` when there are no views.

Metrics are all-time totals. This phase intentionally has no date-range
selector, realtime updates, unique-visitor identification, or export.

## Privacy and limits

- No IP address, user agent, referrer, email, phone, or free-text inquiry is
  stored in analytics metadata.
- No cookies or cross-site identifiers are introduced.
- Views are page views, not unique visitors. Duplicate server events are not
  de-duplicated in this phase.
- There is no historical backfill for interactions before F015.
- Retention and cleanup jobs are out of scope.

## Non-blocking guarantee

Analytics availability is not a launch requirement. If the table, database, or
beacon route is unavailable:

1. Public pages still render.
2. The contact form still confirms a stored inquiry.
3. The WhatsApp route still redirects when lead capture succeeds.
4. The admin dashboard shows zeros or the last queryable values rather than
   failing the page. (A database-wide outage still affects the dashboard because
   the metrics are read from the same database; analytics itself never fails a
   public request.)
