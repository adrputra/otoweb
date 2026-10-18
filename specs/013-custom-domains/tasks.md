---
description: "Task list for custom domains"
---

# Tasks: Custom Domains

**Input**: Design documents from `/specs/013-custom-domains/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included. Domain verification and routing are security-sensitive, and
the roadmap requires fresh visual evidence for the UI surface.

**Organization**: Tasks are grouped by user story. US1 is registration and DNS
instructions, US2 is verification and SSL, US3 is routing and platform-subdomain
fallback, and US4 is operator safety and observability.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the additive schema and configuration inputs.

- [x] T001 Add `verification_status`, `verification_token`, `ssl_status`, `ssl_provisioned_at`, and `last_checked_at` columns to `tenant_domains` in `db/schema.ts` with safe defaults.
- [x] T002 Generate `db/migrations/0003_custom-domains.sql` plus the Drizzle meta journal/snapshot from `db/schema.ts`, and backfill active verified rows to `verification_status = 'verified'` and `ssl_status = 'active'` (depends on T001).
- [x] T003 Update the two seeded platform domains in `db/seed-core.ts` with `verificationStatus: 'verified'` and `sslStatus: 'active'` so the shared fixtures match the new contract (depends on T001).
- [x] T004 [P] Add `DOMAIN_PROVIDER`, `DOMAIN_PROVIDER_URL`, `DOMAIN_PROVIDER_TOKEN`, and `CUSTOM_DOMAIN_CNAME_TARGET` to `scripts/validate-env.mjs` and `.env.example`; reject `http` without URL/token and reject `fake` in production.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Provider boundary and DNS instructions. No story work starts until these exist.

- [x] T005 Create provider and lifecycle types in `lib/domains/types.ts` and stable DNS instruction/token helpers in `lib/domains/dns.ts` (depends on T004).
- [x] T006 Implement the deterministic `FakeDomainProvider` in `lib/domains/fake-provider.ts` with default verified/active outcomes plus injectable DNS/SSL outcomes and call recording (depends on T005).
- [x] T007 Implement the configured `HttpDomainProvider` in `lib/domains/http-provider.ts` and the environment-based fail-closed factory in `lib/domains/provider.ts` (depends on T005).
- [x] T008 Export the shared platform transaction helper and result mapper from `lib/platform/tenant-service.ts` for reuse by the domain service (depends on T001).

---

## Phase 3: User Story 1 - Register a showroom's custom domain and receive DNS instructions (Priority: P1) 🎯 MVP

**Goal**: An operator registers a custom hostname, sees pending state and exact TXT/CNAME instructions, and receives conflicts or validation errors without state changes.

**Independent Test**: Register `showroom.example.com` for the Prima tenant through the service and UI; confirm pending state, stable token, both instructions, and rejection of platform-root and duplicate hostnames.

### Implementation for User Story 1

- [x] T009 [P] [US1] Add `registerCustomDomainInputSchema` and `verifyCustomDomainInputSchema` to `lib/platform/validation.ts`, reusing hostname normalization and UUID validation.
- [x] T010 [US1] Add custom-domain fields and DNS instructions to `PlatformTenantDomain` and `toDomain` in `lib/platform/types.ts` and `lib/platform/tenant-service.ts` (depends on T005).
- [x] T011 [US1] Create `lib/platform/domain-service.ts` with registration over the platform transaction helper, including platform-root rejection, global hostname conflict, tenant existence, and stable token creation (depends on T008, T009, T010).
- [x] T012 [US1] Add `registerCustomDomainAction` to `lib/platform/actions.ts` and revalidate the platform and public paths (depends on T011).
- [x] T013 [US1] Create `components/platform/custom-domains.tsx` with registration form, pending-state list, verification/SSL badges, and DNS instruction display; mount it on `app/platform/tenants/[id]/page.tsx` (depends on T012).
- [x] T014 [P] [US1] Add `tests/unit/platform/domain-service.test.ts` registration cases and extend `tests/unit/platform/validation.test.ts` for custom-domain contracts (depends on T011).
- [x] T015 [P] [US1] Create `docs/CUSTOM_DOMAINS.md` documenting registration, DNS records, provider configuration, lifecycle states, routing, and fallback.

**Checkpoint**: Registration, instructions, conflicts, and validation are independently testable.

---

## Phase 4: User Story 2 - Verify ownership and provision SSL before serving (Priority: P1)

**Goal**: Verification records pending/verified/failed, provisions a certificate, retries safely, and routes only when both ownership and SSL are active.

**Independent Test**: Run verification against the fake provider with verified, pending, failed, and SSL-failure outcomes; confirm state transitions and certificate gating.

### Implementation for User Story 2

- [x] T016 [US2] Implement `verifyCustomDomain` in `lib/platform/domain-service.ts`: provider DNS check, verified/failed state, certificate provisioning, `last_checked_at`, retry support, and active routing status only on verified + active SSL (depends on T011).
- [x] T017 [US2] Add `verifyCustomDomainAction` to `lib/platform/actions.ts` and a **Verifikasi DNS** control with state feedback to `components/platform/custom-domains.tsx` (depends on T016).
- [x] T018 [P] [US2] Add verification/SSL transition tests to `tests/unit/platform/domain-service.test.ts` covering pending, failed, verified+active, SSL failure, retry, and stable token/instructions (depends on T016).
- [x] T019 [P] [US2] Add `tests/unit/domains/provider.test.ts` covering fake-provider outcomes, environment selection, production fail-closed default, HTTP configuration requirements, and DNS instruction values (depends on T005, T006, T007).
- [x] T020 [P] [US2] Document the production provider contract and credential boundary in `docs/CUSTOM_DOMAINS.md` and `.env.example` (depends on T015, T007).

**Checkpoint**: A domain cannot route until ownership is verified and its certificate is active.

---

## Phase 5: User Story 3 - Route the custom hostname while the platform subdomain remains a fallback (Priority: P1)

**Goal**: A verified custom host resolves to the same tenant as the platform subdomain, and the platform subdomain always keeps working.

**Independent Test**: Register and verify a custom domain, resolve both hosts, then leave another custom domain pending and confirm only the platform host resolves.

### Implementation and tests for User Story 3

- [x] T021 [US3] Strengthen `findExactTenant` in `lib/tenant/hostname.ts` so custom rows require `verification_status = 'verified'` and `ssl_status = 'active'` in addition to active + verified, without changing platform-subdomain behavior (depends on T002).
- [x] T022 [P] [US3] Add routing and fallback tests to `tests/unit/platform/domain-service.test.ts`: verified custom host resolves, pending/failed/certificate-inactive custom host fails closed, platform subdomain still resolves, and suspended tenant fails both (depends on T021, T016).
- [x] T023 [P] [US3] Add `tests/e2e/custom-domains.spec.ts` that signs in as the platform operator, registers and verifies a custom domain through the real UI, then fetches the custom Host header and the platform subdomain from one server; update `playwright.platform.config.ts` match and `DOMAIN_PROVIDER=fake` env (depends on T017, T021).
- [x] T024 [P] [US3] Update `docs/SUBDOMAIN_ROUTING.md`, `docs/TENANCY.md`, and `docs/PUBLIC_SITE.md` for custom-domain exact-row semantics and the platform-subdomain fallback.

**Checkpoint**: Both the custom host and the fallback host are proven from one deployment.

---

## Phase 6: User Story 4 - Keep custom-domain operations safe and observable (Priority: P2)

**Goal**: Only platform operators can inspect or mutate custom domains; state and instructions are visible; tenants cannot see each other's domains.

**Independent Test**: Exercise owner/staff denial, cross-tenant detail reads, and the operator state view.

### Implementation and tests for User Story 4

- [x] T025 [US4] Add platform-authorization and cross-tenant isolation assertions for registration and verification to `tests/unit/platform/domain-service.test.ts` (depends on T016).
- [x] T026 [P] [US4] Update `docs/PLATFORM.md` and `docs/DATABASE.md` to describe the custom-domain capability, new columns, authorization boundary, and verification path.
- [x] T027 [US4] Ensure the tenant detail page renders domain type, verification state, SSL state, last check, and instructions for operators while retaining the existing platform shell and neutral design language (depends on T013, T017).

**Checkpoint**: The platform surface is operator-only and shows every domain state.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Visual and checkpoint evidence.

- [x] T028 Create `scripts/visual-qa-custom-domains.mjs` and the `visual:qa:custom-domains` script in `package.json`; register and verify a custom domain through the platform UI, then capture the platform detail, custom-domain home, and platform-subdomain fallback at desktop 1440×900 and mobile 390×844 (depends on T023, T027).
- [x] T029 Run the focused checks and record fresh output: `npx tsc --noEmit`; `npx vitest run tests/unit/domains tests/unit/platform tests/unit/tenant/hostname.test.ts tests/unit/public/tenant-resolution.test.ts`; `npx playwright test --config playwright.platform.config.ts tests/e2e/custom-domains.spec.ts`; `npm run visual:qa:custom-domains` (depends on T018, T019, T022, T023, T025, T028).
- [x] T030 Run `/home/adrputra/.agents/skills/impeccable/scripts/impeccable detect --json app/platform components/platform` and resolve every finding on the changed UI before handoff (depends on T027).
- [x] T031 Re-read `docs/CUSTOM_DOMAINS.md` and the updated platform/tenancy/database/routing docs against the implemented behavior; correct drift without weakening a check (depends on T029).
- [x] T032 Run the full checkpoint validation `npx tsc --noEmit` and `npm test` fresh before reporting completion (depends on T029, T030, T031).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001–T004)**: T002/T003 depend on T001; T004 is independent.
- **Foundational (T005–T008)**: T006/T007 depend on T005; T008 is independent of T005.
- **US1 (T009–T015)**: T010 depends on T005; T011 depends on T008–T010; T012 depends on T011; T013 depends on T012; tests/docs depend on T011/T015.
- **US2 (T016–T020)**: depends on US1 registration. T017 depends on T016; tests/docs depend on T016/T007.
- **US3 (T021–T024)**: depends on T002/T016. Tests and e2e depend on T017/T021.
- **US4 (T025–T027)**: depends on US2/US1 UI. Docs are independent.
- **Polish (T028–T032)**: T029 depends on all tests and the visual script; T032 is last.

### Parallel Opportunities

- T004 is independent of schema work.
- T005 can start once T004 lands; T006 and T007 can then run in parallel.
- T009, T014, T015 are independent files.
- T018, T019, T020 are independent test/docs files.
- T022, T023, T024 are independent after routing is implemented.
- T025 and T026 are independent.
- T030 runs after T027 and before the final checkpoint.

## Implementation Strategy

### MVP First

1. Complete schema + provider foundations.
2. Complete US1 registration and instructions.
3. Complete US2 verification/SSL and prove gating.
4. Complete US3 routing/fallback with unit and e2e proof.
5. Add US4 authorization/isolation coverage.
6. Run visual QA, detector, and the full checkpoint.

## Notes

- [P] tasks use different files and can run together.
- `tasks.md` checkboxes are ticked as each task completes.
- Never weaken tenant-isolation, platform-authorization, or wildcard-routing
  tests to make custom domains pass.
- No live DNS/CA call is made in this environment.
