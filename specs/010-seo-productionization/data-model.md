# Data Model: SEO Productionization

No database migration is introduced. The feature reads existing tenant,
showroom-setting, and vehicle rows and maps them to SEO view models.

## Existing entities used

### Tenant

| Field | Use |
|---|---|
| `id` | Scope for vehicle and settings queries |
| `name` | Fallback showroom identity / structured data |
| `slug` | Development fallback resolution only |
| `status` | Usable only when `active` or `trial` |

### Tenant domain

| Field | Use |
|---|---|
| `hostname` | Request hostname lookup and canonical origin input |
| `status` | Must be `active` |
| `verified_at` | Must be non-null |

### Showroom settings

| Field | Use |
|---|---|
| `display_name` | Fallback title, OpenGraph site name, structured data |
| `tagline`, `description` | Metadata and structured-data fallbacks |
| `logo_url`, `hero_image_url` | OpenGraph/structured-data image sources |
| `phone`, `whatsapp`, `email` | `LocalBusiness` contact data |
| `address`, `city`, `province`, `postal_code` | `PostalAddress` |
| `google_maps_url` | Optional structured-data business URL context |
| `instagram_url`, `tiktok_url`, `facebook_url` | `sameAs` links |
| `seo_title`, `seo_description` | Home metadata source |

### Vehicle

| Field | Use |
|---|---|
| `tenant_id` | Mandatory scope predicate |
| `slug` | Detail URL and canonical path |
| `brand`, `model`, `variant`, `year` | Title and `Vehicle` markup |
| `location` | Title pattern |
| `description` | Metadata description and markup |
| `price` | `Offer.price` |
| `mileage` | `mileageFromOdometer` |
| `status` | Public inclusion and `Offer.availability` |
| `updated_at` | Sitemap `lastModified` |
| cover image | OpenGraph and `Vehicle.image` |
| `created_at` | Stable ordering fallback |

## SEO view models

### SeoContext

```ts
interface SeoContext {
  origin: string        // absolute request origin, no trailing slash
  showroom: Showroom    // tenant-resolved public view model
}
```

The showroom view model is the existing `Showroom` type from `lib/types.ts`, so
metadata and structured data consume the same values as the rendered page.

### PublicPageMeta

| Field | Source | Rule |
|---|---|---|
| `title` | showroom or vehicle | Never empty |
| `description` | stored SEO, showroom, vehicle | Truncated to 160 characters |
| `canonicalPath` | route | `/`, `/cars`, `/cars/<slug>` |
| `imageUrl` | logo, hero, or cover | Absolute against `origin` |
| `type` | route | `website` |

### SitemapEntry

| Field | Source | Rule |
|---|---|---|
| `url` | origin + route | Absolute, encoded slug |
| `lastModified` | vehicle `updatedAt` or request time | ISO date |
| `changeFrequency` | route | `daily` home/inventory, `weekly` vehicles |
| `priority` | route | `1.0` home, `0.8` inventory/vehicles |

### Structured data

**AutoDealer**

```ts
{
  '@context': 'https://schema.org',
  '@type': ['LocalBusiness', 'AutoDealer'],
  '@id': `${origin}/#showroom`,
  name, url, telephone?, email?, image?, logo?,
  address: { '@type': 'PostalAddress', streetAddress, addressLocality, addressRegion, postalCode },
  sameAs?: string[]
}
```

**Vehicle**

```ts
{
  '@context': 'https://schema.org',
  '@type': 'Vehicle',
  '@id': `${origin}/cars/${slug}`,
  url: `${origin}/cars/${slug}`,
  name: `${brand} ${model} ${variant}`,
  brand: { '@type': 'Brand', name },
  model, vehicleModelDate: String(year),
  mileageFromOdometer: { '@type': 'QuantitativeValue', value, unitCode: 'KMT' },
  image: [absolute cover image],
  itemCondition: 'https://schema.org/UsedCondition',
  offers: {
    '@type': 'Offer',
    price, priceCurrency: 'IDR',
    availability: status -> availability URL,
    url: canonical detail URL
  }
}
```

## Status mapping

| Stored status | Public listing | Sitemap | Offer availability |
|---|---|---|---|
| `available` | yes | yes | `https://schema.org/InStock` |
| `reserved` | yes | yes | `https://schema.org/PreOrder` |
| `sold` | yes (Terjual) | yes | `https://schema.org/SoldOut` |
| `draft` | no | no | not emitted |
| `archived` | no | no | not emitted |

## Related vehicles

Related queries remain tenant-scoped and same-body-type, but exclude `sold` so a
sold detail page always offers a non-sold next step. Up to three related units
are returned, ordered by featured, newest, slug, and id.
