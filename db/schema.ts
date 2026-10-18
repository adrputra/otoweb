import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended', 'trial', 'disabled'])

export const tenantDomainType = pgEnum('tenant_domain_type', [
  'platform_subdomain',
  'custom_domain',
])

export const tenantMemberRole = pgEnum('tenant_member_role', ['platform_admin', 'owner', 'staff'])

export const vehicleTransmission = pgEnum('vehicle_transmission', ['AT', 'MT', 'CVT'])

export const vehicleFuelType = pgEnum('vehicle_fuel_type', [
  'bensin',
  'diesel',
  'hybrid',
  'listrik',
])

export const vehicleStatus = pgEnum('vehicle_status', [
  'draft',
  'available',
  'reserved',
  'sold',
  'archived',
])

export const leadSource = pgEnum('lead_source', [
  'contact_form',
  'whatsapp',
  'phone',
  'manual',
])

export const leadStatus = pgEnum('lead_status', [
  'new',
  'contacted',
  'qualified',
  'won',
  'lost',
])

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    status: tenantStatus('status').notNull().default('trial'),
    plan: text('plan').notNull().default('starter'),
    theme: text('theme').notNull().default('premium'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('tenants_status_idx').on(table.status)],
)

export const tenantDomains = pgTable(
  'tenant_domains',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    hostname: text('hostname').notNull().unique(),
    type: tenantDomainType('type').notNull().default('platform_subdomain'),
    status: text('status').notNull().default('active'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verificationStatus: text('verification_status').notNull().default('pending'),
    verificationToken: text('verification_token'),
    sslStatus: text('ssl_status').notNull().default('none'),
    sslProvisionedAt: timestamp('ssl_provisioned_at', { withTimezone: true }),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('tenant_domains_tenant_id_idx').on(table.tenantId)],
)

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tenantMembers = pgTable(
  'tenant_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: tenantMemberRole('role').notNull().default('staff'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('tenant_members_tenant_user_unique').on(table.tenantId, table.userId),
    index('tenant_members_tenant_id_idx').on(table.tenantId),
  ],
)

export const showroomSettings = pgTable(
  'showroom_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    tagline: text('tagline'),
    description: text('description'),
    logoUrl: text('logo_url'),
    faviconUrl: text('favicon_url'),
    heroImageUrl: text('hero_image_url'),
    primaryColor: text('primary_color'),
    secondaryColor: text('secondary_color'),
    phone: text('phone'),
    whatsapp: text('whatsapp'),
    email: text('email'),
    address: text('address'),
    city: text('city'),
    province: text('province'),
    postalCode: text('postal_code'),
    googleMapsUrl: text('google_maps_url'),
    instagramUrl: text('instagram_url'),
    tiktokUrl: text('tiktok_url'),
    facebookUrl: text('facebook_url'),
    openingHours: text('opening_hours'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('showroom_settings_tenant_id_idx').on(table.tenantId)],
)

export const vehicles = pgTable(
  'vehicles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    brand: text('brand').notNull(),
    model: text('model').notNull(),
    variant: text('variant').notNull(),
    year: integer('year').notNull(),
    transmission: vehicleTransmission('transmission').notNull(),
    fuelType: vehicleFuelType('fuel_type').notNull(),
    bodyType: text('body_type').notNull(),
    engineCapacity: integer('engine_capacity').notNull(),
    mileage: integer('mileage').notNull(),
    color: text('color').notNull(),
    price: bigint('price', { mode: 'number' }).notNull(),
    originalPrice: bigint('original_price', { mode: 'number' }),
    plateRegion: text('plate_region').notNull(),
    taxExpiryDate: date('tax_expiry_date').notNull(),
    description: text('description').notNull(),
    status: vehicleStatus('status').notNull().default('draft'),
    featured: boolean('featured').notNull().default(false),
    location: text('location').notNull(),
    features: jsonb('features')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    ownerCount: integer('owner_count'),
    documents: jsonb('documents').$type<{ stnk: boolean; bpkb: boolean }>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    reservedAt: timestamp('reserved_at', { withTimezone: true }),
    soldAt: timestamp('sold_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('vehicles_tenant_slug_unique').on(table.tenantId, table.slug),
    index('vehicles_tenant_id_idx').on(table.tenantId),
    index('vehicles_status_idx').on(table.status),
  ],
)

export const vehicleImages = pgTable(
  'vehicle_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('cloudinary'),
    providerAssetId: text('provider_asset_id'),
    url: text('url').notNull(),
    alt: text('alt').notNull().default(''),
    position: integer('position').notNull().default(0),
    isCover: boolean('is_cover').notNull().default(false),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('vehicle_images_tenant_id_idx').on(table.tenantId),
    index('vehicle_images_vehicle_id_idx').on(table.vehicleId),
  ],
)

export const leads = pgTable(
  'leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    vehicleId: uuid('vehicle_id').references(() => vehicles.id, { onDelete: 'set null' }),
    name: text('name'),
    phone: text('phone'),
    email: text('email'),
    message: text('message'),
    source: leadSource('source').notNull().default('contact_form'),
    status: leadStatus('status').notNull().default('new'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('leads_tenant_id_idx').on(table.tenantId),
    index('leads_status_idx').on(table.status),
    index('leads_vehicle_id_idx').on(table.vehicleId),
  ],
)

export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  domains: many(tenantDomains),
  members: many(tenantMembers),
  settings: one(showroomSettings),
  vehicles: many(vehicles),
  leads: many(leads),
}))

export const tenantDomainsRelations = relations(tenantDomains, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantDomains.tenantId],
    references: [tenants.id],
  }),
}))

export const profilesRelations = relations(profiles, ({ many }) => ({
  memberships: many(tenantMembers),
}))

export const tenantMembersRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMembers.tenantId],
    references: [tenants.id],
  }),
  user: one(profiles, {
    fields: [tenantMembers.userId],
    references: [profiles.id],
  }),
}))

export const showroomSettingsRelations = relations(showroomSettings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [showroomSettings.tenantId],
    references: [tenants.id],
  }),
}))

export const vehiclesRelations = relations(vehicles, ({ many, one }) => ({
  tenant: one(tenants, {
    fields: [vehicles.tenantId],
    references: [tenants.id],
  }),
  images: many(vehicleImages),
  leads: many(leads),
}))

export const vehicleImagesRelations = relations(vehicleImages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vehicleImages.tenantId],
    references: [tenants.id],
  }),
  vehicle: one(vehicles, {
    fields: [vehicleImages.vehicleId],
    references: [vehicles.id],
  }),
}))

export const leadsRelations = relations(leads, ({ one }) => ({
  tenant: one(tenants, {
    fields: [leads.tenantId],
    references: [tenants.id],
  }),
  vehicle: one(vehicles, {
    fields: [leads.vehicleId],
    references: [vehicles.id],
  }),
}))

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type TenantDomain = typeof tenantDomains.$inferSelect
export type NewTenantDomain = typeof tenantDomains.$inferInsert
export type Profile = typeof profiles.$inferSelect
export type NewProfile = typeof profiles.$inferInsert
export type TenantMember = typeof tenantMembers.$inferSelect
export type NewTenantMember = typeof tenantMembers.$inferInsert
export type ShowroomSettings = typeof showroomSettings.$inferSelect
export type NewShowroomSettings = typeof showroomSettings.$inferInsert
export type Vehicle = typeof vehicles.$inferSelect
export type NewVehicle = typeof vehicles.$inferInsert
export type VehicleImage = typeof vehicleImages.$inferSelect
export type NewVehicleImage = typeof vehicleImages.$inferInsert
export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
