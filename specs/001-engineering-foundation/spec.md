# Feature Specification: Engineering Foundation

**Feature Branch**: `001-engineering-foundation`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Engineering Foundation: add ESLint, formatting, typecheck command, Vitest, Testing Library, Playwright, GitHub Actions, environment validation, and .env.example to the OtoWeb Next.js repository. Acceptance: pnpm lint, pnpm typecheck, pnpm test, and pnpm build succeed; at least one Playwright smoke test exists; no backend integration is introduced."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run trustworthy source-quality gates (Priority: P1)

A developer working on the OtoWeb repository can run a single lint command and a
single typecheck command. Both commands report actionable results, use the
project's existing Next.js 16 / React 19 / TypeScript setup, and exit
successfully on the current baseline.

**Why this priority**: Lint and typecheck are the minimum guardrails that turn
the v0 prototype into a project where later database, auth, and tenant work can
be merged safely.

**Independent Test**: From a clean checkout with dependencies installed, run
`pnpm lint` and `pnpm typecheck`. Both commands exit 0 and print their normal
summary output.

**Acceptance Scenarios**:

1. **Given** the repository with dependencies installed, **When** a developer
   runs `pnpm lint`, **Then** ESLint evaluates the project's TypeScript, React,
   and Next.js source and exits 0.
2. **Given** the repository with dependencies installed, **When** a developer
   introduces a TypeScript type error, **Then** `pnpm typecheck` exits non-zero
   and identifies the file and line.
3. **Given** the repository with dependencies installed, **When** a developer
   runs the documented formatting command, **Then** Prettier is available as the
   project formatter and has a non-destructive check command.

---

### User Story 2 - Run unit and component tests locally (Priority: P2)

A developer can run the automated unit and component test suite with
`pnpm test`. The suite executes real tests (not an empty placeholder), including
at least one test that renders a component through Testing Library, and reports
a pass/fail summary.

**Why this priority**: The project currently reports a misleading successful
`pnpm test` while running zero tests. A real test runner and at least one
representative test remove that false signal and give later phases a place to
add coverage.

**Independent Test**: Run `pnpm test`. Vitest executes the unit and component
tests, reports a non-zero number of tests, and exits 0.

**Acceptance Scenarios**:

1. **Given** dependencies are installed, **When** a developer runs
   `pnpm test`, **Then** Vitest runs in a browser-like DOM environment and
   prints the number of passing test files and tests.
2. **Given** a failing assertion is added to a test, **When** a developer runs
   `pnpm test`, **Then** the command exits non-zero and reports the failing
   assertion.
3. **Given** the existing formatting utilities, **When** the unit tests run,
   **Then** currency, distance, date, and WhatsApp link behavior is verified.

---

### User Story 3 - Prove the app boots in a real browser (Priority: P3)

A developer can run a Playwright smoke test that starts the application, opens
the public homepage, and verifies that the page renders the expected showroom
content and navigation.

**Why this priority**: A real-browser smoke test proves the application can
start and serve the public surface, which unit tests alone cannot establish.

**Independent Test**: Run `pnpm test:e2e`. Playwright starts the app, opens the
homepage, and the smoke test passes.

**Acceptance Scenarios**:

1. **Given** Playwright and its browser are installed, **When** a developer runs
   `pnpm test:e2e`, **Then** the smoke test opens the homepage and confirms the
   showroom heading and a link to the vehicle collection are visible.
2. **Given** the application server cannot start, **When** the smoke test runs,
   **Then** Playwright reports the startup failure instead of silently passing.

---

### User Story 4 - Enforce the gates in CI and fail fast on bad configuration (Priority: P4)

A maintainer can rely on GitHub Actions to run install, lint, typecheck, unit
tests, and build for every pull request and push to the main branch. The
application also validates environment variables at build/start time and ships
an `.env.example` that documents the expected variables without exposing any
credentials.

**Why this priority**: CI makes the quality gates enforceable, and environment
validation prevents a malformed public configuration from reaching a build or a
deployment. These are prerequisites for every later production phase.

**Independent Test**: Inspect the workflow file for the required steps, run
`pnpm validate:env` with valid and invalid public values, and compare
`.env.example` against the validation schema. No real secrets are present.

**Acceptance Scenarios**:

1. **Given** a pull request, **When** GitHub Actions runs, **Then** it installs
   dependencies with the lockfile and runs lint, typecheck, unit tests, and
   build.
2. **Given** a malformed `NEXT_PUBLIC_SITE_URL`, **When** `pnpm validate:env`
   or `pnpm build` runs, **Then** validation fails with a clear message.
3. **Given** the repository, **When** a developer inspects `.env.example`,
   **Then** every documented variable has a safe placeholder and no credential
   value is present.
4. **Given** a developer creates a local `.env` file, **When** they run
   `git status`, **Then** the real environment file is ignored while
   `.env.example` remains tracked.

---

### Edge Cases

- A developer runs `pnpm test` with no test files: the command must fail rather
  than silently pass.
- Playwright runs when port 3000 is already in use: local runs reuse an existing
  server, while CI treats a missing server as a failure.
- `NEXT_PUBLIC_SITE_URL` is empty or not a URL: validation fails with the
  variable name and expected format.
- `NEXT_PUBLIC_SHOWROOM_SLUG` contains spaces or unsupported characters:
  validation fails with the variable name and allowed pattern.
- A real `.env`, `.env.local`, or `.env.production` file exists: it is ignored by
  git; only `.env.example` is committed.
- ESLint encounters a file generated by Next.js or a test artifact: generated
  directories are ignored by both ESLint and Prettier.
- `next build` encounters a TypeScript error: the build fails instead of
  ignoring the error, because `typescript.ignoreBuildErrors` is no longer
  enabled.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST provide a lint command (`pnpm lint`) backed by an
  ESLint configuration that covers TypeScript, React, and Next.js source and
  exits 0 on the current baseline.
- **FR-002**: The project MUST provide Prettier as the formatter, with a
  configuration, ignore rules, and both write and check scripts.
- **FR-003**: The project MUST provide a typecheck command (`pnpm typecheck`)
  that runs the TypeScript compiler in no-emit mode and exits 0 on the current
  baseline.
- **FR-004**: The project MUST provide a test command (`pnpm test`) that runs
  Vitest with a browser-like DOM environment and Testing Library, and executes
  at least one unit test and at least one component-rendering test.
- **FR-005**: The project MUST provide Playwright configuration and at least one
  browser smoke test, runnable with `pnpm test:e2e`, that starts the application
  and verifies the public homepage.
- **FR-006**: The project MUST provide a GitHub Actions workflow that runs
  dependency installation, lint, typecheck, unit tests, and build for pull
  requests and pushes to the main branch.
- **FR-007**: The project MUST validate environment variables with a schema,
  apply safe defaults for the current no-backend baseline, reject malformed
  values, and run that validation when the Next.js configuration loads and via a
  dedicated script.
- **FR-008**: The project MUST include an `.env.example` that documents the
  validated public variables with non-secret placeholder values.
- **FR-009**: The project MUST make `pnpm build` succeed with Next.js TypeScript
  checking enabled; the build MUST NOT ignore TypeScript errors.
- **FR-010**: The feature MUST NOT introduce backend integration: no database,
  ORM, authentication, tenant data access, file-storage provider, or network
  persistence.
- **FR-011**: The feature MUST NOT change the existing visual design or public
  presentation; source-formatting changes to existing UI files are out of scope.
- **FR-012**: The project MUST ignore real environment files while keeping
  `.env.example` tracked.
- **FR-013**: The project MUST exclude generated output, dependency directories,
  coverage output, and test artifacts from lint, format, and TypeScript checks.

### Key Entities *(include if feature involves data)*

- **Environment variable set**: The validated public configuration values
  (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SHOWROOM_SLUG`) with defaults and format
  rules. No secrets are part of the current set.
- **Quality gate**: A named command (`lint`, `typecheck`, `test`, `test:e2e`,
  `build`, `validate:env`) with a pass/fail result and command output.
- **CI workflow job**: The GitHub Actions job that installs dependencies and runs
  the quality gates.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All four roadmap acceptance commands (`pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm build`) exit 0 on the delivered
  repository.
- **SC-002**: `pnpm test` executes at least two tests (at least one unit test and
  at least one component test) and reports a passing summary.
- **SC-003**: At least one Playwright smoke test exists and passes against the
  running application.
- **SC-004**: A GitHub Actions workflow exists and contains install, lint,
  typecheck, unit-test, and build steps.
- **SC-005**: Environment validation accepts the documented defaults and rejects
  a malformed `NEXT_PUBLIC_SITE_URL` and a malformed
  `NEXT_PUBLIC_SHOWROOM_SLUG`.
- **SC-006**: `.env.example` contains no credentials, and real environment files
  are ignored by git.
- **SC-007**: The feature produces no intentional change to the rendered public
  or admin UI; existing presentation files are not restyled.

## Assumptions

- The project remains a single Next.js 16 application managed with pnpm
  (`packageManager: pnpm@12.3.4`) and Node.js 24.
- ESLint 9 flat configuration with `eslint-config-next` is the reasonable default
  because it is the Next.js-supported path; Prettier is paired with it and
  conflicting stylistic ESLint rules are disabled.
- Vitest with jsdom is the reasonable default for unit and component tests;
  Testing Library is used for the component-rendering test.
- Playwright uses Chromium for the smoke test. The local web server is started by
  Playwright; CI may reuse the same configuration when the team chooses to run
  E2E there, but the roadmap's mandatory CI steps are install, lint, typecheck,
  unit tests, and build.
- The current application has no required environment variables. Public
  configuration values receive safe defaults so local development and builds
  work without a real `.env` file; future backend phases will add required
  variables to the same schema.
- Existing source files are not bulk-reformatted during this feature, to keep the
  approved UI baseline diff free of presentation-file churn. Formatter
  configuration and write/check scripts are still delivered and used on the new
  tooling and test files.
- The configured validation commands in `.sdd-toolbox/config.json`
  (`npx tsc --noEmit`, `npm test`) remain valid after the new scripts are added.
