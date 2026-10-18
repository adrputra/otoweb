# Contract: Public Analytics Beacon and Server Events

## `POST /api/public/analytics`

Public, same-origin, unauthenticated beacon endpoint.

### Request

```http
POST /api/public/analytics
Content-Type: application/json

{
  "event": "vehicle_view",
  "vehicleSlug": "toyota-fortuner-2021-1",
  "path": "/cars/toyota-fortuner-2021-1",
  "filters": { "brand": "Toyota", "sort": "terbaru" },
  "method": "native"
}
```

| Field | Required | Rules |
|---|---|---|
| `event` | yes | One of `vehicle_view`, `inventory_search`, `filter_use`, `vehicle_share` |
| `vehicleSlug` | no | Trimmed, <= 200 characters; resolved only inside the request tenant |
| `path` | no | Starts with `/`, <= 512 characters; query string removed before storage |
| `filters` | no | Object; only recognized keys are kept (brand, model, transmission, fuel, year, minPrice, maxPrice, maxMileage, sort); <= 10 entries, key <= 32 chars, value <= 64 chars |
| `method` | no | `native` or `clipboard`; used only by `vehicle_share` |

The request body is capped at 4 KB. Unknown fields are ignored. `whatsapp_click`
and `contact_submit` are rejected by this endpoint because they are emitted
server-side.

### Responses

| Situation | Status | Body |
|---|---|---|
| Valid event stored | `204` | empty |
| Valid event, analytics write failed | `204` | empty |
| Unknown tenant | `204` | empty |
| Invalid JSON, invalid event, oversized payload | `204` | empty |
| Wrong method | `405` | empty |

The endpoint never returns an error body to the visitor and never redirects.

### Client behavior

`lib/analytics/client.ts` sends one beacon per tracked interaction:

1. Prefer `navigator.sendBeacon('/api/public/analytics', blob)`.
2. Fall back to `fetch(..., { method: 'POST', keepalive: true })`.
3. Swallow every exception.

## Server event: `whatsapp_click`

Emitted by `GET /api/public/whatsapp` after `createWhatsappLead` returns
`ok: true`. The existing route and redirect are unchanged otherwise.

- Tenant: the resolved public tenant.
- Vehicle: the lead's `vehicleId` when the slug belonged to the tenant.
- Metadata: `{ "vehicleSlug": "<slug>" }` when a slug was supplied.
- Failure: swallowed; the redirect still happens.

## Server event: `contact_submit`

Emitted by `submitContactLeadAction` after `createContactLead` returns
`ok: true`.

- Tenant: the resolved public tenant.
- Vehicle: none.
- Metadata: `{}`.
- Failure: swallowed; the success response is unchanged.

## Admin metric contract

`getAdminAnalyticsSummary(db, tenantId)` returns:

```ts
interface AdminAnalyticsSummary {
  vehicleViews: number
  whatsappClicks: number
  newLeads: number
  conversionPercent: number // one decimal, e.g. 12.5
  mostViewedVehicles: Array<{
    vehicleId: string
    slug: string
    label: string
    views: number
  }>
}
```

All fields are computed from rows where `tenant_id` equals the authenticated
tenant. The function is called only from the admin dashboard after
`requireAdminTenantContext('view')`.
