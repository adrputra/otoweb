'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminTenantContext } from './context'
import {
  updateAdminShowroomSettings,
  type ShowroomSettingsServiceResult,
  type ShowroomSettingsSnapshot,
} from './showroom-settings-service'

/**
 * Persist the showroom profile for the active tenant, then revalidate every
 * surface that renders it. The tenant comes from the verified request context,
 * never from the browser payload.
 */
export async function updateShowroomSettingsAction(
  input: unknown,
): Promise<ShowroomSettingsServiceResult<ShowroomSettingsSnapshot>> {
  const { context, db } = await requireAdminTenantContext('manage_settings')

  const result = await updateAdminShowroomSettings(
    db,
    {
      tenantId: context.tenant.id,
      userId: context.userId,
      isPlatformAdmin: context.isPlatformAdmin,
    },
    input,
  )

  if (result.ok) {
    revalidatePath('/')
    revalidatePath('/cars')
    revalidatePath('/cars/[slug]', 'page')
    revalidatePath('/admin', 'layout')
  }

  return result
}
