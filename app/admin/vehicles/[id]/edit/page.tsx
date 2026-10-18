import { notFound } from 'next/navigation'

import { VehicleForm } from '@/components/vehicle-form'
import { requireAdminTenantContext } from '@/lib/admin/context'
import { getAdminVehicleById } from '@/lib/admin/vehicle-queries'
import { isUuid } from '@/lib/tenant/session'

export const dynamic = 'force-dynamic'

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context, db } = await requireAdminTenantContext('manage_vehicles')

  if (!isUuid(id)) notFound()

  const vehicle = await getAdminVehicleById(db, context.tenant.id, id)
  if (!vehicle) notFound()

  return <VehicleForm vehicle={vehicle} />
}
