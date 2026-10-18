# Contract: Public SEO Output

This contract describes the observable server output for the public showroom
routes. All assertions are made against raw HTTP response bodies, not the
hydrated DOM.

## Request context

- Tenant is resolved from the verified `Host` header through the existing
  `tenant_domains` lookup.
- `x-forwarded-proto` (first value) or the environment default determines the
  origin protocol.
- `x-forwarded-host` (first value) takes precedence over `Host`.
- Unknown or unusable tenant: public pages render not-found; crawl surfaces
  disclose no tenant URLs.

## `GET /` (home)

| Output | Required |
|---|---|
| `<title>` | Tenant `seo_title` or `display_name` |
| `<meta name="description">` | Tenant `seo_description`, else description/tagline |
| `<link rel="canonical">` | `<origin>/` |
| `<meta property="og:title">` | Same as title |
| `<meta property="og:description">` | Same as description |
| `<meta property="og:url">` | `<origin>/` |
| `<meta property="og:site_name">` | Showroom display name |
| `<meta property="og:image">` | Absolute logo or hero image |
| `<script type="application/ld+json">` | `AutoDealer`/`LocalBusiness` JSON |

## `GET /cars`

| Output | Required |
|---|---|
| `<title>` | Inventory title including the showroom name |
| `<link rel="canonical">` | `<origin>/cars` (query string omitted) |
| OpenGraph | Same pattern as home, URL `<origin>/cars` |

## `GET /cars/<slug>`

| Output | Required |
|---|---|
| `<title>` | `<Brand> <Model> <Variant> <Year> Bekas <Location> | <Showroom>` |
| `<meta name="description">` | Vehicle description summary |
| `<link rel="canonical">` | `<origin>/cars/<slug>` |
| `<meta property="og:image">` | Absolute vehicle cover image |
| JSON-LD | `Vehicle` + `Offer` with `availability` |
| Sold rows | Page remains indexable, renders “Terjual”, has `SoldOut`, and shows related non-sold vehicles |

## `GET /sitemap.xml`

- `Content-Type` is XML.
- Body is a `<urlset>` in the sitemap namespace.
- Every `<loc>` starts with the request origin.
- Home and `/cars` are always present for a resolved tenant.
- Every public vehicle is present; draft and archived vehicles are absent.
- No URL from another tenant is present.
- Unresolved tenant: zero `<url>` entries.

## `GET /robots.txt`

- `User-Agent: *`, `Allow: /`.
- Disallows `/admin/`, `/api/`, `/auth/`, `/login`, `/forgot-password`,
  `/reset-password`.
- `Sitemap:` line equals `<origin>/sitemap.xml`.
- Unresolved tenant: `Disallow: /` and no sitemap reference.

## JSON-LD safety

Serialized JSON-LD must not contain a literal `</script`, unescaped `<`, `>`,
`&`, U+2028, or U+2029 originating from stored text.

## Tenant isolation

No metadata, sitemap entry, robots reference, structured-data field, or visible
text from Tenant A may appear in a response for Tenant B, and vice versa.
