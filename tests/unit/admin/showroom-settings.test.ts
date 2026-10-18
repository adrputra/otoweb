// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { showroomSettings, tenants } from '@/db/schema'
import {
  getAdminShowroomSettings,
  updateAdminShowroomSettings,
  type SettingsActor,
} from '@/lib/admin/showroom-settings-service'
import { getShowroomForTenant } from '@/lib/public/queries'
import type { TenantIdentity } from '@/lib/tenant/types'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { prima, tenantB } from '../tenant/fixtures'

const EXTRA_TENANT_ID = '9a000000-0000-4000-8000-000000000001'

let database: TenantTestDatabase

const primaActor: SettingsActor = {
  tenantId: prima.tenantId,
  userId: prima.profileId,
  isPlatformAdmin: false,
}

const tenantBActor: SettingsActor = {
  tenantId: tenantB.tenantId,
  userId: tenantB.profileId,
  isPlatformAdmin: false,
}

const primaIdentity: TenantIdentity = {
  id: prima.tenantId,
  name: prima.tenantName,
  slug: prima.tenantSlug,
  status: prima.tenantStatus,
  plan: 'starter',
}

const tenantBIdentity: TenantIdentity = {
  id: tenantB.tenantId,
  name: tenantB.tenantName,
  slug: tenantB.tenantSlug,
  status: tenantB.tenantStatus,
  plan: 'trial',
}

const fullInput = {
  displayName: 'Prima Auto Gallery Baru',
  tagline: 'Tagline baru dari basis data.',
  description: 'Deskripsi showroom yang diperbarui melalui pengaturan.',
  logoUrl: 'https://res.cloudinary.com/demo/image/upload/logo.png',
  heroImageUrl: 'https://res.cloudinary.com/demo/image/upload/hero.jpg',
  primaryColor: '#0f766e',
  secondaryColor: '#0b1220',
  phone: '+62217650000',
  whatsapp: '6281299000000',
  email: 'baru@primaauto.id',
  address: 'Jl. Baru No. 9',
  city: 'Bandung',
  province: 'Jawa Barat',
  postalCode: '40111',
  googleMapsUrl: 'https://maps.google.com/?q=Prima+Baru',
  instagramUrl: '@primabaru',
  tiktokUrl: 'primabaru',
  facebookUrl: 'https://facebook.com/primabaru',
  openingHours: 'Senin–Minggu, 09.00–20.00',
  seoTitle: 'Prima Baru — Mobil Bekas',
  seoDescription: 'Deskripsi SEO baru untuk Prima.',
}

beforeAll(async () => {
  database = await createTenantTestDatabase()
})

beforeEach(async () => {
  await database.asOwner(async (db) => {
    // Restore the deterministic fixtures after a mutating test.
    const { seedDatabase } = await import('@/db/seed-core')
    await seedDatabase(db)
    await db
      .insert(tenants)
      .values({
        id: EXTRA_TENANT_ID,
        name: 'Showroom Tanpa Pengaturan',
        slug: 'showroom-tanpa-pengaturan',
        status: 'trial',
        plan: 'trial',
        theme: 'premium',
      })
      .onConflictDoNothing()
  })
})

afterAll(async () => {
  await database?.close()
})

describe('getAdminShowroomSettings', () => {
  it('returns the stored tenant values in form shape', async () => {
    const snapshot = await getAdminShowroomSettings(database.db, prima.tenantId, prima.tenantName)

    expect(snapshot.exists).toBe(true)
    expect(snapshot.values.displayName).toBe('Prima Auto Gallery')
    expect(snapshot.values.primaryColor).toBe('#b88a44')
    expect(snapshot.values.whatsapp).toBe('6281299001122')
    expect(snapshot.values.instagramUrl).toBe('https://instagram.com/primaauto.id')
    expect(snapshot.updatedAt).not.toBeNull()
  })

  it('returns safe defaults for a tenant without a row', async () => {
    const snapshot = await getAdminShowroomSettings(
      database.db,
      EXTRA_TENANT_ID,
      'Showroom Tanpa Pengaturan',
    )

    expect(snapshot.exists).toBe(false)
    expect(snapshot.updatedAt).toBeNull()
    expect(snapshot.values.displayName).toBe('Showroom Tanpa Pengaturan')
    expect(snapshot.values.primaryColor).toBe('#b88a44')
    expect(snapshot.values.logoUrl).toBe('')
  })
})

describe('updateAdminShowroomSettings', () => {
  it('round-trips every editable field and maps it to the public view', async () => {
    const result = await updateAdminShowroomSettings(database.db, primaActor, fullInput)

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.values).toMatchObject({
      ...fullInput,
      instagramUrl: 'https://instagram.com/primabaru',
      tiktokUrl: 'https://tiktok.com/@primabaru',
      facebookUrl: 'https://facebook.com/primabaru',
    })

    const rows = await database.asOwner((db) =>
      db
        .select()
        .from(showroomSettings)
        .where(eq(showroomSettings.tenantId, prima.tenantId)),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      displayName: fullInput.displayName,
      tagline: fullInput.tagline,
      logoUrl: fullInput.logoUrl,
      heroImageUrl: fullInput.heroImageUrl,
      primaryColor: fullInput.primaryColor,
      secondaryColor: fullInput.secondaryColor,
      province: fullInput.province,
      postalCode: fullInput.postalCode,
      openingHours: fullInput.openingHours,
      seoTitle: fullInput.seoTitle,
      seoDescription: fullInput.seoDescription,
      instagramUrl: 'https://instagram.com/primabaru',
    })

    const publicShowroom = await getShowroomForTenant(database.db, primaIdentity)
    expect(publicShowroom).toMatchObject({
      name: fullInput.displayName,
      tagline: fullInput.tagline,
      description: fullInput.description,
      logoUrl: fullInput.logoUrl,
      colors: { primary: fullInput.primaryColor, secondary: fullInput.secondaryColor },
      contact: {
        phone: fullInput.phone,
        whatsapp: fullInput.whatsapp,
        email: fullInput.email,
      },
      address: {
        street: fullInput.address,
        city: fullInput.city,
        province: fullInput.province,
        postalCode: fullInput.postalCode,
        mapUrl: fullInput.googleMapsUrl,
        openingHours: fullInput.openingHours,
      },
      social: {
        instagram: 'https://instagram.com/primabaru',
        tiktok: 'https://tiktok.com/@primabaru',
        facebook: 'https://facebook.com/primabaru',
      },
      seo: { title: fullInput.seoTitle, description: fullInput.seoDescription },
    })
  })

  it('persists empty optional values as null, not empty strings', async () => {
    const result = await updateAdminShowroomSettings(database.db, primaActor, {
      ...fullInput,
      tagline: '',
      logoUrl: '',
      phone: '',
      city: '',
      instagramUrl: '',
      seoTitle: '',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const rows = await database.asOwner((db) =>
      db
        .select()
        .from(showroomSettings)
        .where(eq(showroomSettings.tenantId, prima.tenantId)),
    )
    expect(rows[0]?.tagline).toBeNull()
    expect(rows[0]?.logoUrl).toBeNull()
    expect(rows[0]?.phone).toBeNull()
    expect(rows[0]?.city).toBeNull()
    expect(rows[0]?.instagramUrl).toBeNull()
    expect(rows[0]?.seoTitle).toBeNull()
    expect(result.data.values.tagline).toBe('')
    expect(result.data.values.instagramUrl).toBe('')
  })

  it('creates a settings row for a tenant that has none', async () => {
    const result = await updateAdminShowroomSettings(
      database.db,
      { tenantId: EXTRA_TENANT_ID, userId: prima.profileId, isPlatformAdmin: false },
      { ...fullInput, displayName: 'Showroom Tanpa Pengaturan Baru' },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.exists).toBe(true)

    const snapshot = await getAdminShowroomSettings(
      database.db,
      EXTRA_TENANT_ID,
      'Showroom Tanpa Pengaturan',
    )
    expect(snapshot.exists).toBe(true)
    expect(snapshot.values.displayName).toBe('Showroom Tanpa Pengaturan Baru')
  })

  it('rejects invalid input without writing', async () => {
    const before = await database.asOwner((db) =>
      db
        .select()
        .from(showroomSettings)
        .where(eq(showroomSettings.tenantId, prima.tenantId)),
    )

    const result = await updateAdminShowroomSettings(database.db, primaActor, {
      ...fullInput,
      displayName: '',
      primaryColor: 'amber',
      email: 'not-an-email',
      instagramUrl: 'has spaces and no handle',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid')
    expect(result.fieldErrors).toMatchObject({
      displayName: expect.any(Array),
      primaryColor: expect.any(Array),
      email: expect.any(Array),
      instagramUrl: expect.any(Array),
    })

    const after = await database.asOwner((db) =>
      db
        .select()
        .from(showroomSettings)
        .where(eq(showroomSettings.tenantId, prima.tenantId)),
    )
    expect(after).toEqual(before)
  })

  it('writes only the actor tenant and leaves the other tenant untouched', async () => {
    const primaBefore = await database.asOwner((db) =>
      db
        .select()
        .from(showroomSettings)
        .where(eq(showroomSettings.tenantId, prima.tenantId)),
    )

    const result = await updateAdminShowroomSettings(database.db, tenantBActor, {
      ...fullInput,
      displayName: 'Tenant B Baru',
    })
    expect(result.ok).toBe(true)

    const primaAfter = await database.asOwner((db) =>
      db
        .select()
        .from(showroomSettings)
        .where(eq(showroomSettings.tenantId, prima.tenantId)),
    )
    expect(primaAfter).toEqual(primaBefore)

    const tenantBPublic = await getShowroomForTenant(database.db, tenantBIdentity)
    expect(tenantBPublic.name).toBe('Tenant B Baru')
    expect(tenantBPublic.contact.whatsapp).toBe(fullInput.whatsapp)
  })
})
