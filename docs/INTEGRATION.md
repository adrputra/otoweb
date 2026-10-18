# Backend integration checklist

The current app uses in-memory arrays in `data/index.ts` for preview purposes. Replace each item below with a server-side repository call and a database-backed action before production.

## Repository functions

- [ ] `getShowroom()` → `showrooms` table; load the active showroom profile, including `showroom_contacts`, `showroom_address`, `showroom_socials`, and `showroom_seo` (or a JSON column strategy).
- [ ] `listVehicles(filters)` → `vehicles` table; apply availability/publication filters, sorting, and pagination in SQL.
- [ ] `getVehicleBySlug(slug)` → `vehicles` table plus `vehicle_images` and `vehicle_features`.
- [ ] `getRelatedVehicles(vehicleId)` → `vehicles` table; query published units by body type and exclude the current vehicle.
- [ ] `listLeads()` → `leads` table; join `vehicles` for the interested unit and paginate.
- [ ] `listStaff()` → `staff`/`users` table; scope rows to the current showroom.

## Server actions

- [ ] `updateVehicle(id, patch)` → update `vehicles`, and transactionally replace related `vehicle_images`/`vehicle_features` when included.
- [ ] `duplicateVehicle(id)` → insert a draft into `vehicles`, copy `vehicle_images` and `vehicle_features`, and generate a unique slug.
- [ ] `deleteVehicle(id)` → soft-delete/archive in `vehicles`; remove media through the storage lifecycle rather than hard deleting by default.
- [ ] `updateLead(id, status)` → update `leads.status` with an audit event in `lead_events`.
- [ ] `inviteStaff(email, role)` → insert `staff_invitations`, send an invitation email, and create/link a `users` record after acceptance.

## Settings actions to add

- [ ] `updateShowroom(patch)` → update `showrooms` and related settings tables in one transaction; validate with zod and record `updatedBy`.
- [ ] `uploadShowroomAsset(file)` → object storage `showroom_assets` metadata table plus a private/public storage bucket policy.
- [ ] Add authentication and authorization around every admin route/action; scope all records by `showroomId`.
- [ ] Add audit logging for vehicle, lead, staff, and showroom changes.
