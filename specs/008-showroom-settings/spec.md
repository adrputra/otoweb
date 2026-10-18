# Feature Specification: Showroom Settings

**Feature Branch**: `008-showroom-settings`

**Created**: 2026-10-19

**Status**: Ready for planning

**Input**: Roadmap §51 — connect showroom settings administration. Name, tagline,
description, logo, hero image, colors, contact details, address, social links,
opening hours, and SEO fields must be editable and tenant scoped. An admin
updates the showroom and the public website reflects the configuration without a
deployment. This is a key white-label requirement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit the showroom profile (Priority: P1)

A signed-in showroom owner opens **Pengaturan → Profil showroom**, sees the
tenant's current values loaded from the database, edits identity text, brand
colors, contact details, address, opening hours, social links, and SEO fields,
and uploads a logo and hero image. Saving persists the complete configuration
for that tenant and reloading the page shows the saved values.

**Why this priority**: Without a working editor the remaining acceptance items
cannot be demonstrated. It is the entry point for the white-label configuration.

**Independent Test**: Load the settings page for the Prima fixture, change every
editable field, upload a valid logo and hero image through the real media
pipeline with an injected provider, save, reload, and assert every stored value
round-trips for the Prima tenant only.

**Acceptance Scenarios**:

1. **Given** a tenant with stored showroom settings, **When** the owner opens the
   settings page, **Then** the form is populated from the database rather than
   static mock data.
2. **Given** valid edits for name, tagline, description, colors, contact,
   address, social links, opening hours, and SEO fields, **When** the owner
   saves, **Then** the values persist and survive a reload.
3. **Given** a valid JPEG, PNG, or WebP logo or hero image, **When** the owner
   uploads it, **Then** it is stored through the existing media provider and the
   saved settings reference the uploaded URL.
4. **Given** invalid input (for example an invalid email, URL, color, or empty
   display name), **When** the owner saves, **Then** the server rejects the
   change with readable field errors and nothing is written.

---

### User Story 2 - Public website reflects saved configuration (Priority: P2)

An owner saves showroom changes and a visitor opening the public site sees the
new name, tagline, description, logo, hero image, brand colors, contact details,
address, opening hours, social links, and SEO metadata on the next request. No
rebuild, redeploy, or manual database operation is required.

**Why this priority**: This is the roadmap's explicit acceptance loop and the
core white-label promise.

**Independent Test**: Save a distinctive configuration for one fixture, request
the public home, inventory, and detail pages, and assert the rendered output and
generated metadata use the stored values. Repeat for the second fixture and
assert the two sites differ from one deployment.

**Acceptance Scenarios**:

1. **Given** saved settings, **When** a public page is requested, **Then** the
   tenant's name, tagline, description, logo, hero image, contact details,
   address, opening hours, and social links are rendered from the database.
2. **Given** tenant brand colors, **When** the public page renders, **Then** the
   accent surfaces derive from those colors while the existing layout and visual
   language are preserved.
3. **Given** tenant SEO title and description, **When** a public page is
   requested, **Then** the document metadata uses them.
4. **Given** two tenants with different settings, **When** each hostname is
   requested, **Then** each public site reflects only its own configuration.
5. **Given** the owner saves a change while the site is running, **When** the
   next visitor requests the affected pages, **Then** the change is visible
   without a deployment.

---

### User Story 3 - Tenant-scoped settings and permission control (Priority: P3)

Every settings read and write is restricted to the active tenant and requires
the `manage_settings` capability. A staff member cannot change settings, and no
tenant can read or overwrite another tenant's configuration.

**Why this priority**: F005 established tenant isolation and the settings surface
is a new write path; it must not weaken that boundary.

**Independent Test**: As a Tenant B owner, target Prima settings and assert the
write is rejected with zero Prima changes; as a staff member, attempt a settings
write and assert forbidden; call the upload endpoint without a session and
assert unauthorized with zero provider calls.

**Acceptance Scenarios**:

1. **Given** a Prima owner, **When** settings are read or written, **Then** only
   the Prima row is affected.
2. **Given** a Tenant B owner, **When** a Prima settings target is attempted,
   **Then** the operation is rejected and Prima data is unchanged.
3. **Given** a staff membership, **When** a settings write is attempted, **Then**
   it is forbidden.
4. **Given** no authenticated session, **When** the settings upload or save
   endpoint is called, **Then** it is unauthorized and performs no write.

---

### Edge Cases

- Settings row missing for a tenant: the page renders safe defaults and the first
  save creates the tenant's row rather than failing.
- Empty optional values: clearing tagline, logo, social links, or SEO
  description removes the value rather than persisting an empty string in a way
  that breaks rendering.
- Uploaded logo or hero is corrupt, too large, or too small: the server rejects
  it with a readable message and leaves the previous value untouched.
- Hero image URL is empty or unresolvable: the public site falls back to the
  existing placeholder rather than rendering a broken image.
- Primary color is very light: the editor warns that foreground contrast may be
  poor, and the public site keeps readable text.
- The old mock settings data must never overwrite a saved tenant configuration.
- In production, a missing media provider configuration fails clearly instead of
  accepting an upload it cannot store.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let an authorized showroom owner edit and persist
  the tenant's display name, tagline, description, logo, hero image, primary and
  secondary colors, contact details, address, social links, opening hours, and
  SEO title and description.
- **FR-002**: Logo and hero image uploads MUST reuse the existing media provider
  pipeline, content validation, and deterministic asset naming rather than
  introducing a separate storage path.
- **FR-003**: The system MUST validate every settings write on the server with a
  shared schema covering required text, email, URL, color, and length rules, and
  MUST return readable field-level errors.
- **FR-004**: Every settings read and write MUST be scoped to the active tenant,
  MUST require the `manage_settings` capability, and MUST reject cross-tenant
  targets before any SQL or provider call.
- **FR-005**: Saving settings MUST persist one configuration row per tenant and
  create it safely when the tenant has no row yet.
- **FR-006**: The public home, inventory, and vehicle detail surfaces MUST render
  the tenant's stored name, tagline, description, logo, hero image, contact
  details, address, opening hours, and social links.
- **FR-007**: The public site MUST derive its accent colors from the tenant's
  stored colors while preserving the incumbent layout and readable contrast.
- **FR-008**: Public document metadata MUST use the tenant's SEO title and
  description, with safe fallbacks when they are empty.
- **FR-009**: Saved changes MUST be visible on the public site without a rebuild,
  redeploy, or manual database operation; affected paths MUST be revalidated
  after a successful save.
- **FR-010**: The admin shell and page headers MUST display the active tenant's
  showroom name instead of a hard-coded showroom name.
- **FR-011**: The settings editor MUST preserve the incumbent neutral/amber admin
  design language and MUST include a live preview of the tenant configuration.
- **FR-012**: Database credentials, the service-role key, and provider secrets
  MUST never reach the browser.

### Key Entities *(include if data involved)*

- **Showroom Settings**: One tenant-owned configuration row. Key attributes:
  display identity, logo and hero media, primary/secondary colors, contact
  details, address, social links, opening hours, SEO title/description, and
  timestamps.
- **Tenant**: The showroom boundary that owns the settings row and determines
  which hostname and public site receive the configuration.
- **Admin Member**: The authenticated user whose membership role determines
  whether the `manage_settings` capability is granted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the editable fields listed in the roadmap round-trip
  through the admin editor and database for the active tenant.
- **SC-002**: A saved change is visible on the public site on the next request
  with no deployment step in between.
- **SC-003**: Two tenants served from the same deployment display different
  names, colors, contact details, and SEO metadata, with zero cross-tenant
  values.
- **SC-004**: Invalid settings input produces zero database writes and at least
  one readable field error.
- **SC-005**: Unauthorized and under-privileged settings requests succeed zero
  times and perform zero provider calls.
- **SC-006**: Desktop and mobile captures of the admin editor and public site
  pass visual QA with no horizontal overflow and no cross-tenant leakage.

## Assumptions

- The F003 `showroom_settings` table already stores every required field; this
  feature adds no schema column. `favicon_url` remains out of scope because the
  roadmap does not list it as editable.
- "Colors" means the existing primary and secondary brand colors.
- "Contact details" means phone, WhatsApp, and email. "Address" means street,
  city, province, postal code, and Google Maps URL. "Social links" means
  Instagram, TikTok, and Facebook.
- The existing F005 tenant resolution, permission matrix, RLS session, and F008
  media provider are reused unchanged.
- Public pages remain request-rendered; no deployment is needed to observe saved
  settings.
- The incumbent neutral/amber visual language is preserved; only accent values
  and tenant data become configurable.
- The repository has no production media credentials, so the end-to-end upload
  proof uses the deterministic fake provider while Cloudinary signing remains
  covered by the existing F008 tests.
