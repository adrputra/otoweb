'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminTenantContext } from './context'
import {
  archiveVehicle,
  createVehicle,
  deleteVehicle,
  duplicateVehicle,
  publishVehicle,
  reserveVehicle,
  sellVehicle,
  updateVehicle,
  type ServiceResult,
  type TenantActor,
} from './vehicle-service'
import type { Vehicle } from '@/lib/types'

async function actorForRequest(): Promise<{
  db: Awaited<ReturnType<typeof requireAdminTenantContext>>['db']
  actor: TenantActor
}> {
  const { context, db } = await requireAdminTenantContext('manage_vehicles')
  return {
    db,
    actor: {
      tenantId: context.tenant.id,
      userId: context.userId,
      isPlatformAdmin: context.isPlatformAdmin,
    },
  }
}

function revalidateAdmin() {
  revalidatePath('/admin')
  revalidatePath('/admin/vehicles')
}

function revalidatePublic(slug?: string) {
  revalidatePath('/cars')
  if (slug) revalidatePath(`/cars/${slug}`)
}

export async function createVehicleAction(input: unknown): Promise<ServiceResult<Vehicle>> {
  const { db, actor } = await actorForRequest()
  const result = await createVehicle(db, actor, input)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic(result.data.slug)
  }

  return result
}

export async function updateVehicleAction(
  vehicleId: string,
  input: unknown,
): Promise<ServiceResult<Vehicle>> {
  const { db, actor } = await actorForRequest()
  const result = await updateVehicle(db, actor, vehicleId, input)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic(result.data.slug)
  }

  return result
}

export async function publishVehicleAction(vehicleId: string): Promise<ServiceResult<Vehicle>> {
  const { db, actor } = await actorForRequest()
  const result = await publishVehicle(db, actor, vehicleId)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic(result.data.slug)
  }

  return result
}

export async function reserveVehicleAction(vehicleId: string): Promise<ServiceResult<Vehicle>> {
  const { db, actor } = await actorForRequest()
  const result = await reserveVehicle(db, actor, vehicleId)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic(result.data.slug)
  }

  return result
}

export async function sellVehicleAction(vehicleId: string): Promise<ServiceResult<Vehicle>> {
  const { db, actor } = await actorForRequest()
  const result = await sellVehicle(db, actor, vehicleId)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic(result.data.slug)
  }

  return result
}

export async function archiveVehicleAction(vehicleId: string): Promise<ServiceResult<Vehicle>> {
  const { db, actor } = await actorForRequest()
  const result = await archiveVehicle(db, actor, vehicleId)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic(result.data.slug)
  }

  return result
}

export async function duplicateVehicleAction(vehicleId: string): Promise<ServiceResult<Vehicle>> {
  const { db, actor } = await actorForRequest()
  const result = await duplicateVehicle(db, actor, vehicleId)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic(result.data.slug)
  }

  return result
}

export async function deleteVehicleAction(
  vehicleId: string,
): Promise<ServiceResult<{ id: string }>> {
  const { db, actor } = await actorForRequest()
  const result = await deleteVehicle(db, actor, vehicleId)

  if (result.ok) {
    revalidateAdmin()
    revalidatePublic()
  }

  return result
}
