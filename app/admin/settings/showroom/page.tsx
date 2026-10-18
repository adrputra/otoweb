import { ShowroomSettingsForm } from '@/components/admin/showroom-settings-form'
import { requireAdminTenantContext } from '@/lib/admin/context'
import { getAdminShowroomSettings } from '@/lib/admin/showroom-settings-service'

export const dynamic = 'force-dynamic'

export default async function ShowroomSettingsPage() {
  const { context, db } = await requireAdminTenantContext('manage_settings')
  const settings = await getAdminShowroomSettings(db, context.tenant.id, context.tenant.name)

  return <ShowroomSettingsForm initialValues={settings.values} />
}
