import { AdminShell } from '@/components/admin-shell'
import { requireAdminTenantContext } from '@/lib/admin/context'
import { getAdminShowroomSettings } from '@/lib/admin/showroom-settings-service'

export const dynamic = 'force-dynamic'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const { user, context, db } = await requireAdminTenantContext('view')
  const settings = await getAdminShowroomSettings(db, context.tenant.id, context.tenant.name)

  return (
    <AdminShell
      user={user}
      showroomName={settings.values.displayName}
      showroomLocation={settings.values.city}
    >
      {children}
    </AdminShell>
  )
}
