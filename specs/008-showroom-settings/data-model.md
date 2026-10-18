# Data Model: Showroom Settings

**Feature**: `008-showroom-settings` | **Date**: 2026-10-19

No migration. The F003 `showroom_settings` table is the storage contract; this
feature adds validation, mapping, and UI behaviour around it.

## ShowroomSettings (`showroom_settings`)

| Column | Type | Editable in F009 | Rule |
|---|---|---|---|
| `id` | uuid | no | Primary key |
| `tenant_id` | uuid | no | Unique; from the authorized actor only |
| `display_name` | text | yes | Required, trimmed, 1–120; public showroom name |
| `tagline` | text | yes | Optional, ≤160 |
| `description` | text | yes | Optional, ≤2,000 |
| `logo_url` | text | yes | Optional; HTTP(S) or root-relative upload URL |
| `favicon_url` | text | no | Deferred (not in the roadmap list) |
| `hero_image_url` | text | yes | Optional; HTTP(S) or root-relative upload URL |
| `primary_color` | text | yes | `#RRGGBB`; default `#b88a44` |
| `secondary_color` | text | yes | `#RRGGBB`; default `#171717` |
| `phone` | text | yes | Optional; digits and `+ - ( )` spaces, ≤32 |
| `whatsapp` | text | yes | Optional; same rule; public uses digits for `wa.me` |
| `email` | text | yes | Optional; valid email |
| `address` | text | yes | Optional street, ≤200 |
| `city` | text | yes | Optional, ≤80 |
| `province` | text | yes | Optional, ≤80 |
| `postal_code` | text | yes | Optional, ≤16 |
| `google_maps_url` | text | yes | Optional; HTTP(S) |
| `instagram_url` | text | yes | Optional; URL or handle, normalized |
| `tiktok_url` | text | yes | Optional; URL or handle, normalized |
| `facebook_url` | text | yes | Optional; URL or handle, normalized |
| `opening_hours` | text | yes | Optional, ≤200 |
| `seo_title` | text | yes | Optional, ≤120; falls back to display name |
| `seo_description` | text | yes | Optional, ≤200; falls back to description |
| `created_at` | timestamptz | no | Database default |
| `updated_at` | timestamptz | no | Set on every successful update |

### Invariants

1. Exactly one row per tenant (`tenant_id` unique).
2. Every query filters by the actor's tenant id; the service never accepts a
   tenant or settings id from the browser.
3. Empty optional form values persist as `NULL`, never `''`, and read back as
   `''` for the form.
4. A missing row is created for the actor's tenant on first save.
5. `updated_at` changes on every successful save.

## Input contract (`showroomSettingsInputSchema`)

```ts
interface ShowroomSettingsInput {
  displayName: string
  tagline: string
  description: string
  logoUrl: string
  heroImageUrl: string
  primaryColor: string
  secondaryColor: string
  phone: string
  whatsapp: string
  email: string
  address: string
  city: string
  province: string
  postalCode: string
  googleMapsUrl: string
  instagramUrl: string
  tiktokUrl: string
  facebookUrl: string
  openingHours: string
  seoTitle: string
  seoDescription: string
}
```

All fields are strings so the form and server share one shape. Optional fields
accept `''`; the service converts `''` to `NULL`. Social handle normalization is
a pure helper exported from `lib/validation/showroom-settings.ts` and applied by
the service after parsing.

## Public view model (`Showroom`)

`lib/types.ts` gains two address fields; everything else already exists:

```ts
interface Showroom {
  // ...
  address: {
    street: string
    city: string
    province: string      // new
    postalCode: string    // new
    mapUrl: string
    openingHours: string
  }
  // ...
}
```

Mapping rules in `lib/public/queries.ts`:

| View field | Source | Fallback |
|---|---|---|
| `name` | `display_name` | tenant name / `Showroom Settings` |
| `tagline`, `description` | same columns | `''` |
| `logoUrl` | `logo_url` | `''` (name-only header) |
| `heroImageUrl` | `hero_image_url`, optimized 2200px | `/placeholder.jpg` |
| `colors` | `primary_color`, `secondary_color` | `#b88a44`, `#171717` |
| `contact` | phone / whatsapp / email | `''` |
| `address` | address / city / province / postal_code / google_maps_url | `''` |
| `social` | instagram / tiktok / facebook URLs | `undefined` |
| `seo` | `seo_title`, `seo_description` | display name, description |
| `hero.headline` | `display_name` | tenant name |
| `hero.subheadline` | description, then tagline | `''` |

## Theme variables (`lib/theme.ts`)

```ts
interface ShowroomTheme {
  primary: string          // --showroom-primary
  accent: string           // --showroom-accent, accessible on white
  primarySoft: string      // --showroom-primary-soft, for dark surfaces
  secondary: string        // --showroom-secondary
  onPrimary: string        // --showroom-on-primary
  onSecondary: string      // --showroom-on-secondary
}
```

Invalid or missing hex values fall back to the default palette. The helper also
exposes `contrastForeground(hex): '#ffffff' | '#111111'` and
`readableAccent(hex): string`.

## Settings media upload

| Input | Rule |
|---|---|
| `kind` | `logo` or `hero` |
| File | JPEG/PNG/WebP, ≤10 MB, ≥640×480, inspected from bytes |
| Public id | `otoweb/showrooms/{tenantId}/settings/{kind}/{sha256(bytes)}` |
| Auth | Verified admin context + `manage_settings`; no session → 401, staff → 403 |
| Success | `201 { ok: true, data: { url, provider, assetId, width, height } }` |
| Failure | `400` invalid file/kind, `502` provider unavailable |

The upload does not write the settings row. The form saves the returned URL with
the rest of the configuration, so a cancelled edit never persists a partial
configuration.
