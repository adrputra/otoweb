# Requirements Checklist: Admin Vehicle CRUD

**Feature**: `006-admin-vehicle-crud` | **Date**: 2026-10-19

## Requirements quality

- [x] Every roadmap operation (create, edit, publish, reserve, sell, archive,
      duplicate, delete) maps to a functional requirement.
- [x] The end-to-end acceptance path (create → stored → publish → public) is a
      numbered user story with an independent test.
- [x] Server-side validation and shared Zod schemas are explicit requirements.
- [x] Tenant scoping and `manage_vehicles` authorization are explicit.
- [x] Public visibility rules reference the F006 status mapping.
- [x] Image upload is explicitly out of scope for F008.
- [x] The visual design constraint (preserve neutral/amber, no redesign) is
      recorded.
- [x] No unresolved clarifications or placeholders remain.
- [x] Success criteria are measurable and include the repository gates.
- [x] Dependencies (F003 schema, F004 auth, F005 tenancy, F006 public data) are
      recorded in the assumptions.

## Scope guards

- [x] No migration is introduced.
- [x] No new public route is introduced.
- [x] No lead, staff, settings, or image-management behaviour is changed.
- [x] `data/index.ts` remains the seed/test fixture only.
- [x] The service role never reaches the browser.
