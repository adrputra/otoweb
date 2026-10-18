'use client'

import { Check, Share2 } from 'lucide-react'
import { useState } from 'react'

import { trackAnalytics } from '@/lib/analytics/client'

function copyWithFallback(value: string): boolean {
  let field: HTMLTextAreaElement | undefined

  try {
    field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.appendChild(field)
    field.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field?.remove()
  }
}

/**
 * Working share control for a vehicle detail page.
 *
 * Preferred path is the native share sheet; when it is unavailable the link is
 * copied to the clipboard. A cancelled native share records nothing. The
 * analytics call is best-effort and never blocks the share itself.
 */
export function VehicleShareButton({
  vehicleSlug,
  title,
}: {
  vehicleSlug: string
  title?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function share() {
    if (typeof window === 'undefined') return

    const url = window.location.href
    const path = window.location.pathname

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: title ?? document.title,
          url,
        })
        trackAnalytics({ event: 'vehicle_share', vehicleSlug, path, method: 'native' })
        return
      }

      const clipboard = (navigator as Navigator & { clipboard?: Clipboard }).clipboard
      if (clipboard) {
        await clipboard.writeText(url)
      } else if (!copyWithFallback(url)) {
        throw new Error('clipboard unavailable')
      }

      setState('copied')
      window.setTimeout(() => setState('idle'), 2_000)
      trackAnalytics({ event: 'vehicle_share', vehicleSlug, path, method: 'clipboard' })
    } catch (error) {
      // A visitor cancelling the native share sheet is not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return
      setState('error')
      window.setTimeout(() => setState('idle'), 2_000)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="mt-3 flex h-12 items-center justify-center gap-2 border border-neutral-300 text-sm font-semibold transition hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20"
      aria-live="polite"
    >
      {state === 'copied' ? (
        <>
          <Check className="size-4" aria-hidden="true" /> Tautan disalin
        </>
      ) : state === 'error' ? (
        <>
          <Share2 className="size-4" aria-hidden="true" /> Coba bagikan lagi
        </>
      ) : (
        <>
          <Share2 className="size-4" aria-hidden="true" /> Bagikan unit
        </>
      )}
    </button>
  )
}
