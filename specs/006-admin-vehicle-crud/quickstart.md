# Quickstart: Admin Vehicle CRUD

**Feature**: `006-admin-vehicle-crud`

## Automated verification

```bash
# Shared schema + service integration (PGlite, tenant fixtures)
npx vitest run tests/unit/admin tests/unit/validation

# Full unit/type gates
npx tsc --noEmit
npm test

# Optional browser acceptance (fake GoTrue provider, in-memory database)
npx playwright test --config playwright.admin.config.ts

# Visual QA (admin surfaces, desktop + mobile)
pnpm visual:qa:admin
```

## Manual acceptance path

1. `pnpm dev` (in-memory PGlite seeded from `db/migrations`).
2. Sign in through a configured Supabase project, or use the QA script's fake
   provider.
3. Open `/admin/vehicles` → **Tambah kendaraan**.
4. Fill brand/model/variant/year, price, description, tax expiry, engine
   capacity, plate region, and location.
5. **Simpan draft**. The unit appears in the admin list with publication
   `draft`.
6. Open the edit page, set **Status publikasi** to `Published`, and
   **Publikasikan**.
7. Open `/cars` and `/cars/{slug}` on the same tenant hostname. The unit is
   visible.
8. From the list, exercise **Dipesan**, **Terjual**, **Arsipkan**,
   **Duplikat**, and **Hapus**. Each change persists without SQL.

## Expected evidence

- Service tests: create → stored draft → publish → public read.
- Cross-tenant test: Tenant B cannot read or mutate Prima's unit.
- Visual QA: `.visual-qa/reports/f007-admin-vehicle-crud-visual-qa.md`,
  `capture.json`, and desktop/mobile screenshots of the list, create, and edit
  surfaces.
