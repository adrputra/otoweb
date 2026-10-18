'use client'

import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Recoverable route error boundary.
 *
 * Failures are logged for the operator, but the visitor gets a calm message and
 * a retry action instead of a blank screen or a framework error page.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] route error', error)
  }, [error])

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#faf9f7] px-5 text-center text-neutral-950">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
        Terjadi kesalahan
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Halaman ini belum dapat dimuat
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
        Silakan coba lagi. Jika masalah berlanjut, hubungi pengelola showroom.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center bg-neutral-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          Coba lagi
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center border border-neutral-300 px-5 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-500"
        >
          Kembali ke beranda
        </Link>
      </div>
    </main>
  )
}
