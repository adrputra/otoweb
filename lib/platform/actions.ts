'use server'

import { revalidatePath } from 'next/cache'

import type { AppDatabase } from '@/lib/db/runtime'

import { requirePlatformOperatorAction } from './auth'
import {
  assignTenantOwner,
  createPlatformTenant,
  disableTenant,
  setTenantPlan,
  setTenantStatus,
  setTenantSubdomain,
} from './tenant-service'
import type { PlatformResult, PlatformTenantDetail } from './types'

function revalidatePlatform(tenantId?: string): void {
  revalidatePath('/platform')
  revalidatePath('/platform/tenants')
  if (tenantId) revalidatePath(`/platform/tenants/${tenantId}`)

  // Status and subdomain changes affect public resolution; revalidate the
  // public surfaces so the next request observes the saved state.
  revalidatePath('/')
  revalidatePath('/cars')
  revalidatePath('/cars/[slug]', 'page')
}

function forbidden(): PlatformResult<never> {
  return {
    ok: false,
    error: 'forbidden',
    message: 'Akses platform ditolak. Akun ini bukan operator platform.',
  }
}

async function runAction(
  operation: (db: AppDatabase, actorUserId: string) => Promise<PlatformResult<PlatformTenantDetail>>,
  tenantId?: string,
): Promise<PlatformResult<PlatformTenantDetail>> {
  const session = await requirePlatformOperatorAction()
  if (!session.ok) return forbidden()

  try {
    const result = await operation(session.db, session.user.id)
    if (result.ok) revalidatePlatform(tenantId ?? result.data.id)
    return result
  } catch (error) {
    console.error('[platform] action failed', error)
    return {
      ok: false,
      error: 'invalid',
      message: 'Operasi platform gagal diproses.',
    }
  }
}

function tenantIdFrom(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined
  const value = (input as { tenantId?: unknown }).tenantId
  return typeof value === 'string' ? value : undefined
}

export async function createTenantAction(
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  return runAction((db, actorUserId) => createPlatformTenant(db, actorUserId, input))
}

export async function assignTenantOwnerAction(
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  return runAction(
    (db, actorUserId) => assignTenantOwner(db, actorUserId, input),
    tenantIdFrom(input),
  )
}

export async function setTenantSubdomainAction(
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  return runAction(
    (db, actorUserId) => setTenantSubdomain(db, actorUserId, input),
    tenantIdFrom(input),
  )
}

export async function setTenantPlanAction(
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  return runAction(
    (db, actorUserId) => setTenantPlan(db, actorUserId, input),
    tenantIdFrom(input),
  )
}

export async function setTenantStatusAction(
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  return runAction(
    (db, actorUserId) => setTenantStatus(db, actorUserId, input),
    tenantIdFrom(input),
  )
}

export async function disableTenantAction(
  tenantId: string,
): Promise<PlatformResult<PlatformTenantDetail>> {
  return runAction((db, actorUserId) => disableTenant(db, actorUserId, tenantId), tenantId)
}
