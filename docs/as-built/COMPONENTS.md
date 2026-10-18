# Components

- `AdminShell` — responsive admin chrome with desktop sidebar and mobile navigation.
- `VehicleForm` — shared create/edit form with photo manager, dependent catalog selects, validation, publication controls, unsaved-change warning, and live preview.
- `ShowroomSettingsForm` — showroom profile fields, color contrast warning, SEO preview, live hero/card preview, and dirty-state handling.
- Public showroom and vehicle components reuse the shared vehicle, showroom, formatting, and status types.

The current UI uses in-memory data from `data/index.ts`; persistence boundaries are documented in `docs/INTEGRATION.md`.
