# Implementation Plan: Engineering Foundation

**Branch**: `001-engineering-foundation` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-engineering-foundation/spec.md`

## Summary

Add the missing engineering guardrails to the existing Next.js 16 / React 19
application without changing its presentation or introducing backend services:
ESLint 9 flat config, Prettier, a `typecheck` script, Vitest + Testing Library
unit/component tests, a Playwright homepage smoke test, a GitHub Actions CI
workflow, Zod-based environment validation, and a credential-free `.env.example`.
The existing `typescript.ignoreBuildErrors` escape hatch is removed so
`pnpm build` enforces the typecheck that `pnpm typecheck` already proves.

## Technical Context

**Language/Version**: TypeScript 5.7, Node.js 24, Next.js 16.4.0, React 19.

**Primary Dependencies**: Existing Next.js/React/Zod stack. New dev
dependencies: ESLint 9 with `eslint-config-next@16.4.0` and
`eslint-config-prettier`, Prettier 3, Vitest 5 with `@vitejs/plugin-react` and
`jsdom`, `@testing-library/react`, `@testing-library/jest-dom`,
`@testing-library/user-event`, and `@playwright/test`.

**Storage**: N/A — no database, ORM, or persistence is introduced.

**Testing**: Vitest (jsdom) + Testing Library for unit/component tests;
Playwright (Chromium) for the browser smoke test.

**Target Platform**: Node.js 24 / pnpm 12.3.4; local development and GitHub
Actions; Next.js App Router.

**Project Type**: Single Next.js web application with an App Router frontend and
admin surface.

**Performance Goals**: No runtime performance change is intended. The tooling
must not slow the acceptance gates unreasonably; Playwright is scoped to a single
homepage smoke test.

**Constraints**: No backend integration, no visual redesign, no real credentials,
and no changes to existing presentation files. Acceptance commands
`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` must pass. The
configured validation commands `npx tsc --noEmit` and `npm test` must also pass.

**Scale/Scope**: One repository, one app, one feature. The test suite starts with
a small representative set; later phases add coverage.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still the unfilled project template (no
ratified principles). Per the converge/plan guidance, constitution checks are
skipped gracefully rather than failing. No constitution bootstrap exists in
`.sdd-toolbox/roadmap.json` for this feature.

**Result**: PASS (no ratified constraints to violate).

## Project Structure

### Documentation (this feature)

```text
specs/001-engineering-foundation/
├── spec.md
├── plan.md
├── research.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md             # created by the tasks capability
```

### Source Code (repository root)

```text
.github/
└── workflows/ci.yml

scripts/
└── validate-env.mjs

tests/
├── unit/
│   ├── format.test.ts
│   └── vehicle-card.test.tsx
└── e2e/
    └── home.spec.ts

eslint.config.mjs
prettier config (.prettierrc.json) + .prettierignore
vitest.config.ts
vitest.setup.ts
playwright.config.ts
.env.example
next.config.mjs          # env validation + remove ignoreBuildErrors
package.json             # scripts + dev dependencies
pnpm-lock.yaml           # dependency lock update
tsconfig.json            # exclude generated test/build artifacts
.gitignore               # ignore real env files + test/build artifacts
```

**Structure Decision**: The existing single-project layout is preserved. Tests
live in a top-level `tests/` directory so unit and E2E suites are clearly
separated from application source. Tooling configuration stays at the repository
root, matching Next.js, ESLint, Prettier, Vitest, and Playwright conventions.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations; no complexity tracking required.
