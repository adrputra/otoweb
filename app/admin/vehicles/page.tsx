import { VehicleTable } from '@/components/admin/vehicle-table'
import { requireAdminTenantContext } from '@/lib/admin/context'
import { listAdminVehicles } from '@/lib/admin/vehicle-queries'

export const dynamic = 'force-dynamic'

export default async function VehiclesPage() {
  const { context, db } = await requireAdminTenantContext('manage_vehicles')
  const vehicles = await listAdminVehicles(db, context.tenant.id)

  return <VehicleTable initialVehicles={vehicles} />
}
