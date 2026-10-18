# OtoWeb — Production SDD & Implementation Roadmap

Status: Active  
Starting point: v0-generated frontend complete  
Primary implementation agent: DeepSeek  
Deployment target: Vercel  
Application type: Multi-tenant used-car showroom platform

---

# 1. Product Mission

OtoWeb is a reusable white-label website and inventory management platform for used-car showrooms.

One platform must support multiple independent showrooms.

Each showroom receives:

- Public showroom website
- Searchable vehicle inventory
- Vehicle detail pages
- WhatsApp inquiry flow
- Administrative dashboard
- Vehicle inventory management
- Showroom configuration
- Branding configuration
- Staff access
- SEO-ready public pages
- Dedicated subdomain
- Future custom domain support

The initial Prima Auto Gallery implementation is the reference tenant, not a hard-coded product.

The system must evolve from:

```text
current frontend prototype
        ↓
production application
        ↓
first real showroom
        ↓
multi-showroom SaaS
```

---

# 2. Current Project State

The existing project was generated and visually developed using v0.

It MUST be treated as an existing frontend implementation.

Current stack:

```text
Next.js 16
React 19
TypeScript
Tailwind CSS 4
shadcn
Base UI
React Hook Form
Zod
dnd-kit
Sonner
Vercel Analytics
```

Existing project areas include:

```text
app/
components/
data/
docs/
lib/
public/
```

The public website already includes at least:

```text
Homepage
Vehicle inventory
Vehicle cards
Vehicle status
Vehicle pricing
Vehicle filtering UI
Showroom information
Location CTA
WhatsApp CTA
```

Mock/sample showroom data currently powers the frontend.

The existing frontend must NOT be discarded.

---

# 3. Current Stage Assessment

Project stage:

```text
PHASE A — Product/UI Prototype
STATUS: substantially complete
```

Production backend stage:

```text
PHASE B — Application Foundation
STATUS: not started
```

Therefore DeepSeek starts with:

```text
Production Foundation
```

NOT:

```text
UI generation
product ideation
frontend redesign
```

---

# 4. Core Architecture Decision

Use one full-stack Next.js application.

Do NOT introduce a separate Go/Node backend during MVP.

Architecture:

```text
Browser
   ↓
Next.js
   ├── Public showroom
   ├── Admin portal
   ├── Server Components
   ├── Server Actions / Route Handlers
   └── Tenant resolution
          ↓
      PostgreSQL
```

Backend platform:

```text
Supabase
```

Database:

```text
PostgreSQL
```

Database access:

```text
Drizzle ORM
```

Authentication:

```text
Supabase Auth
```

Authorization:

```text
Application permissions
+
PostgreSQL Row Level Security
```

Media:

```text
Cloudinary
```

Deployment:

```text
Vercel
```

---

# 5. Architectural Principles

OtoWeb MUST remain:

```text
one repository
one Next.js application
one production database
one deployment
many tenants
```

Do not create:

```text
one repository per showroom
one deployment per showroom
showroom-specific branches
showroom-specific components
hard-coded customer logic
```

Differences between customers must come from configuration.

Example:

```text
Tenant
├── branding
├── content
├── theme
├── domain
├── users
└── inventory
```

---

# 6. Multi-Tenant Model

The platform must be multi-tenant before real customer data is introduced.

Every showroom is a tenant.

Example:

```text
prima.otoweb.id
rajamobil.otoweb.id
autolux.otoweb.id
```

Eventually:

```text
primaauto.co.id
rajamobil.com
```

must map to the same underlying application.

---

# 7. Tenant Resolution

Request:

```text
prima.otoweb.id/cars
```

must resolve:

```text
hostname
   ↓
tenant domain
   ↓
tenant
   ↓
showroom configuration
   ↓
inventory
   ↓
theme
```

Tenant resolution logic MUST exist in one centralized module.

Suggested:

```text
lib/tenant/
  resolve-tenant.ts
  tenant-context.ts
  tenant-domain.ts
```

Do NOT scatter hostname parsing throughout the application.

---

# 8. Database Foundation

Use UUID identifiers.

Primary tables:

```text
tenants
tenant_domains
profiles
tenant_members
showroom_settings
vehicles
vehicle_images
leads
```

Every tenant-owned table MUST contain:

```text
tenant_id
```

where applicable.

---

# 9. Tenants

## tenants

Required fields:

```text
id
name
slug
status
plan
theme
created_at
updated_at
```

Possible status:

```text
active
suspended
trial
disabled
```

---

# 10. Tenant Domains

## tenant_domains

```text
id
tenant_id
hostname
type
status
verified_at
created_at
```

Type:

```text
platform_subdomain
custom_domain
```

Example:

```text
prima.otoweb.id
```

or:

```text
primaauto.co.id
```

---

# 11. Users and Membership

Authentication users come from Supabase Auth.

Application user data:

## profiles

```text
id
full_name
avatar_url
created_at
updated_at
```

Membership:

## tenant_members

```text
id
tenant_id
user_id
role
status
created_at
updated_at
```

Unique:

```text
tenant_id + user_id
```

Initial roles:

```text
platform_admin
owner
staff
```

---

# 12. Authorization Rules

Platform Admin:

```text
manage tenants
inspect tenant status
assign owners
manage platform configuration
```

Owner:

```text
manage vehicles
manage showroom
manage staff
manage leads
manage settings
```

Staff:

```text
manage vehicles
view leads
```

Authorization MUST be enforced server-side.

Hiding a button is not authorization.

---

# 13. Database Security

PostgreSQL Row Level Security MUST protect tenant data.

Example conceptual rule:

```text
authenticated user
may access vehicle
ONLY IF
user belongs to vehicle.tenant_id
```

RLS must cover:

```text
vehicles
vehicle_images
leads
showroom_settings
tenant_members
```

Platform administration may use explicit privileged server-side operations.

Never expose Supabase service-role credentials to the browser.

---

# 14. Vehicle Model

Create a production-ready `vehicles` schema.

Fields:

```text
id
tenant_id

slug

brand
model
variant

year

transmission
fuel_type
body_type

engine_capacity
mileage
color

price
original_price

plate_region
tax_expiry_date

description

status
featured

location

created_at
updated_at
published_at
reserved_at
sold_at
```

Status:

```text
draft
available
reserved
sold
archived
```

Do not use text labels inconsistently throughout the code.

Use shared domain enums/constants.

---

# 15. Vehicle Features

During MVP use:

```text
features JSONB
```

Example:

```json
[
  "ABS",
  "Airbags",
  "Reverse Camera",
  "Leather Seats",
  "Keyless Entry"
]
```

Avoid building highly normalized feature tables until actual requirements justify them.

---

# 16. Vehicle Images

## vehicle_images

```text
id
tenant_id
vehicle_id

provider
provider_asset_id
url

position
is_cover

width
height

created_at
```

Provider initially:

```text
cloudinary
```

Vehicle listing pages must use optimized image sizes rather than full-resolution originals.

---

# 17. Showroom Settings

Current frontend showroom information must migrate from mock configuration to database configuration.

## showroom_settings

```text
id
tenant_id

display_name
tagline
description

logo_url
favicon_url
hero_image_url

primary_color
secondary_color

phone
whatsapp
email

address
city
province
postal_code

google_maps_url

instagram_url
tiktok_url
facebook_url

opening_hours

seo_title
seo_description

created_at
updated_at
```

---

# 18. Branding Architecture

Do NOT build a page builder.

The platform should provide controlled customization.

Allowed:

```text
logo
colors
hero image
showroom name
tagline
description
contact info
social links
opening hours
SEO fields
theme
```

Do NOT initially support:

```text
custom HTML
custom JavaScript
arbitrary CSS
drag-and-drop page building
```

This keeps deployments safe and upgrades manageable.

---

# 19. Theme Architecture

The current v0 public design becomes:

```text
Theme: premium
```

Eventually:

```text
themes/
  premium/
  modern/
  minimal/
```

All themes consume the same normalized data.

Example conceptually:

```text
ShowroomTheme
  showroom
  vehicles
  branding
```

Never fork business logic per theme.

---

# 20. Admin Requirements

The frontend admin implementation should be preserved wherever practical.

Admin route:

```text
/admin
```

Required sections:

```text
Dashboard
Vehicles
Leads
Showroom
Staff
Settings
```

Authenticated users must only access tenants in which they have membership.

---

# 21. Vehicle Management

Required operations:

```text
Create
Edit
Publish
Unpublish
Duplicate
Reserve
Mark sold
Archive
Delete
Preview
```

Dangerous operations must use confirmation.

Delete behavior should be carefully considered.

Prefer archive/soft removal when business records need preservation.

---

# 22. Vehicle Creation UX

Vehicle listing creation is one of the most important product workflows.

Target:

```text
experienced operator
→ complete listing
→ under 3 minutes
```

Form fields should use React Hook Form + Zod.

Required sections:

```text
Basic information
Pricing
Specifications
Description
Features
Photos
Publishing
```

Autosave draft can be added later.

Do not block MVP on autosave.

---

# 23. Media Upload

Integrate Cloudinary.

Required:

```text
multiple file upload
upload progress
drag/drop
image preview
reordering
cover image
delete image
retry failures
responsive delivery
```

Use dnd-kit already present in the project for ordering where appropriate.

Maximum image restrictions must be configurable.

Initial recommendation:

```text
20 images / vehicle
```

Validate:

```text
file type
file size
number of files
```

Never trust browser validation alone.

---

# 24. Public Inventory

Existing `/cars` UI should become database-driven.

Filtering:

```text
brand
model
year
price range
transmission
fuel
status
```

Sorting:

```text
newest
price ascending
price descending
year newest
mileage lowest
```

Public inventory MUST only expose:

```text
available
reserved
```

unless explicitly configured to display sold units.

Draft and archived vehicles must never appear publicly.

---

# 25. URL Query State

Filters must be represented in URL search parameters.

Example:

```text
/cars?brand=Toyota&transmission=AT&maxPrice=500000000
```

Benefits:

```text
shareable
back-button friendly
SEO-compatible
server-renderable
```

Avoid client-only hidden filter state.

---

# 26. Vehicle Detail Page

Route:

```text
/cars/[slug]
```

Display:

```text
gallery
title
price
status
year
mileage
transmission
fuel
engine
color
tax information
description
features
location
showroom
related vehicles
```

Primary action:

```text
WhatsApp inquiry
```

---

# 27. WhatsApp Lead Flow

Generated message example:

```text
Halo Prima Auto, saya tertarik dengan Toyota Fortuner VRZ 2021 yang saya lihat di website.

Apakah unit ini masih tersedia?

{vehicle URL}
```

Track the click before redirecting when feasible.

Do NOT integrate WhatsApp Business API during MVP.

A normal wa.me flow is sufficient.

---

# 28. Lead Model

Create:

## leads

```text
id
tenant_id
vehicle_id

name
phone
email
message

source
status

created_at
updated_at
```

Status:

```text
new
contacted
qualified
won
lost
```

Source:

```text
contact_form
whatsapp
phone
manual
```

Do not turn the lead system into a full CRM during MVP.

---

# 29. SEO Requirements

Public showroom websites must be SEO-first.

Implement:

```text
dynamic metadata
canonical URL
OpenGraph
robots.txt
sitemap.xml
structured data
```

Vehicle page titles should follow a pattern similar to:

```text
Toyota Fortuner VRZ 2021 Bekas Jakarta | Prima Auto
```

Structured data should use appropriate Schema.org entities such as:

```text
Vehicle
Product
Offer
LocalBusiness
```

---

# 30. Sold Vehicle SEO Strategy

Do NOT automatically delete sold pages.

Preferred behavior:

```text
vehicle sold
↓
page remains accessible
↓
status displays "Terjual"
↓
related available vehicles shown
```

This preserves acquired URLs and search value.

Later, old sold listings may be archived according to SEO policy.

---

# 31. Testing Foundation

The current project must gain an automated testing stack.

Install:

```text
Vitest
Testing Library
Playwright
```

Required package scripts:

```text
dev
build
start
lint
typecheck
test
test:e2e
```

DeepSeek must ensure these commands work consistently.

---

# 32. Continuous Integration

Add GitHub Actions.

Every pull request should execute:

```text
install
lint
typecheck
unit tests
build
```

Critical E2E tests may run either on CI preview environments or controlled test environments.

Do not merge changes when required checks fail.

---

# 33. Required E2E Scenarios

Minimum:

```text
Public visitor
→ opens homepage
→ browses cars
→ filters inventory
→ opens vehicle
→ clicks WhatsApp
```

Admin:

```text
login
→ dashboard
→ create vehicle
→ upload images
→ publish
→ public listing appears
```

Inventory lifecycle:

```text
available
→ reserved
→ sold
```

---

# 34. Mandatory Tenant Isolation Tests

Create two fixtures:

```text
Tenant A
Tenant B
```

Verify:

```text
A cannot read B vehicles
A cannot update B vehicles
A cannot delete B vehicles
A cannot read B leads
A cannot update B settings
A cannot access B images
A cannot manage B staff
```

These tests are mandatory.

Tenant security must not depend solely on frontend routing.

---

# 35. Error Handling

Every major interaction must have:

```text
loading state
empty state
success state
validation error
server error
permission error
```

Do not leave unhandled Promise rejection paths.

Use meaningful server logging.

Do not leak sensitive stack traces to users.

---

# 36. Observability

Initial production monitoring should include:

```text
Vercel logs
Vercel Analytics
application error reporting
```

Sentry may be added if required.

Avoid building custom monitoring infrastructure.

---

# 37. Performance

Public pages should prioritize performance.

Targets:

```text
Lighthouse Performance >= 90
Accessibility >= 90
Best Practices >= 90
SEO >= 95
```

Focus particularly on:

```text
image optimization
font loading
JavaScript bundle size
mobile performance
server rendering
```

Vehicle listing cards must not download original image files.

---

# 38. Current Frontend Preservation Rule

DeepSeek MUST NOT redesign the existing frontend unless:

```text
a bug exists
an architecture issue requires change
responsive behavior is broken
accessibility is broken
the requested feature requires modification
```

Current v0 styling should be considered an approved design baseline.

Refactoring is allowed.

Visual redesign is not.

---

# 39. Component Cleanup

Before backend integration, audit v0-generated components.

Look for:

```text
duplicated vehicle cards
duplicated formatting utilities
hard-coded showroom strings
hard-coded vehicle arrays
duplicated status logic
inline business logic
unnecessary client components
```

Refactor toward shared primitives.

Examples:

```text
VehicleCard
VehicleStatusBadge
VehiclePrice
VehicleGallery
VehicleFilters
WhatsAppCTA
ShowroomHeader
ShowroomFooter
```

Do not refactor merely for stylistic preference.

Only consolidate when it improves maintainability.

---

# 40. Server vs Client Components

Prefer Server Components by default.

Use Client Components only where needed, including:

```text
forms
drag-and-drop
interactive filters
dialogs
image upload
client-only UI state
```

Do not place entire public pages behind `"use client"` unnecessarily.

---

# 41. Data Access Architecture

Do not query the database directly from random UI components.

Recommended separation:

```text
db/
  schema/
  migrations/
  queries/

lib/
  auth/
  tenant/
  permissions/
  validation/
  media/

features/
  vehicles/
  showroom/
  leads/
```

Exact folder names may vary based on existing structure.

The important requirement is separation of:

```text
presentation
domain logic
data access
authorization
```

---

# 42. DeepSeek Execution Strategy

Each implementation phase must follow:

```text
READ
↓
AUDIT
↓
PLAN
↓
IMPLEMENT
↓
TEST
↓
VISUAL QA
↓
REPORT
↓
STOP
```

DeepSeek must NEVER automatically continue into the next phase.

One phase equals one explicit task.

---

# 43. PHASE 1 — Repository Production Audit

Goal:

Understand the v0 repository before changing architecture.

Tasks:

```text
inspect all routes
inspect components
inspect mock data
inspect forms
inspect utilities
inspect package configuration
inspect responsive implementation
inspect docs
```

Identify:

```text
mock-only functionality
dead UI
hard-coded values
duplicated components
client/server boundaries
missing pages
broken routes
technical debt
```

Create:

```text
docs/CURRENT_STATE.md
docs/ARCHITECTURE.md
docs/IMPLEMENTATION_STATUS.md
```

Do not implement database functionality yet.

Acceptance:

```text
[ ] all existing routes documented
[ ] reusable components identified
[ ] mock data locations documented
[ ] technical debt documented
[ ] production migration plan documented
[ ] no visual redesign
[ ] application still builds
```

---

# 44. PHASE 2 — Engineering Foundation

Goal:

Turn the v0 repository into a reliable engineering project.

Implement:

```text
ESLint
formatting
typecheck command
Vitest
Testing Library
Playwright
GitHub Actions
environment validation
```

Add:

```text
.env.example
```

Never include real credentials.

Acceptance:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

must succeed.

At least one Playwright smoke test must exist.

No backend integration yet.

---

# 45. PHASE 3 — Database Foundation

Install and configure:

```text
Supabase
Drizzle ORM
PostgreSQL migrations
```

Implement tables:

```text
tenants
tenant_domains
profiles
tenant_members
showroom_settings
vehicles
vehicle_images
```

Add development seeds.

Seed:

```text
Prima Auto Gallery
Tenant B Test Showroom
```

Migrate existing mock vehicle data into seed data.

Important:

The UI should continue looking the same.

Acceptance:

```text
[ ] schema migration works from empty database
[ ] seed works
[ ] existing vehicle mock data exists in DB
[ ] schema documented
[ ] build passes
```

---

# 46. PHASE 4 — Authentication

Implement Supabase Auth.

Required:

```text
login
logout
password reset
authenticated admin routes
session handling
```

Do not implement public registration.

Showroom accounts should initially be created/invited by platform operators.

Acceptance:

```text
[ ] unauthenticated admin access blocked
[ ] authenticated owner can access admin
[ ] logout works
[ ] expired sessions handled
```

---

# 47. PHASE 5 — Multi-Tenant Security

This is the most security-sensitive phase.

Implement:

```text
tenant memberships
tenant context
hostname resolver
tenant-scoped queries
RLS
permission helpers
tenant isolation tests
```

Fixtures:

```text
prima
tenant-b
```

Attempt cross-tenant attacks.

Acceptance:

```text
[ ] all cross-tenant tests fail safely
[ ] tenant B data cannot appear for tenant A
[ ] direct DB/API attempts are protected
[ ] service role never reaches browser
```

DO NOT proceed if tenant isolation tests fail.

---

# 48. PHASE 6 — Connect Public Website to Database

Replace:

```text
data/mock-vehicles
```

with database queries.

Convert:

```text
homepage featured units
inventory page
vehicle detail
related vehicles
showroom data
```

to real tenant-scoped data.

Preserve existing visual design.

Acceptance:

```text
[ ] no public vehicle data comes from hard-coded mock arrays
[ ] featured vehicles are DB-driven
[ ] filtering works
[ ] sorting works
[ ] vehicle detail works
[ ] tenant showroom settings render
```

---

# 49. PHASE 7 — Admin Vehicle CRUD

Connect existing admin vehicle UI to database.

Implement:

```text
create
edit
publish
reserve
sell
archive
duplicate
delete
```

Use server-side validation.

Use Zod schemas shared where reasonable between server and client.

Acceptance:

```text
admin creates vehicle
↓
vehicle stored
↓
admin publishes
↓
vehicle visible publicly
```

No manual DB operations required.

---

# 50. PHASE 8 — Image Management

Integrate Cloudinary.

Implement:

```text
upload
multiple upload
progress
reordering
cover selection
deletion
validation
optimization
```

Test approximately:

```text
15 high-resolution images
```

in one vehicle workflow.

Acceptance:

```text
[ ] upload reliable
[ ] image ordering persists
[ ] cover persists
[ ] thumbnails optimized
[ ] deleting vehicle handles media policy correctly
```

---

# 51. PHASE 9 — Showroom Settings

Connect showroom settings administration.

Editable:

```text
name
tagline
description
logo
hero image
colors
contact details
address
social links
opening hours
SEO fields
```

All changes must be tenant scoped.

Acceptance:

```text
admin updates showroom
↓
public website reflects configuration
```

without deployment.

This is a key white-label requirement.

---

# 52. PHASE 10 — Lead Capture

Implement:

```text
lead table
contact form
WhatsApp tracking
lead dashboard
lead status updates
```

Do NOT create advanced CRM features.

Acceptance:

```text
customer inquiry
↓
tenant lead
↓
admin dashboard
```

---

# 53. PHASE 11 — SEO Productionization

Implement:

```text
dynamic metadata
OpenGraph
canonical
sitemap
robots
structured data
sold listing handling
```

Sitemaps must be tenant-specific.

Acceptance:

Verify generated HTML, not just browser-rendered metadata.

---

# 54. PHASE 12 — Platform Administration

Create separate platform administration surface.

Suggested:

```text
/platform
```

Capabilities:

```text
create tenant
disable tenant
assign owner
inspect tenant
set subdomain
set plan/status
```

Do not expose this interface to normal showroom owners.

---

# 55. PHASE 13 — Subdomain Routing

Production host example:

```text
prima.otoweb.id
```

Implement wildcard tenant routing.

Development must support easy tenant testing.

Possible development mechanism:

```text
prima.localhost
tenant-b.localhost
```

or an equivalent documented strategy.

Acceptance:

Two hostnames display different:

```text
showroom branding
inventory
contact details
```

from one deployment.

---

# 56. PHASE 14 — Custom Domains

Only after wildcard subdomains are stable.

Implement:

```text
domain registration
verification state
DNS instructions
domain routing
SSL provisioning integration
```

Keep platform subdomain available as fallback.

---

# 57. PHASE 15 — Analytics

Track:

```text
vehicle_view
inventory_search
filter_use
whatsapp_click
contact_submit
vehicle_share
```

Possible dashboard metrics:

```text
vehicle views
most viewed vehicles
WhatsApp clicks
new leads
conversion percentage
```

Do not block MVP launch on analytics.

---

# 58. PHASE 16 — Production Hardening

Perform:

```text
security audit
RLS audit
authorization audit
dependency audit
mobile QA
desktop QA
SEO audit
accessibility audit
performance audit
failure-state testing
```

Test with two or more realistic showrooms.

---

# 59. First Commercial MVP Boundary

The first showroom can go live when these are complete:

```text
Phase 1
Phase 2
Phase 3
Phase 4
Phase 5
Phase 6
Phase 7
Phase 8
Phase 9
Phase 11
Phase 13
```

Lead management can be added during or immediately after the pilot.

---

# 60. Features Explicitly Deferred

Do NOT implement during initial MVP:

```text
subscription billing
online vehicle purchasing
payment gateway
financing provider APIs
WhatsApp Business API
AI chatbot
native apps
marketplace aggregation
dealer accounting
complex CRM
custom page builder
custom tenant JavaScript
arbitrary themes
dealer-to-dealer trading
```

These require actual customer demand.

---

# 61. Future AI Features

After core product validation:

```text
AI vehicle descriptions
AI social captions
AI listing quality checks
AI photo cleanup
AI plate blurring
AI social media creatives
```

Potential workflow:

```text
Dealer creates vehicle
        ↓
Inventory page automatically created
        ↓
AI description generated
        ↓
Instagram caption generated
        ↓
TikTok caption generated
        ↓
WhatsApp promotional copy generated
```

This should be considered a V2/V3 differentiator.

---

# 62. First Pilot Success Criteria

Before building advanced SaaS features, onboard one real showroom.

Give showroom staff normal credentials.

Without developer assistance they must successfully:

```text
login
↓
create vehicle
↓
upload photos
↓
enter price/specifications
↓
publish vehicle
↓
view public listing
↓
share listing
↓
mark listing reserved
↓
mark listing sold
```

Observe the workflow.

Any confusing step should be treated as product feedback.

---

# 63. Definition of Done

A task is not complete because DeepSeek generated code.

Relevant checklist:

```text
[ ] requested acceptance criteria satisfied
[ ] no unrelated visual redesign
[ ] TypeScript passes
[ ] lint passes
[ ] tests pass
[ ] build passes
[ ] tenant scope reviewed
[ ] validation implemented
[ ] loading state implemented
[ ] error state implemented
[ ] empty state implemented
[ ] mobile checked
[ ] desktop checked
[ ] no browser console errors
[ ] security-sensitive behavior tested
[ ] documentation updated
```

---

# 64. Mandatory DeepSeek Rules

DeepSeek MUST:

1. Read this document before every major phase.
2. Inspect current code before proposing changes.
3. Preserve approved v0 design.
4. Never rewrite the application wholesale.
5. Never remove working functionality without justification.
6. Never bypass tenant isolation.
7. Never expose secrets.
8. Never execute tenant-sensitive queries without scope.
9. Use migrations for database schema changes.
10. Add tests for new business behavior.
11. Run lint/typecheck/test/build after implementation.
12. Perform visual QA when changing UI.
13. Keep mobile usability as a first-class requirement.
14. Update documentation when architecture changes.
15. Stop after completing the requested phase.

---

# 65. Agent Output Required After Every Phase

DeepSeek's final report must contain:

```text
PHASE:
STATUS:

IMPLEMENTED:
- ...

FILES CHANGED:
- ...

MIGRATIONS:
- ...

TESTS ADDED:
- ...

VALIDATION:
- lint:
- typecheck:
- unit:
- e2e:
- build:

VISUAL QA:
- mobile:
- desktop:

SECURITY REVIEW:
- ...

KNOWN ISSUES:
- ...

NEXT RECOMMENDED PHASE:
- ...
```

Do not silently proceed to the next phase.

---

# 66. Immediate Next Task

The next task is:

```text
PHASE 1 — Repository Production Audit
```

No database should be introduced until the agent understands the existing v0 implementation.

The frontend is considered existing product work rather than disposable generated code.

Preserve what works.

Document what does not.

Then productionize incrementally.