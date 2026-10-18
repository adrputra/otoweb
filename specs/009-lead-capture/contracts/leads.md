# Contract: Leads

**Feature**: `009-lead-capture`

## Public contact submission

**Trigger**: The public home contact form.

**Input**: `{ name, phone, email?, message }` from the browser.

**Server behaviour**:

1. Resolve the tenant from the verified request hostname (development fallback
   is unchanged).
2. Re-validate with the shared lead schema.
3. Insert one row with:
   - `tenant_id` = resolved tenant
   - `vehicle_id` = null
   - `source` = `contact_form`
   - `status` = `new`
4. Return `{ ok: true }` or a field-error result.

**Failure modes**:

- Unknown tenant -> generic failure, zero writes.
- Invalid input -> field errors, zero writes.
- Database failure -> generic failure, no cross-tenant fallback.

## Public WhatsApp tracking

**Endpoint**: `GET /api/public/whatsapp`

**Query**: optional `vehicle=<public vehicle slug>`.

**Server behaviour**:

1. Resolve the tenant from the verified hostname.
2. If `vehicle` is present, look it up with the tenant-scoped slug query. A
   missing or foreign slug yields no association.
3. Insert one lead with `source = whatsapp`, `status = new`, a generated
   message, and the optional vehicle id.
4. Redirect (302) to the tenant's configured `wa.me` URL.
5. If no WhatsApp number is configured, redirect to the showroom contact area
   instead of inventing a number.

**Failure modes**:

- Unknown tenant -> 404, zero writes.
- Insert failure -> no redirect to an external destination.

## Admin list

**Route**: `/admin/leads` (server component).

**Authorization**: authenticated user + tenant context + `manage_leads`.

**Output**: the active tenant's leads, newest first, with vehicle label when the
vehicle belongs to the same tenant. No other tenant's rows are present.

## Admin status update

**Action**: server action invoked from the lead table.

**Input**: `{ leadId, status }`.

**Authorization**: `requireAdminTenantContext('manage_leads')`; owner, staff, and
platform admin pass.

**Server behaviour**:

1. Validate the UUID and status enum.
2. In `withTenantSession`, update the row where
   `id = leadId AND tenant_id = actor.tenantId`, setting `updated_at`.
3. Return the updated lead or `not_found`.

**Failure modes**:

- Invalid id/status -> field error, zero writes.
- Cross-tenant id -> `not_found`, zero writes.
- Missing session or capability -> the existing redirect/denial path.

## Dashboard home

`/admin` shows the tenant's real new-lead count and the five most recent leads.
No mock lead data is imported.
