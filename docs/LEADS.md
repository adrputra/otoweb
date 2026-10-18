# Lead Capture

Status: implemented in Phase 10 (F010). Source of intent:
`docs/ROADMAP.md` §27, §28, and §52; `specs/009-lead-capture/`.

The feature closes the customer inquiry loop:

```text
public contact form or WhatsApp action
  -> tenant resolved from the verified hostname
  -> tenant-owned lead row (source, status, optional vehicle)
  -> admin lead dashboard
  -> status update (new / contacted / qualified / won / lost)
```

No advanced CRM behaviour is included: there are no pipelines, assignments,
deal values, notes, tasks, tags, automation, bulk exports, or email/SMS sends,
and there is no WhatsApp Business API integration.

F015 adds non-blocking first-party analytics for `contact_submit` and
`whatsapp_click` after a lead insert succeeds. Analytics never changes lead
capture behavior; see `docs/ANALYTICS.md`.

## Lead model

`db/schema.ts` defines `leads` and two enums:

| Column | Notes |
|---|---|
| `id` | UUID primary key |
| `tenant_id` | Required; cascades with the tenant |
| `vehicle_id` | Optional; set to null when the vehicle is deleted |
| `name`, `phone`, `email`, `message` | Nullable at the database; the contact form requires name, phone, and message |
| `source` | `contact_form`, `whatsapp`, `phone`, `manual` |
| `status` | `new`, `contacted`, `qualified`, `won`, `lost` |
| `created_at`, `updated_at` | `timestamptz` |

Indexes cover tenant, status, and vehicle. Migration
`db/migrations/0002_*.sql` creates the table and enables **and forces** RLS with
the same tenant policy as the other tenant-owned tables:

```sql
tenant_id = app.current_tenant_id() OR app.is_platform_admin()
```

Anonymous WhatsApp leads intentionally have empty name and phone; the dashboard
labels them "Tanpa nama" rather than inventing contact data.

## Public contact form

`components/public-contact-form.tsx` renders in the existing home contact
section (`app/page.tsx`). Name, phone, and message are required; email is
optional. The same `contactLeadInputSchema` in `lib/validation/lead.ts` powers
the form resolver and the server parse.

```text
form submit
  -> submitContactLeadAction (lib/public/lead-actions.ts)
  -> getPublicTenant()        (verified hostname; development slug fallback)
  -> createContactLead()      (lib/public/lead-service.ts)
  -> insert source=contact_form, status=new for the resolved tenant
```

The browser never sends a tenant id. An unresolved tenant or invalid input
writes nothing and returns a generic message where appropriate.

## WhatsApp tracking

Public WhatsApp CTAs point at `GET /api/public/whatsapp`. A vehicle-page action
adds `?vehicle=<slug>`; the footer action omits it.

```text
GET /api/public/whatsapp
  -> resolvePublicTenant()
  -> optional same-tenant vehicle lookup
  -> insert source=whatsapp, status=new (anonymous)
  -> 302 to the tenant's configured wa.me number
```

The destination is built server-side from `showroom_settings.whatsapp`. If the
showroom has no number, the visitor returns to the contact area; if tracking
fails, there is no external redirect. Each activation records one inquiry; there
is no deduplication.

## Admin dashboard

`/admin/leads` requires an authenticated user, a tenant context, and the
`manage_leads` capability (owner, staff, or platform admin).

`lib/admin/lead-queries.ts` reads the tenant's leads newest first and joins the
vehicle label only when the vehicle belongs to the same tenant.
`lib/admin/lead-service.ts` updates a status inside `withTenantSession` with
`WHERE id = $lead AND tenant_id = $actorTenant`, so a cross-tenant id updates
zero rows. `lib/admin/lead-actions.ts` revalidates `/admin` and `/admin/leads`.

The client table (`components/admin/lead-table.tsx`) provides:

- summary counts for total and all five statuses;
- search across name, phone, email, message, and vehicle;
- status and source filters;
- desktop table and mobile card layouts;
- an empty state and a no-results state;
- a WhatsApp reply link when a phone number exists;
- status updates for every roadmap status.

The admin home (`app/admin/page.tsx`) now reads the real new-lead count and the
five most recent leads. The legacy mock lead array and `updateLead` action were
removed.

## Files

| Artifact | Purpose |
|---|---|
| `db/schema.ts`, `db/migrations/0002_*.sql` | Lead table, enums, indexes, RLS |
| `lib/validation/lead.ts` | Shared form/status schemas and labels |
| `lib/lead-mapper.ts` | Stored row to view model |
| `lib/public/lead-service.ts` | Contact and WhatsApp tenant-scoped inserts |
| `lib/public/lead-actions.ts` | Public contact server action |
| `app/api/public/whatsapp/route.ts` | Tracking redirect |
| `lib/admin/lead-queries.ts` | Tenant-scoped list and stats |
| `lib/admin/lead-service.ts` | Tenant-scoped status update |
| `lib/admin/lead-actions.ts` | Authorized status server action |
| `components/admin/lead-table.tsx` | Admin dashboard |
| `components/public-contact-form.tsx` | Public contact form |

## Isolation and permissions

- Public inserts are pinned to the hostname-resolved tenant; there is no tenant
  id in the browser contract.
- A vehicle slug is resolved with the tenant-scoped slug query. A foreign slug
  yields a generic lead and no vehicle association.
- Admin reads and writes filter by the actor's tenant, and RLS independently
  enforces the same boundary.
- Staff may manage leads through the existing F005 capability matrix.
- Database credentials, the service-role key, and provider secrets never reach
  the browser.

## Verification

```bash
npx vitest run tests/unit/validation/lead.test.ts \
  tests/unit/public/lead-capture.test.ts \
  tests/unit/public/whatsapp-tracking.test.ts \
  tests/unit/analytics/lead-events.test.ts \
  tests/unit/admin/leads.test.ts \
  tests/unit/tenant/rls.test.ts
npx playwright test --config playwright.admin.config.ts tests/e2e/admin-leads.spec.ts
node scripts/visual-qa-leads.mjs
npx tsc --noEmit
npm test
```

Visual evidence is written to `.visual-qa/reports/f010-lead-capture-visual-qa.md`,
`.visual-qa/reports/f010-capture.json`, and the desktop/mobile screenshots under
`.visual-qa/screenshots/`.

## Boundaries

- No advanced CRM, custom-domain, or platform-admin behaviour. First-party lead
  analytics are documented in `docs/ANALYTICS.md`.
- No WhatsApp Business API integration.
- No manual database operation is required for inquiries, tracking, or status
  changes.
- Deleting a vehicle keeps its leads with the association cleared.
