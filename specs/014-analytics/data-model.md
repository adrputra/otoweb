# Data Model: Analytics

## Enum: `analytics_event_type`

| Value | Origin | Meaning |
|---|---|---|
| `vehicle_view` | Public detail page mount | A visitor opened a vehicle detail page |
| `inventory_search` | Public inventory page mount | The visitor loaded inventory with recognized search params |
| `filter_use` | Public inventory page mount | The visitor loaded inventory with recognized filter params |
| `whatsapp_click` | WhatsApp route after lead insert | A visitor followed the WhatsApp call to action |
| `contact_submit` | Contact server action after lead insert | A visitor submitted the contact form successfully |
| `vehicle_share` | Share control success | A visitor shared a vehicle detail page |

## Table: `analytics_events`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | uuid | primary key, `defaultRandom()` | Event id |
| `tenant_id` | uuid | not null, FK `tenants.id` on delete cascade | Resolved from the request hostname, never from the browser |
| `event_type` | `analytics_event_type` | not null | One of the six values above |
| `vehicle_id` | uuid | nullable, FK `vehicles.id` on delete set null | Only set when the referenced vehicle belongs to the same tenant |
| `metadata` | jsonb | not null, default `'{}'::jsonb` | Bounded, non-personal interaction facts |
| `path` | text | nullable | Same-origin public path, max 512 characters |
| `created_at` | timestamptz | not null, default now | Event time |

Indexes:

- `analytics_events_tenant_type_created_idx` on
  (`tenant_id`, `event_type`, `created_at`)
- `analytics_events_tenant_vehicle_idx` on (`tenant_id`, `vehicle_id`)
- `analytics_events_tenant_created_idx` on (`tenant_id`, `created_at`)

RLS (appended to the generated migration, following `0001` and `0002`):

```sql
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events FORCE ROW LEVEL SECURITY;

CREATE POLICY analytics_events_tenant_isolation ON public.analytics_events
  FOR ALL
  USING (tenant_id = app.current_tenant_id() OR app.is_platform_admin())
  WITH CHECK (tenant_id = app.current_tenant_id() OR app.is_platform_admin());
```

## Metadata contract

`metadata` is a flat object. Only these keys are accepted:

| Event | Keys |
|---|---|
| `vehicle_view` | none (vehicle is the `vehicle_id` column) |
| `inventory_search` | `filters` (object of recognized key/value strings) |
| `filter_use` | `filters` (object of recognized key/value strings) |
| `vehicle_share` | `method` (`native` or `clipboard`) |
| `whatsapp_click` | `vehicleSlug` when known |
| `contact_submit` | none |

Limits: at most 10 keys per nested filter object, key length <= 32, value
length <= 64. No email, phone, message, IP, user agent, or referrer is accepted.

## Derived views

### Vehicle view count

`count(*)` of `analytics_events` where `tenant_id = :tenant`,
`event_type = 'vehicle_view'`.

### Most viewed vehicles

```sql
select v.id, v.slug, v.brand, v.model, v.variant, v.year,
       count(e.id)::int as views
from analytics_events e
join vehicles v
  on v.id = e.vehicle_id and v.tenant_id = e.tenant_id
where e.tenant_id = :tenant
  and e.event_type = 'vehicle_view'
group by v.id, v.slug, v.brand, v.model, v.variant, v.year
order by views desc, v.brand asc, v.model asc, v.id asc
limit 5;
```

### WhatsApp clicks

`count(*)` where `event_type = 'whatsapp_click'`.

### New leads

The existing `getAdminLeadStats` `new` value (`leads.status = 'new'`), so the
dashboard has one source of truth for leads.

### Conversion percentage

```
views = vehicle_view count
leads = new lead count
conversion = views === 0 ? 0 : round((leads / views) * 1000) / 10
```

Displayed with one decimal place and the label "Lead baru / kunjungan unit".

## State and lifecycle

Events are append-only. There is no update path and no deletion path in this
phase. Deleting a tenant cascades its events; deleting a vehicle sets
`vehicle_id` to null but preserves the historical event. No retention job is
introduced.
