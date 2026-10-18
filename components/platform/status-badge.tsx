import type { PlatformTenantStatus } from '@/lib/platform/types'

/**
 * Platform lifecycle status badge.
 *
 * State colors are semantic and reuse the showroom admin vocabulary: neutral
 * for inactive, amber for trial, emerald for active, orange for suspended.
 */
const LABELS: Record<PlatformTenantStatus, string> = {
  active: 'Aktif',
  trial: 'Uji coba',
  suspended: 'Ditangguhkan',
  disabled: 'Nonaktif',
}

const STYLES: Record<PlatformTenantStatus, string> = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  trial: 'border-amber-200 bg-amber-50 text-amber-900',
  suspended: 'border-orange-200 bg-orange-50 text-orange-900',
  disabled: 'border-neutral-300 bg-neutral-100 text-neutral-500',
}

export function PlatformStatusBadge({ status }: { status: PlatformTenantStatus }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center border px-2.5 text-xs font-semibold ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  )
}

export const PLATFORM_STATUS_LABELS = LABELS
