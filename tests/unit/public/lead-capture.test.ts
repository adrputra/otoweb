// @vitest-environment node
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { leads, vehicles } from '@/db/schema'
import { vehicles as mockVehicles } from '@/data'
import { createContactLead, createWhatsappLead } from '@/lib/public/lead-service'
import { TenantScopeError } from '@/lib/tenant/scoped-queries'

import {
  createTenantTestDatabase,
  type TenantTestDatabase,
} from '../tenant/database'
import { prima, tenantB, tenantBVehicle } from '../tenant/fixtures'

let harness: TenantTestDatabase

beforeEach(async () => {
  harness = await createTenantTestDatabase()
  await harness.db.insert(vehicles).values(tenantBVehicle)
}, 30_000)

afterEach(async () => {
  await harness.close()
})

async function rowsFor(tenantId: string) {
  return harness.db.select().from(leads).where(eq(leads.tenantId, tenantId))
}

describe('public contact lead creation', () => {
  it('stores a new contact_form lead for the resolved tenant', async () => {
    const result = await createContactLead(harness.db, prima.tenantId, {
      name: 'Rizky Pratama',
      phone: '0812 9900 1122',
      email: 'rizky@example.com',
      message: 'Apakah Fortuner masih tersedia?',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data).toMatchObject({
      name: 'Rizky Pratama',
      phone: '0812 9900 1122',
      email: 'rizky@example.com',
      message: 'Apakah Fortuner masih tersedia?',
      source: 'contact_form',
      status: 'new',
    })

    const rows = await rowsFor(prima.tenantId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tenantId).toBe(prima.tenantId)
  })

  it('stores a blank optional email as null', async () => {
    const result = await createContactLead(harness.db, prima.tenantId, {
      name: 'Amanda',
      phone: '081299001122',
      email: '',
      message: 'Halo',
    })

    expect(result.ok).toBe(true)
    const rows = await rowsFor(prima.tenantId)
    expect(rows[0]?.email).toBeNull()
  })

  it('writes nothing for invalid input', async () => {
    const result = await createContactLead(harness.db, prima.tenantId, {
      name: '',
      phone: '123',
      email: 'bad',
      message: '',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid')
    expect(result.fieldErrors).toMatchObject({
      name: expect.any(Array),
      phone: expect.any(Array),
      email: expect.any(Array),
      message: expect.any(Array),
    })
    await expect(rowsFor(prima.tenantId)).resolves.toHaveLength(0)
  })

  it('never writes for another tenant when recording a contact lead', async () => {
    await createContactLead(harness.db, prima.tenantId, {
      name: 'Prima lead',
      phone: '081299001122',
      email: '',
      message: 'Prima only',
    })

    await expect(rowsFor(prima.tenantId)).resolves.toHaveLength(1)
    await expect(rowsFor(tenantB.tenantId)).resolves.toHaveLength(0)
  })
})

describe('WhatsApp lead tracking', () => {
  it('records an anonymous lead with a same-tenant vehicle association', async () => {
    const slug = mockVehicles[0]!.slug
    const result = await createWhatsappLead(harness.db, prima.tenantId, {
      vehicleSlug: slug,
      showroomName: 'Prima Auto Gallery',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.source).toBe('whatsapp')
    expect(result.data.status).toBe('new')
    expect(result.data.name).toBe('')
    expect(result.data.phone).toBe('')
    expect(result.data.vehicleId).toBeTruthy()
    expect(result.data.vehicleLabel).toContain('Toyota')
    expect(result.data.message).toContain('Prima Auto Gallery')
  })

  it('records a generic lead for a foreign vehicle slug without attaching it', async () => {
    const result = await createWhatsappLead(harness.db, prima.tenantId, {
      vehicleSlug: tenantBVehicle.slug,
      showroomName: 'Prima Auto Gallery',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.vehicleId).toBeUndefined()
    expect(result.data.message).not.toContain('Tenant B')
    expect(result.data.message).toContain('mobil yang tersedia')
  })

  it('records a generic lead without a slug', async () => {
    const result = await createWhatsappLead(harness.db, prima.tenantId, {
      showroomName: 'Prima Auto Gallery',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.vehicleId).toBeUndefined()
  })

  it('rejects a missing or malformed tenant before writing', async () => {
    await expect(
      createWhatsappLead(harness.db, '', { showroomName: 'Prima Auto Gallery' }),
    ).rejects.toBeInstanceOf(TenantScopeError)
    await expect(
      createContactLead(harness.db, 'not-a-uuid', {
        name: 'X',
        phone: '081299001122',
        email: '',
        message: 'Y',
      }),
    ).rejects.toBeInstanceOf(TenantScopeError)
  })
})
