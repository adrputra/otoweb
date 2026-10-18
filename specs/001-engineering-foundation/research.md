# Research: Engineering Foundation

**Feature**: `001-engineering-foundation`  
**Date**: 2026-10-18

## Decision 1 — ESLint 9 flat config with Next.js presets

- **Decision**: Use ESLint 9's flat config (`eslint.config.mjs`) with
  `eslint-config-next/core-web-vitals`, `eslint-config-next/typescript`, and
  `eslint-config-prettier` last.
- **Rationale**: `eslint-config-next@16.4.0` is the version-matched Next.js
  preset and supports flat config. `core-web-vitals` catches the framework and
  accessibility rules that matter for the existing app; the TypeScript preset
  adds type-aware source rules. `eslint-config-prettier` prevents stylistic
  fights with Prettier.
- **Alternatives considered**: ESLint 8 legacy `.eslintrc` (deprecated and not
  the Next.js 16 path); Biome lint (would split the formatting/lint toolchain and
  lose the official Next.js rules).

## Decision 2 — Prettier for formatting, without reformatting the UI baseline

- **Decision**: Add Prettier 3 with `.prettierrc.json`, `.prettierignore`, and
  `format`/`format:check` scripts. Apply formatting to new tooling and test files
  only; do not bulk-reformat existing presentation files.
- **Rationale**: The roadmap requires formatting. The approved v0 UI is a
  preservation baseline, and this feature is engineering tooling only, so
  reformatting every UI file would create presentation-file churn unrelated to
  the feature. The configuration and scripts are still available for a
  deliberate, separately reviewed normalization later.
- **Alternatives considered**: Biome format (single tool with lint, but not the
  chosen ESLint stack); formatting the entire repository now (large diff and
  unnecessary risk against the visual baseline).

## Decision 3 — Vitest with jsdom and Testing Library

- **Decision**: Use Vitest 5 with `@vitejs/plugin-react`, `jsdom`, and
  Testing Library (`@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`). Test both a pure utility module and a rendered
  component.
- **Rationale**: Vitest is the roadmap requirement and shares Vite's transform
  pipeline, so TypeScript and React JSX work without a separate Babel setup.
  jsdom is sufficient for the component smoke test and avoids a browser for unit
  runs. Testing Library satisfies the roadmap requirement and verifies the
  existing components without changing them.
- **Alternatives considered**: Jest (extra transform configuration for Next.js
  and ESM); happy-dom (fast, but jsdom is the more established Testing Library
  default).

## Decision 4 — Playwright homepage smoke test

- **Decision**: Add `@playwright/test` with a Chromium project, a local
  `webServer` that runs `pnpm dev`, and one smoke test that opens `/` and checks
  the showroom heading plus a link to `/cars`.
- **Rationale**: The roadmap requires at least one Playwright smoke test. A
  homepage test proves the app boots and the public surface renders. Reusing an
  existing local server keeps repeated runs fast; CI can add E2E later when the
  team chooses a preview environment.
- **Alternatives considered**: Testing the admin surface (more setup and still
  mock-only); running the production build for every smoke test (slower and
  redundant with the build gate).

## Decision 5 — Zod environment validation at configuration load

- **Decision**: Add `scripts/validate-env.mjs` using the existing Zod dependency.
  It validates `NODE_ENV`, `NEXT_PUBLIC_SITE_URL`, and
  `NEXT_PUBLIC_SHOWROOM_SLUG`, applies safe defaults, and is imported by
  `next.config.mjs` so `pnpm dev`/`pnpm build` fail fast. A `validate:env` script
  runs it directly for CI and manual checks.
- **Rationale**: Zod is already a production dependency, so no new runtime
  dependency is needed. Importing the validator from `next.config.mjs` makes the
  check effective on every Next.js start/build, not just in a test. Defaults keep
  the no-backend baseline working without a real `.env`.
- **Alternatives considered**: `@t3-oss/env-nextjs` (adds a dependency and
  conventions beyond the current need); validating only in tests (would not
  protect builds).

## Decision 6 — GitHub Actions with the repository's package manager

- **Decision**: Add `.github/workflows/ci.yml` for pull requests and pushes to
  `main`, using `pnpm/action-setup@v4` with pnpm 12.3.4, Node.js 24, a cached
  `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, and `pnpm build`.
- **Rationale**: The roadmap requires install, lint, typecheck, unit tests, and
  build on pull requests. Matching `packageManager` and Node keeps CI aligned
  with local commands. The frozen lockfile makes installs reproducible.
- **Alternatives considered**: npm in CI (would diverge from the lockfile and
  package manager); including E2E in the required job (not required by the
  roadmap and slower; the smoke test remains available for a future E2E job).

## Decision 7 — Enforce TypeScript in the production build

- **Decision**: Remove `typescript.ignoreBuildErrors: true` from
  `next.config.mjs`.
- **Rationale**: The audit records TD-08 (build ignores TypeScript errors) as a
  Phase 2 blocker. `npx tsc --noEmit` already passes on the baseline, so enabling
  the build check is safe and makes `pnpm build` meaningful.
- **Alternatives considered**: Leaving the escape hatch (contradicts the
  engineering-foundation goal); adding a separate build-time typecheck script
  (redundant because Next.js already runs TypeScript during build).

## Decision 8 — Environment files and generated artifacts

- **Decision**: Commit `.env.example` with non-secret placeholders and update
  `.gitignore` to ignore `.env`, `.env.*` (except `.env.example`),
  `*.tsbuildinfo`, and test/build outputs such as `coverage/`,
  `playwright-report/`, and `test-results/`.
- **Rationale**: Prevents accidental credential commits and keeps generated
  output out of version control while preserving the documented template.
- **Alternatives considered**: Relying only on `.env*.local` (would still allow
  `.env` and `.env.production` to be committed).

## Open questions

None. The roadmap and the audited baseline resolve tool scope, acceptance
commands, and the no-backend constraint. Defaults for tool choices are recorded
above and in the spec's Assumptions section.
