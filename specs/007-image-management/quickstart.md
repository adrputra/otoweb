# Quickstart: Image Management

**Feature**: `007-image-management` | **Date**: 2026-10-19

## Prerequisites

- Node.js 20+ and the repository dependencies installed (`pnpm install`).
- No Cloudinary account is required for local development or tests.
- The admin surface uses the existing fake GoTrue QA endpoint for browser
  checks; no production auth bypass exists.

## Provider configuration

Production (documented in `docs/MEDIA.md`, never committed):

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_UPLOAD_FOLDER=otoweb/vehicles
```

Local development / CI (no credentials):

```dotenv
MEDIA_PROVIDER=fake
MEDIA_LOCAL_DIR=public/uploads
MEDIA_PUBLIC_PREFIX=/uploads
```

If no variables are set in development, the fake provider is used
automatically. In production, missing Cloudinary configuration fails loudly.

## Validate the feature

```bash
# Unit + integration (includes 15 high-resolution images in one vehicle)
npx vitest run tests/unit/media tests/unit/admin

# Type gate
npx tsc --noEmit

# Full suite
npm test

# Admin browser flow (15 uploads, reorder, cover, delete)
npx playwright test --config playwright.admin.config.ts

# Visual QA (desktop + mobile, writes .visual-qa/)
pnpm visual:qa:admin
```

## Manual workflow

1. Sign in to the admin surface and open **Kendaraan → Tambah kendaraan**.
2. Fill the required fields and save a draft.
3. Open the draft's edit page.
4. Select 15 high-resolution JPEG/PNG/WebP files. Each tile shows its own
   progress bar and reaches 100%.
5. Drag a photo or use the up/down controls; choose **Jadikan cover** on a
   different photo.
6. Reload the page. The order and cover badge are unchanged.
7. Delete one photo. The remaining positions close up and the cover remains
   valid.
8. Publish the vehicle and open its public detail page. The chosen cover is the
   hero image and the URL carries an optimization transformation.
9. Delete the vehicle from the admin list. The vehicle and its image rows are
   gone; provider-owned assets with no remaining references are cleaned up.

## Expected evidence

| Check | Evidence |
|---|---|
| Upload, ordering, cover, deletion | `tests/unit/admin/vehicle-images.test.ts` |
| Cloudinary signing and URLs | `tests/unit/media/cloudinary.test.ts`, `tests/unit/media/urls.test.ts` |
| Progress and retry | `tests/unit/media/client-upload.test.ts` |
| 15-image workflow | the integration test above plus `tests/e2e/admin-vehicle-images.spec.ts` |
| Visual QA | `.visual-qa/reports/f008-admin-image-management-visual-qa.md`, desktop/mobile screenshots |
