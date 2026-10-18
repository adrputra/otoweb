# Quickstart: Engineering Foundation

**Feature**: `001-engineering-foundation`  
**Purpose**: Runnable validation guide for the engineering tooling delivered by
this feature.

## Prerequisites

- Node.js 24
- pnpm 12.3.4 (`packageManager` in `package.json`)
- A Playwright Chromium browser for the E2E smoke test
  (`pnpm exec playwright install chromium`)

## Install

```bash
pnpm install --frozen-lockfile
```

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: each command exits 0. `pnpm test` reports the Vitest test files and
test count; `pnpm build` compiles the Next.js application and performs TypeScript
checking.

## Browser smoke test

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

Expected: Playwright starts the app, opens `/`, and the homepage smoke test
passes.

## Environment validation

```bash
pnpm validate:env
```

Expected: `Environment validation passed.`

Negative checks:

```bash
NEXT_PUBLIC_SITE_URL=not-a-url pnpm validate:env
```

Expected: non-zero exit with a Zod message naming `NEXT_PUBLIC_SITE_URL`.

```bash
NEXT_PUBLIC_SHOWROOM_SLUG="not a slug" pnpm validate:env
```

Expected: non-zero exit with a Zod message naming `NEXT_PUBLIC_SHOWROOM_SLUG`.

## Environment template

Copy `.env.example` to `.env.local` if you need to override the defaults:

```bash
cp .env.example .env.local
```

`.env.local` and other real environment files are ignored by git. Only
`.env.example` is tracked, and it contains no credentials.

## Formatting

```bash
pnpm format        # write
pnpm format:check  # check
```

Prettier is configured for the repository. Existing presentation files are
intentionally not reformatted by this feature; the scripts are available for a
separate, reviewed normalization.

## CI

The GitHub Actions workflow `.github/workflows/ci.yml` runs install, lint,
typecheck, unit tests, and build for pull requests and pushes to `main`.

## Roadmap acceptance mapping

| Roadmap requirement | Command / artifact |
|---|---|
| ESLint | `pnpm lint`, `eslint.config.mjs` |
| Formatting | `pnpm format`, `.prettierrc.json` |
| Typecheck command | `pnpm typecheck` |
| Vitest | `pnpm test`, `vitest.config.ts` |
| Testing Library | `tests/unit/vehicle-card.test.tsx` |
| Playwright | `pnpm test:e2e`, `tests/e2e/home.spec.ts` |
| GitHub Actions | `.github/workflows/ci.yml` |
| Environment validation | `pnpm validate:env`, `scripts/validate-env.mjs` |
| `.env.example` | `.env.example` |
| No backend integration | No database/auth/storage dependency added |
