import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type MessageTone = 'error' | 'success' | 'info'

const toneStyles: Record<MessageTone, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-neutral-200 bg-neutral-50 text-neutral-700',
}

export function AuthMessage({
  tone = 'info',
  children,
  className,
}: {
  tone?: MessageTone
  children: ReactNode
  className?: string
}) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={cn(
        'flex items-start gap-2 border px-3 py-2.5 text-sm leading-5',
        toneStyles[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  )
}
