import { describe, expect, it } from 'vitest'

import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  contactLeadInputSchema,
  leadIdSchema,
  leadStatusSchema,
  updateLeadStatusInputSchema,
} from '@/lib/validation/lead'

const valid = {
  name: 'Rizky Pratama',
  phone: '0812 9900 1122',
  email: '',
  message: 'Apakah unit ini masih tersedia?',
}

describe('contact lead validation', () => {
  it('accepts representative Indonesian contact details', () => {
    expect(contactLeadInputSchema.safeParse(valid).success).toBe(true)
    expect(
      contactLeadInputSchema.safeParse({ ...valid, phone: '+62 (812) 9900-1122' }).success,
    ).toBe(true)
    expect(
      contactLeadInputSchema.safeParse({ ...valid, email: 'rizky@example.com' }).success,
    ).toBe(true)
  })

  it('trims values and defaults a missing email to an empty string', () => {
    const parsed = contactLeadInputSchema.parse({
      ...valid,
      name: '  Rizky  ',
      email: undefined,
      message: '  Halo  ',
    })

    expect(parsed).toEqual({
      name: 'Rizky',
      phone: '0812 9900 1122',
      email: '',
      message: 'Halo',
    })
  })

  it.each([
    ['missing name', { ...valid, name: '   ' }],
    ['missing phone', { ...valid, phone: '' }],
    ['short phone', { ...valid, phone: '123' }],
    ['invalid phone characters', { ...valid, phone: '0812-abc' }],
    ['invalid email', { ...valid, email: 'not-an-email' }],
    ['missing message', { ...valid, message: '   ' }],
    ['long message', { ...valid, message: 'x'.repeat(2_001) }],
  ])('rejects %s', (_label, input) => {
    expect(contactLeadInputSchema.safeParse(input).success).toBe(false)
  })

  it('exposes exactly the roadmap sources and statuses', () => {
    expect(LEAD_SOURCES).toEqual(['contact_form', 'whatsapp', 'phone', 'manual'])
    expect(LEAD_STATUSES).toEqual(['new', 'contacted', 'qualified', 'won', 'lost'])
  })
})

describe('lead update validation', () => {
  it('accepts every roadmap status for a uuid', () => {
    for (const status of LEAD_STATUSES) {
      expect(
        updateLeadStatusInputSchema.safeParse({
          leadId: '50000000-0000-4000-8000-000000000001',
          status,
        }).success,
      ).toBe(true)
    }
  })

  it('rejects unknown statuses and non-uuid ids', () => {
    expect(leadStatusSchema.safeParse('closed').success).toBe(false)
    expect(leadIdSchema.safeParse('lead-1').success).toBe(false)
    expect(
      updateLeadStatusInputSchema.safeParse({
        leadId: 'lead-1',
        status: 'new',
      }).success,
    ).toBe(false)
  })
})
