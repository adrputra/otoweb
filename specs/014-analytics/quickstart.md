# Quickstart: Analytics

## Prerequisites

- Node.js 24 and the repository dependencies installed.
- No `DATABASE_URL` is required for development or unit tests: the app falls
  back to a migrated, seeded in-memory PGlite database.
- No analytics vendor, API key, or environment variable is required.

## Apply the schema

```sh
pnpm db:generate   # only when changing db/schema.ts
pnpm db:migrate    # real PostgreSQL when DATABASE_URL is configured
pnpm db:verify     # migration + seed contract tests
```

The migration is additive: it creates the enum, table, indexes, and RLS policy.

## Validate the feature

```sh
npx tsc --noEmit
npm test
```

Focused suites:

```sh
npx vitest run tests/unit/analytics
npx vitest run tests/unit/public/whatsapp-tracking.test.ts
```

Affected end-to-end suite:

```sh
npx playwright test -c playwright.admin.config.ts tests/e2e/admin-analytics.spec.ts
```

Visual evidence:

```sh
npm run visual:qa:analytics
```

Outputs desktop (1440×900) and mobile (390×844) screenshots plus a report under
`.visual-qa/`.

## Manual scenarios

1. **Track a view**: open `/cars/toyota-fortuner-2021-1` on the Prima host and
   confirm one `vehicle_view` row for the Prima tenant after the page loads.
2. **Track a search**: open `/cars?brand=Toyota` and confirm one
   `inventory_search` and one `filter_use` row.
3. **Track WhatsApp**: follow the WhatsApp call to action and confirm one
   `whatsapp_click` row after the redirect, with the vehicle linked.
4. **Track contact**: submit the public contact form and confirm one
   `contact_submit` row plus one new lead.
5. **Track share**: use the share control and confirm one `vehicle_share` row.
6. **Dashboard**: sign in as the Prima owner, open `/admin`, and confirm vehicle
   views, most viewed vehicles, WhatsApp clicks, new leads, and conversion.
7. **Non-blocking**: stop or break the analytics insert and repeat scenarios 3
   and 4; the redirect and success state must still work.
8. **Isolation**: run the restricted-role checks in
   `tests/unit/analytics/rls.test.ts`; Tenant B must see zero Prima events.

## Expected results

- Six event types recorded under the resolved tenant only.
- Dashboard values match the seeded events; an empty tenant shows `0`
  values, `0.0%` conversion, and an empty most-viewed state.
- No personal data in `analytics_events`.
- No public flow depends on analytics success.
