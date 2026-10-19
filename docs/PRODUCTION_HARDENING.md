# Production Hardening Audit (F016)

Audit date: 2026-10-19  
Feature: `specs/015-production-hardening/`  
Baseline commit: `d035089` (`main`)  
Scope: `docs/ROADMAP.md` §58 — Phase 16, Production Hardening

This is the durable audit record for the launch-readiness phase. It lists what
was checked, how, what was found, what was fixed, and what remains explicitly
deferred. Findings are only marked **fixed** when a regression test or fresh
command proves the new behavior.

## Verdict summary

| # | Audit | Verdict | Evidence |
|---|---|---|---|
| 1 | Security | **PASS** with residuals | `lib/security/headers.mjs`, `tests/unit/security/hardening-config.test.ts`, `node scripts/hardening-audit.mjs` |
| 2 | RLS | **PASS** | `tests/unit/tenant/rls.test.ts` (36 tests), `tests/unit/analytics/rls.test.ts` |
| 3 | Authorization | **PASS** | `tests/unit/security/authorization.test.ts`, `tests/unit/platform/auth.test.ts`, `tests/unit/tenant/context.test.ts` |
| 4 | Dependency | **PASS (production)** | `pnpm audit --prod --json` → 0 advisories; dev-only residuals documented below |
| 5 | Mobile QA | **PASS** | `.visual-qa/reports/f016-production-hardening-visual-qa.md` |
| 6 | Desktop QA | **PASS** | `.visual-qa/reports/f016-production-hardening-visual-qa.md` |
| 7 | SEO | **PASS** | `tests/e2e/seo-html.spec.ts`, `tests/e2e/hardening.spec.ts` |
| 8 | Accessibility | **PASS** (audited baseline) | `tests/e2e/accessibility.spec.ts` |
| 9 | Performance | **PASS** (warm-local budget) | `.visual-qa/reports/f016-performance.json` |
| 10 | Failure states | **PASS** | `tests/e2e/hardening.spec.ts`, `tests/unit/public/failure-pages.test.tsx` |

## Method

- Inspected migrations `0000`–`0004`, tenant context/guards, auth proxy, admin
  and platform boundaries, media upload paths, public query/metadata layer, and
  environment validation.
- Exercised RLS with the non-bypass `tenant_app` role in PGlite against the real
  migrations and seed.
- Ran the network dependency audit before and after remediation and classified
  every advisory by production reachability.
- Seeded Tenant B with two tenant-owned vehicles so both showrooms exercise the
  real public inventory/detail/metadata path.
- Ran the two-showroom public matrix at 1440×900 and 390×844, plus raw-HTTP SEO
  and failure-state checks.
- Ran a deterministic offline audit (`scripts/hardening-audit.mjs`) that checks
  RLS coverage, header configuration, secret/unsafe-HTML patterns, and showroom
  seed readiness.

## Findings

### Fixed

| ID | Category | Severity | Finding | Fix | Regression evidence |
|---|---|---|---|---|---|
| F016-H01 | Dependency | Critical / High | `shadcn` was a production dependency and pulled the only critical advisory (`proxy-addr`) plus the MCP/Express/Hono/undici tree into the runtime audit | Moved `shadcn` to `devDependencies`; added version-scoped pnpm overrides for `fast-uri`, `postcss`, `nanoid`, `browserslist`, `baseline-browser-mapping`, and `source-map-js` in `pnpm-workspace.yaml` | Production audit 59 findings → 0; `.visual-qa/reports/f016-dependency-audit-{before,after}.json` |
| F016-H02 | Security | High | Responses lacked frame protection, permissions policy, COOP, a CSP subset, HSTS, and framework-disclosure suppression | Added `lib/security/headers.mjs` and wired it into `next.config.mjs`; `poweredByHeader: false`; HSTS production-only | `tests/unit/security/hardening-config.test.ts`; audit header check PASS |
| F016-H03 | Security / SEO | Medium | `robots.txt` did not disallow `/platform` | Added `/platform` to `app/robots.ts` | `hardening-config.test.ts`, `tests/e2e/seo-html.spec.ts`, `hardening.spec.ts` |
| F016-H04 | Authorization / Tenancy | High | Sign-in and recovery screens hard-coded “Prima Auto Gallery” on every tenant host | Added `lib/public/branding.ts` and a `brandName` prop; auth pages now resolve the request showroom and fall back to `OtoWeb`; pages forced dynamic | `tests/e2e/auth.spec.ts` Tenant B branding test; `hardening-config.test.ts` fallback tests |
| F016-H05 | RLS | High (audit gap) | The RLS test matrix omitted `analytics_events` and never asserted policy presence | Added `tablePolicyCount` and a 9-table enabled/forced/policy matrix | `tests/unit/tenant/rls.test.ts` 36/36 |
| F016-H06 | Failure states / SEO | High | Unknown and cross-tenant vehicle detail routes returned HTTP 200 while streaming the not-found fallback | Resolved `notFound()` in `generateMetadata` and removed the `/cars` Suspense boundary that flushed a 200 shell first | `hardening.spec.ts` failure-state test: 404 for unknown vehicle, host, and route |
| F016-H07 | Accessibility | Medium | Public search/filter selects had no accessible name; mobile menu exposed no expanded state; contact-form errors were not linked to fields | Added `aria-label`s, `aria-expanded`/`aria-controls`, and `id`/`aria-describedby`/`role="alert"` wiring | `tests/e2e/accessibility.spec.ts` 4/4 |
| F016-H08 | Two-showroom QA | High | Tenant B had settings but no inventory, so the second “realistic” showroom could not exercise inventory, detail, sitemap, or visual QA | Seeded two deterministic Tenant B vehicles and cover images, featured for the home page | `tests/unit/db/database-foundation.test.ts`, `hardening.spec.ts`, capture report |
| F016-H09 | Failure states | Medium | The global not-found/error surfaces were framework defaults; an unresolved host had no product-level recovery page | Added `app/not-found.tsx` (static, neutral) and `app/error.tsx` (retry) | `tests/unit/public/failure-pages.test.tsx`; 404 capture |
| F016-H10 | Test reliability / CI | Medium | The registration-404 e2e used an API request against `prima.otoweb.id`, which fails without host DNS mapping | Replaced it with an explicit `Host`-header HTTP request, matching the other server-rendered suites | `tests/e2e/auth.spec.ts` 6/6 |

### Accepted or deferred

| ID | Risk | Why deferred | Follow-up |
|---|---|---|---|
| F016-D01 | No full nonce-based `script-src` CSP | A script CSP needs nonce plumbing across Next’s inline bootstrap and every route; the current subset blocks framing/base/plugin/form abuse without breaking rendering | Add nonce-based CSP with an automated header + rendering gate |
| F016-D02 | Dev-only advisories remain (1 critical / 13 high, mostly `shadcn` → MCP/Express and `drizzle-kit` → esbuild) | These packages are not in the production audit and are not imported by the runtime; the production tree is clean | Upgrade the CLI/dev toolchain when patched releases land; keep `pnpm audit --prod` as the launch gate |
| F016-D03 | `images.unoptimized: true` remains enabled | Enabling the optimizer requires a remote-host allowlist and network-dependent visual verification for Unsplash/Cloudinary; offline QA would become flaky | Enable the optimizer with an explicit allowlist and production image-host verification |
| F016-D04 | `/cars` skeleton removed | The `loading.tsx` Suspense boundary caused real 404s to be returned as 200; correct status and SEO were prioritized | Reintroduce a skeleton only inside a non-status-critical section, or add a proxy-level existence check |
| F016-D05 | CI does not run the Playwright matrix | The current CI runs lint/typecheck/unit/build; browser execution is an explicit follow-up | Add a seeded dev server + the affected e2e specs to CI |
| F016-D06 | No Lighthouse/load/soak testing | The environment has no production-shaped CDN or load generator; warm-local timings are the agreed audit vehicle | Run Lighthouse/load tests against a staging deployment |
| F016-D07 | Accessibility is a baseline audit, not WCAG certification | No axe dependency or manual assistive-technology pass was in scope | Add automated axe checks and a manual keyboard/screen-reader review |
| F016-D08 | Production boot does not assert `DATABASE_URL` before serving | The build must run without live credentials; the runtime already fails closed (DB throws in production, auth returns anonymous) | Add a production-only startup check or deployment health probe for required server configuration |

## Dependency audit detail

| Run | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Production, before | 1 | 24 | 28 | 6 | 59 |
| Production, after | 0 | 0 | 0 | 0 | 0 |
| Full tree (incl. dev), after | 1 | 13 | 27 | 6 | 47 |

The production audit is clean. The full-tree critical/high findings are confined
to CLI/build packages (`shadcn`, `drizzle-kit`, ESLint tooling) and are recorded
as F016-D02.

## Two-showroom QA matrix

Showrooms: **Prima Auto Gallery** and **Tenant B Test Showroom** (two seeded
vehicles: Toyota Rush 2022 and Honda Mobilio 2021).

| Route | Desktop 1440×900 | Mobile 390×844 |
|---|---|---|
| Prima home | PASS | PASS |
| Prima inventory | PASS | PASS |
| Prima detail | PASS | PASS |
| Tenant B home | PASS | PASS |
| Tenant B inventory | PASS | PASS |
| Tenant B detail | PASS | PASS |
| Unknown host 404 | PASS | PASS |

Each row asserts tenant identity, contact details, expected inventory, no
cross-tenant identity/slug, and no horizontal overflow. Screenshots live under
`.visual-qa/screenshots/{desktop,mobile}/f016-*.png`; the capture report and JSON
are `.visual-qa/reports/f016-production-hardening-visual-qa.md` and
`.visual-qa/reports/f016-production-hardening-capture.json`.

## Performance audit (warm local server)

Measured after a warm navigation, via the browser Navigation Timing and
resource entries. Budgets: response start < 3,000 ms, DOMContentLoaded <
8,000 ms, transfer < 15 MB.

| Host | Route | Response start | DOMContentLoaded | Resources |
|---|---|---:|---:|---:|
| prima.otoweb.id | `/` | 204 ms | 319 ms | 14 |
| prima.otoweb.id | `/cars` | 183 ms | 237 ms | 18 |
| tenant-b.otoweb.id | `/` | 312 ms | 412 ms | 7 |
| tenant-b.otoweb.id | `/cars` | 87 ms | 111 ms | 8 |

Source: `.visual-qa/reports/f016-performance.json`. These are local audit
measurements, not production CDN/Lighthouse scores (see F016-D06).

## SEO audit

- Tenant-specific `<title>`, description, canonical, OpenGraph, and JSON-LD are
  asserted in `tests/e2e/seo-html.spec.ts`.
- Each host's sitemap contains only its own public URLs; drafts remain excluded.
- `robots.txt` advertises the request host's sitemap and disallows `/admin/`,
  `/platform`, `/api/`, `/auth/`, and the auth screens.
- Unknown hosts return 404 and expose no tenant identity.

## Accessibility audit

Checked on both showrooms for home, inventory, detail, and sign-in:

- `<html lang="id">`, exactly one visible `h1`, one `main` landmark.
- Every image has an `alt` attribute (decorative images use empty alt).
- Every public input/select/textarea has an accessible name.
- Icon-only buttons have an accessible name.
- The mobile menu exposes `aria-expanded` and `aria-controls`.
- Contact-form errors set `aria-invalid` and reference a `role="alert"` message
  through `aria-describedby`.

Manual capture review found no overlap, clipping, or horizontal overflow at the
audited viewports.

## Failure-state audit

| Scenario | Expected | Result |
|---|---|---|
| Unknown host | 404, no tenant identity | PASS |
| Unknown vehicle on a resolved tenant | 404, vehicle-not-found copy | PASS |
| Cross-tenant vehicle slug | 404, no other tenant identity | PASS |
| Unknown route | 404, neutral not-found copy | PASS |
| Malformed analytics JSON | 204, no body | PASS |
| Oversized analytics body | 204, no body | PASS |
| Analytics beacon on unknown host | 204, no write surface | PASS |
| `GET` on the analytics beacon | 405 | PASS |
| Route render error | Recoverable error boundary with retry | PASS (unit render) |
| Analytics/lead write failure | Public response remains safe | Covered by F015 tests; unchanged |

## Fresh checkpoint evidence

| Command | Result |
|---|---|
| `node scripts/hardening-audit.mjs` | PASS (RLS, headers, sources, showrooms) |
| `pnpm audit --prod --json` | 0 advisories |
| `npx tsc --noEmit` | exit 0 |
| `npm test` | exit 0 — 60 files / 557 tests passed |
| `pnpm lint` | exit 0 |
| `pnpm build` | exit 0 — production build, all routes compiled |
| Affected Playwright suite | exit 0 — 34 tests passed |
| `pnpm visual:qa:hardening` | PASS — 14 screenshots, no failures |

## Residual risk statement

The production dependency tree is clean, tenant isolation and authorization are
proven with database-backed tests, both showrooms pass the desktop/mobile and
SEO/accessibility/failure-state matrix, and the checkpoint quality gates are
green. The remaining risks are explicitly scoped above: a nonce CSP, dev-tool
advisories, image optimization, browser coverage in CI, production load
testing, and a deeper accessibility conformance pass.
