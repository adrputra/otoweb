import { LeadTable } from '@/components/admin/lead-table'
import { requireAdminTenantContext } from '@/lib/admin/context'
import { listAdminLeads } from '@/lib/admin/lead-queries'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const { context, db } = await requireAdminTenantContext('manage_leads')
  const leads = await listAdminLeads(db, context.tenant.id)

  return <LeadTable initialLeads={leads} />
}
