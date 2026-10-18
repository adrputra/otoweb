// @vitest-environment node
import { afterAll, beforeAll } from 'vitest'
import { describe, expect, it } from 'vitest'

import { tenants } from '@/db/schema'
import { showroomMetadata } from '@/lib/public/metadata'
import { getShowroomForTenant } from '@/lib/public/queries'
import type { TenantIdentity } from '@/lib/tenant/types'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { prima, tenantB } from '../tenant/fixtures'

const EXTRA_TENANT_ID = '9a000000-0000-4000-8000-000000000002'

let database: TenantTestDatabase

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

const extraIdentity: TenantIdentity = {
  id: EXTRA_TENANT_ID,
  name: 'Showroom Tanpa Pengaturan',
  slug: 'showroom-tanpa-pengaturan-publik',
  status: 'trial',
  plan: 'trial',
}

beforeAll(async () => {
  database = await createTenantTestDatabase()
  await database.asOwner(async (db) => {
    await db
      .insert(tenants)
      .values({
        id: EXTRA_TENANT_ID,
        name: extraIdentity.name,
        slug: extraIdentity.slug,
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

describe('public showroom settings mapping', () => {
  it('maps every editable field for the Prima tenant', async () => {
    const showroom = await getShowroomForTenant(database.db, primaIdentity)

    expect(showroom.name).toBe('Prima Auto Gallery')
    expect(showroom.tagline).toBe('Pilihan mobil berkualitas, tanpa kompromi.')
    expect(showroom.description).toContain('Dealer mobil bekas terpercaya')
    expect(showroom.logoUrl).toBe('')
    expect(showroom.heroImageUrl).toContain('images.unsplash.com')
    expect(showroom.colors).toEqual({ primary: '#b88a44', secondary: '#171717' })
    expect(showroom.contact).toEqual({
      phone: '+62217654321',
      whatsapp: '6281299001122',
      email: 'halo@primaauto.id',
    })
    expect(showroom.address).toEqual({
      street: 'Jl. TB Simatupang No. 18',
      city: 'Jakarta Selatan',
      province: '',
      postalCode: '',
      mapUrl: 'https://maps.google.com/?q=Prima+Auto+Gallery',
      openingHours: 'Senin–Sabtu, 08.00–18.00',
    })
    expect(showroom.social.instagram).toBe('https://instagram.com/primaauto.id')
    expect(showroom.social.tiktok).toBe('https://tiktok.com/@primaauto.id')
    expect(showroom.social.facebook).toBeUndefined()
    expect(showroom.seo.title).toContain('Prima Auto Gallery')
    expect(showroom.seo.description).toContain('mobil bekas berkualitas')
  })

  it('renders different configuration for each tenant', async () => {
    const primaShowroom = await getShowroomForTenant(database.db, primaIdentity)
    const tenantBShowroom = await getShowroomForTenant(database.db, tenantBIdentity)

    expect(tenantBShowroom.name).toBe('Tenant B Test Showroom')
    expect(tenantBShowroom.colors.primary).toBe('#0f766e')
    expect(tenantBShowroom.colors.primary).not.toBe(primaShowroom.colors.primary)
    expect(tenantBShowroom.address.city).toBe('Bandung')
    expect(tenantBShowroom.address.province).toBe('Jawa Barat')
    expect(tenantBShowroom.contact.whatsapp).toBe('6281200000002')
    expect(tenantBShowroom.name).not.toBe(primaShowroom.name)
  })

  it('returns safe defaults when a tenant has no settings row', async () => {
    const showroom = await getShowroomForTenant(database.db, extraIdentity)

    expect(showroom.name).toBe(extraIdentity.name)
    expect(showroom.tagline).toBe('')
    expect(showroom.colors).toEqual({ primary: '#b88a44', secondary: '#171717' })
    expect(showroom.address).toEqual({
      street: '',
      city: '',
      province: '',
      postalCode: '',
      mapUrl: '',
      openingHours: '',
    })
    expect(showroom.seo.title).toBe(extraIdentity.name)
  })
})

describe('tenant SEO metadata', () => {
  it('uses the stored SEO title, description, and logo icon', async () => {
    const showroom = await getShowroomForTenant(database.db, primaIdentity)
    const metadata = showroomMetadata({
      ...showroom,
      logoUrl: 'https://res.cloudinary.com/demo/logo.png',
      seo: { title: 'Judul SEO Prima', description: 'Deskripsi SEO Prima' },
    })

    expect(metadata.title).toBe('Judul SEO Prima')
    expect(metadata.description).toBe('Deskripsi SEO Prima')
    expect(metadata.applicationName).toBe('Prima Auto Gallery')
    expect(metadata.icons).toMatchObject({
      icon: 'https://res.cloudinary.com/demo/logo.png',
    })
  })

  it('falls back to identity when SEO fields are empty', async () => {
    const showroom = await getShowroomForTenant(database.db, primaIdentity)
    const metadata = showroomMetadata({
      ...showroom,
      seo: { title: '   ', description: '' },
    })

    expect(metadata.title).toBe(showroom.name)
    expect(metadata.description).toBe(showroom.description)
    expect(metadata.icons).toBeUndefined()
  })
})
