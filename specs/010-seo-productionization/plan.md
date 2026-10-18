# Implementation Plan: SEO Productionization

**Branch**: `010-seo-productionization` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-seo-productionization/spec.md`

## Summary

Move the public site from a single hard-coded root metadata object to
request-scoped, tenant-aware SEO. A small `lib/seo/` layer derives the canonical
origin from the request, builds metadata, sitemap entries, robots rules, and
JSON-LD from the hostname-resolved tenant and its vehicles. The App Router
`generateMetadata` functions on the three public routes consume that layer.
`sitemap.xml` and `robots.txt` are dynamic metadata routes that resolve the
tenant per request, so each showroom hostname receives only its own URLs.
Structured data is rendered server-side with escaped JSON. Sold listings stay
accessible, self-canonical, indexable, and in the sitemap, with `SoldOut`
structured data and related non-sold vehicles. Verification reads raw HTTP
responses (HTML/XML) without executing client JavaScript.

## Technical Context

**Language/Version**: TypeScript 5.7, React 19, Next.js 16.4 App Router

**Primary Dependencies**: Next.js metadata APIs, Drizzle ORM 0.45, zod 4

**Storage**: Existing PostgreSQL/Supabase schema. No migration required; SEO is
derived from `showroom_settings` and `vehicles`.

**Testing**: Vitest 5 for pure builders/unit coverage; Playwright 1.64 for real
HTTP HTML/XML assertions against the seeded Next.js server.

**Target Platform**: Server-rendered Next.js deployment with per-tenant
hostnames (platform subdomains and custom domains).

**Project Type**: Web application (single Next.js project)

**Performance Goals**: Metadata, sitemap, and robots generation add no
additional database round trips beyond one tenant resolution and one vehicle
list per request. Sitemap requests are dynamic and not cached across tenants.

**Constraints**: Never leak another tenant's identity or URLs. Never rely on
client-side execution for SEO output. No visible design change. No new runtime
dependency.

**Scale/Scope**: Three public routes, two crawl routes, two structured-data
entities, and the existing seeded vehicles per tenant.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is an unfilled template (placeholder
principles, sections, and governance), so there are no project-specific MUST
principles to evaluate. Per the converge/template guidance, the check is skipped
gracefully rather than treated as a failure. The feature still honors the
repository's documented invariants: tenant isolation, server-only data access,
and no weakened validation.

## Project Structure

### Documentation (this feature)

```text
specs/010-seo-productionization/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── seo-output.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
app/
├── layout.tsx                  # generic root fallback metadata (no tenant)
├── page.tsx                    # tenant metadata + LocalBusiness JSON-LD
├── cars/
│   ├── page.tsx                # inventory metadata
│   └── [slug]/
│       └── page.tsx            # vehicle metadata + Vehicle/Offer JSON-LD
├── robots.ts                   # dynamic per-tenant robots.txt
└── sitemap.ts                  # dynamic per-tenant sitemap.xml

lib/
├── public/
│   ├── metadata.ts             # backwards-compatible metadata facade
│   ├── queries.ts              # related vehicles exclude sold
│   └── tenant.ts               # existing hostname resolution (unchanged)
└── seo/
    ├── origin.ts               # request origin + absolute URL helpers
    ├── metadata.ts             # metadata builders for home/inventory/detail
    ├── sitemap.ts              # pure sitemap entry builder
    └── structured-data.ts      # JSON-LD builders + safe serializer

components/
└── seo/
    └── json-ld.tsx             # server component rendering escaped JSON-LD

tests/
├── unit/seo/
│   ├── metadata.test.ts
│   ├── origin.test.ts
│   ├── sitemap.test.ts
│   └── structured-data.test.ts
└── e2e/
    └── seo-html.spec.ts        # raw HTTP HTML/XML verification

docs/
└── SEO.md                      # policy and verification guide
```

**Structure Decision**: Keep the existing single-project layout. SEO logic lives
in a dedicated `lib/seo/` module with pure builders that are unit-testable, and
thin route wiring in the App Router. This mirrors the target architecture's
`lib/seo/` boundary while preserving the current `lib/public/` facade.

## Design Decisions

1. **Origin**: `lib/seo/origin.ts` reads `x-forwarded-host`/`host` and
   `x-forwarded-proto`, validates the host, and returns an absolute origin.
   `NEXT_PUBLIC_SITE_URL` is only a fallback when no host header exists.
2. **Metadata**: `lib/seo/metadata.ts` returns a complete `Metadata` object
   (`metadataBase`, `title`, `description`, `alternates.canonical`, `openGraph`,
   `robots`) for each public route. The existing `showroomMetadata()` becomes a
   facade used by the pages so callers keep a single entry point.
3. **Canonicalization**: home `/`, inventory `/cars` (query strings dropped),
   vehicle `/cars/<slug>`. Sold detail URLs are self-canonical.
4. **Sitemap**: `app/sitemap.ts` uses `headers()` so it is request-time dynamic.
   It resolves the tenant, returns `[]` when unresolved, and otherwise emits the
   tenant origin's home, inventory, and every public vehicle
   (`available`, `reserved`, `sold`). Draft/archived rows are excluded by the
   existing public query.
5. **Robots**: `app/robots.ts` is request-time dynamic and emits allow `/` plus
   disallow rules for `/admin/`, `/api/`, `/auth/`, `/login`,
   `/forgot-password`, and `/reset-password`, with the tenant's sitemap URL. An
   unresolved tenant receives `Disallow: /` and no sitemap reference.
6. **JSON-LD**: Home emits `AutoDealer` typed as `["LocalBusiness","AutoDealer"]`
   with name, URL, telephone, email, address, logo/image, and sameAs social
   links. Detail emits `Vehicle` with brand, model, vehicleModelDate, mileage,
   image, canonical URL, `itemCondition: UsedCondition`, and an `Offer`
   (`price`, `priceCurrency: IDR`, `availability`).
7. **Sold policy**: Sold rows remain in the public query, render “Terjual”,
   remain indexable and in the sitemap, and use `SoldOut`. Related vehicles are
   restricted to `available`/`reserved` so a sold page offers a next step.
8. **Safe serialization**: JSON-LD is passed through a serializer that escapes
   `<`, `>`, `&`, U+2028, and U+2029 before being placed in a `<script>` element.
9. **Verification**: `tests/e2e/seo-html.spec.ts` performs raw Node HTTP requests
   with an explicit `Host` header against the running Next.js server and asserts
   tags in the response body, never the hydrated DOM. Unit tests cover the pure
   builders without a browser.

## Complexity Tracking

No constitution violations to justify.
