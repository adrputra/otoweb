# SEO Productionization

Status: implemented in Phase 11 (F011). Source of intent:
`docs/ROADMAP.md` §29, §30, and §53 plus
`specs/010-seo-productionization/`.

The public site is tenant-aware at the request boundary. Every public response
resolves the showroom from the verified hostname, so metadata, crawl surfaces,
and structured data describe one tenant and never another.

## Request flow

```text
request Host / x-forwarded-host
  -> resolvePublicTenant()            (tenant_domains, active + verified)
  -> showroom settings + public vehicles for that tenant
  -> lib/seo/*
  -> <head> metadata, JSON-LD, sitemap.xml, robots.txt
```

No SEO value is produced client-side. The tags described here are present in the
server response before hydration.

## Modules

| Module | Responsibility |
|---|---|
| `lib/seo/origin.ts` | Canonical origin from forwarded host/protocol and absolute URL resolution |
| `lib/seo/metadata.ts` | Home, inventory, and vehicle metadata builders |
| `lib/public/metadata.ts` | Stable public facade re-exporting the builders |
| `lib/seo/structured-data.ts` | `AutoDealer`, `Vehicle`, `Offer` builders and safe JSON-LD serializer |
| `lib/seo/sitemap.ts` | Pure tenant sitemap entry builder |
| `app/sitemap.ts` | Request-time tenant-specific sitemap |
| `app/robots.ts` | Request-time tenant-specific robots rules |
| `components/seo/json-ld.tsx` | Server-rendered JSON-LD block |
| `app/page.tsx`, `app/cars/page.tsx`, `app/cars/[slug]/page.tsx` | Metadata and structured-data wiring |

## Metadata

| Route | Title | Canonical |
|---|---|---|
| `/` | Stored showroom `seo_title`, else display name | `<origin>/` |
| `/cars` | `Koleksi mobil — <showroom>` | `<origin>/cars` (query dropped) |
| `/cars/<slug>` | `<Brand> <Model> <Variant> <Year> Bekas <Location> \| <Showroom>` | `<origin>/cars/<slug>` |

Descriptions come from the showroom SEO description, showroom description or
tagline, or the vehicle description. They are collapsed and truncated to 160
characters. OpenGraph tags (`og:title`, `og:description`, `og:url`,
`og:site_name`, `og:type`, `og:image`) are emitted on every public page with an
absolute image URL. Home and inventory use the logo when set, otherwise the hero
image; vehicle detail uses the cover image.

The canonical origin is the request origin. In production that is the tenant's
custom domain or platform subdomain; in development it preserves the port. The
current schema has no primary-domain flag, so no cross-domain canonical is
invented.

## Crawl surfaces

`app/sitemap.ts` and `app/robots.ts` call `headers()` and declare
`dynamic = 'force-dynamic'`, so the response is generated per request instead of
being cached across tenants.

- `sitemap.xml` contains the tenant home, inventory, and every public vehicle
  (`available`, `reserved`, `sold`). Draft and archived vehicles are excluded.
  An unresolved tenant receives an empty sitemap.
- `robots.txt` allows `/`, disallows `/admin/`, `/api/`, `/auth/`, `/login`,
  `/forgot-password`, and `/reset-password`, and advertises the request host's
  sitemap. An unresolved tenant is denied entirely and receives no sitemap
  reference.

## Structured data

- Home: `AutoDealer` typed as `["LocalBusiness", "AutoDealer"]` with the showroom
  name, URL, telephone/email, `PostalAddress`, logo/image, and social `sameAs`
  links.
- Vehicle detail: `Vehicle` with brand, model, configuration, model year, body
  type, transmission, fuel, colour, mileage, image, canonical URL,
  `UsedCondition`, and an `Offer` in IDR.

Offer availability maps from the stored status:

| Stored status | Availability |
|---|---|
| `available` | `https://schema.org/InStock` |
| `reserved` | `https://schema.org/PreOrder` |
| `sold` | `https://schema.org/SoldOut` |

JSON-LD is serialized then escaped (`<`, `>`, `&`, U+2028, U+2029) before it is
placed in the script element, so stored descriptions cannot inject markup.

## Sold listing policy

Roadmap §30 says sold pages must not be deleted because the acquired URL and
search value should be preserved. The implementation therefore:

- keeps the sold detail page reachable (no redirect, no delete);
- renders “Terjual” and the sold badge;
- keeps the detail URL self-canonical and indexable;
- includes the sold URL in the tenant sitemap;
- emits `SoldOut` in the `Offer`;
- shows related units only in `available` or `reserved` status, so the visitor
  has a next step.

Old sold listings can be archived later through the normal vehicle lifecycle
(`archived` is excluded from public queries and the sitemap).

## Verification

The acceptance criterion requires generated HTML, not browser-rendered
metadata. `tests/e2e/seo-html.spec.ts` issues raw Node HTTP requests with an
explicit `Host` header and asserts `<title>`, `<meta>`, `<link rel="canonical">`,
JSON-LD, sitemap XML, and robots text in the response body. It never runs client
JavaScript.

```bash
npx tsc --noEmit
npm test
npx playwright test tests/e2e/seo-html.spec.ts
pnpm visual:qa   # only when a visible presentation file changed
```

Manual spot checks:

```bash
curl -s -H 'Host: prima.otoweb.id:3000' http://127.0.0.1:3000/ | grep -E '<title>|canonical|og:'
curl -s -H 'Host: tenant-b.otoweb.id:3000' http://127.0.0.1:3000/sitemap.xml
curl -s -H 'Host: prima.otoweb.id:3000' http://127.0.0.1:3000/robots.txt
```

The development server uses the seeded in-memory PGlite database, so these
checks run without a production database. Production always uses
`DATABASE_URL`; the development fallback is never active there.

## Boundaries

- No client-side metadata mutation.
- No cross-tenant sitemap, canonical, or structured data.
- No automatic deletion or redirection of sold pages.
- No visible public design change.
