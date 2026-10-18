import { AdminShell } from '@/components/admin-shell'
import { requireAdminUser } from '@/lib/auth/server'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser()

  return <AdminShell user={user}>{children}</AdminShell>
}
