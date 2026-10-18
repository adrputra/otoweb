'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminTenantContext } from './context'
import {
  updateLeadStatus,
  type LeadServiceResult,
} from './lead-service'
import type { Lead } from '@/lib/types'

/** Update one lead status for the active tenant. Staff may manage leads. */
export async function updateLeadStatusAction(
  input: unknown,
): Promise<LeadServiceResult<Lead>> {
  const { context, db } = await requireAdminTenantContext('manage_leads')

  const result = await updateLeadStatus(
    db,
    {
      tenantId: context.tenant.id,
      userId: context.userId,
      isPlatformAdmin: context.isPlatformAdmin,
    },
    input,
  )

  if (result.ok) {
    revalidatePath('/admin')
    revalidatePath('/admin/leads')
  }

  return result
}
