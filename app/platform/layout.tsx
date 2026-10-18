import { PlatformShell } from '@/components/platform-shell'
import { requirePlatformOperatorPage } from '@/lib/platform/auth'

export const dynamic = 'force-dynamic'

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePlatformOperatorPage()

  return <PlatformShell user={user}>{children}</PlatformShell>
}
