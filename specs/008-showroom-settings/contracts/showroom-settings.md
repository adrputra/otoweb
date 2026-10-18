# Contract: Showroom Settings

**Feature**: `008-showroom-settings` | **Date**: 2026-10-19

## Authorization

Every surface below requires a server-verified admin session, a resolved tenant
context, and the `manage_settings` capability. `owner`, `platform_admin`, and
cross-tenant `platform_admin` access follow the F005 matrix; `staff` receives
`403`/redirect. The browser never supplies a tenant id or settings id.

## Server action — `updateShowroomSettingsAction(input: unknown)`

`'use server'` wrapper around the tenant-scoped service.

```ts
type SettingsResult =
  | { ok: true; data: ShowroomSettingsSnapshot }
  | {
      ok: false
      error: 'invalid' | 'forbidden' | 'not_found'
      fieldErrors?: Record<string, string[]>
      message?: string
    }
```

Behaviour:

1. Resolve `requireAdminTenantContext('manage_settings')`.
2. Parse `input` with `showroomSettingsInputSchema`.
3. Open `withTenantSession` for `context.tenant.id`, `context.userId`,
   `context.isPlatformAdmin`.
4. Update the tenant row or insert it when absent, setting `updated_at`.
5. On success, revalidate `/`, `/cars`, `/cars/[slug]`, and
   `/admin/settings/showroom`.
6. Return the stored snapshot (form-shaped values and `updatedAt`).

Errors use `{ ok: false, error, fieldErrors, message }` and never write partial
data.

## Upload endpoint — `POST /api/admin/settings/media`

`multipart/form-data` fields:

| Field | Value |
|---|---|
| `file` | The image file |
| `kind` | `logo` or `hero` |

Success:

```json
{
  "ok": true,
  "data": {
    "url": "https://res.cloudinary.com/.../image/upload/...",
    "provider": "cloudinary",
    "assetId": "otoweb/showrooms/{tenantId}/settings/logo/{sha256}",
    "width": 1200,
    "height": 630
  }
}
```

Failures:

| Status | Code | Cause |
|---|---|---|
| 400 | `invalid` | Missing/invalid `kind`, missing file, unsupported/corrupt/oversized/undersized image |
| 401 | `unauthorized` | No verified session |
| 403 | `forbidden` | Denied tenant context or missing `manage_settings` |
| 502 | `provider` | Media provider not configured or upload failed |

The endpoint sets `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`.

## Public data contract

- `getShowroom()` (existing facade) returns the mapped Showroom for the request
  tenant or `null` when no tenant resolves.
- Changes are read from the database on the next public request; routes remain
  `force-dynamic`.
- `showroomMetadata(showroom)` returns `title`, `description`, and an `icon`
  derived from the logo when present. Empty SEO fields fall back to the display
  name and description so metadata is never blank.

## Isolation contract

- Reads use `getShowroomSettings(db, tenantId)` from
  `lib/tenant/scoped-queries.ts`.
- Writes use `withTenantSession` and a `tenant_id` predicate.
- A cross-tenant user cannot specify Prima's row because no id is accepted; the
  actor's context tenant is the only write target.
- No service-role key, provider secret, or database URL reaches browser code.
