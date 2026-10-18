# Data contract

Core types live in `lib/types.ts`; preview records live in `data/index.ts`.

- `Vehicle` — inventory identity, brand/model/variant, pricing, availability, publication, features, photos, and SEO slug.
- `VehiclePhoto` — image URL, alt text, ordering, and cover state.
- `Lead` — contact details, interested vehicle, status, source, and timestamps.
- `StaffMember` — name, email, role, avatar, and invitation/status state.
- `Showroom` — identity, contact channels, address, social links, brand colors, hero asset, and SEO fields.

Repository reads are in `lib/repositories.ts`; mutations are represented by the stubs in `lib/actions.ts`. Keep server persistence aligned with `docs/INTEGRATION.md`.
