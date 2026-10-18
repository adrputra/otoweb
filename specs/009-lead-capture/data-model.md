# Data Model: Lead Capture

**Feature**: `009-lead-capture` | **Date**: 2026-10-19

## Enums

### `lead_source`

| Value | Meaning |
|---|---|
| `contact_form` | Public contact form submission |
| `whatsapp` | WhatsApp call-to-action activation |
| `phone` | Inquiry recorded from a phone call by the showroom |
| `manual` | Inquiry entered by the showroom |

### `lead_status`

| Value | Meaning |
|---|---|
| `new` | Not yet followed up |
| `contacted` | Showroom has made contact |
| `qualified` | Inquiry is a genuine buying opportunity |
| `won` | Inquiry converted |
| `lost` | Inquiry did not convert |

## Table `leads`

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | Primary key, random |
| `tenant_id` | uuid | Required, references `tenants.id`, cascade delete |
| `vehicle_id` | uuid | Optional, references `vehicles.id`, set null on delete |
| `name` | text | Optional at the database (anonymous WhatsApp lead); required by the contact form, trimmed, ≤120 |
| `phone` | text | Optional at the database (anonymous WhatsApp lead); required by the contact form, trimmed, ≤32, digits and `+ - ( )` spaces |
| `email` | text | Optional, valid email when present, ≤254 |
| `message` | text | Optional for WhatsApp-generated leads; required by the contact form, trimmed, ≤2,000 |
| `source` | `lead_source` | Required, default `contact_form` |
| `status` | `lead_status` | Required, default `new` |
| `created_at` | timestamptz | Required, database default |
| `updated_at` | timestamptz | Required, updated on status change |

Indexes: tenant id, status, and vehicle id.

### Invariants

1. Every lead belongs to exactly one tenant.
2. A lead's optional vehicle must belong to the same tenant; the service resolves
   the slug through a tenant-scoped query.
3. Public creation never accepts a tenant id from the caller.
4. Statuses are limited to the five roadmap values.
5. Deleting a vehicle clears `vehicle_id` but keeps the lead.
6. Deleting a tenant cascades its leads.
7. RLS is enabled and forced; the policy is
   `tenant_id = app.current_tenant_id() OR app.is_platform_admin()` for all
   operations.

## View model (`lib/types.ts`)

```ts
type LeadSource = 'contact_form' | 'whatsapp' | 'phone' | 'manual'
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost'

interface Lead {
  id: string
  name: string          // '' when anonymous
  phone: string         // '' when anonymous
  email: string
  vehicleId?: string
  vehicleLabel?: string // joined brand/model/variant/year, tenant-scoped
  source: LeadSource
  message: string
  status: LeadStatus
  createdAt: string     // ISO
  updatedAt: string     // ISO
}
```

## Input contracts

### Contact form (`contactLeadInputSchema`)

```ts
interface ContactLeadInput {
  name: string
  phone: string
  email: string   // '' allowed
  message: string
}
```

The source is forced to `contact_form` and the status to `new` by the service,
not by the browser.

### WhatsApp tracking

The query string carries only an optional `vehicle` slug. The tenant, phone
number, message, source, and status are derived server-side.

### Status update (`leadStatusSchema`)

```ts
type LeadStatusInput = 'new' | 'contacted' | 'qualified' | 'won' | 'lost'
```

The lead id is validated as a UUID and must belong to the actor's tenant.

## Admin summary

```ts
interface AdminLeadStats {
  total: number
  new: number
  contacted: number
  qualified: number
  won: number
  lost: number
}
```
