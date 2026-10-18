import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Shared frame for the public auth screens.
 *
 * Desktop: an editorial brand panel beside the form. Mobile: the brand panel
 * becomes a compact header so the form stays above the fold.
 */
export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="min-h-dvh bg-white text-neutral-950 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <aside className="relative isolate overflow-hidden bg-neutral-950 px-6 py-8 text-white sm:px-10 lg:flex lg:min-h-dvh lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(184,138,68,0.24),transparent_42%),radial-gradient(circle_at_85%_90%,rgba(255,255,255,0.06),transparent_45%)]"
        />

        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-baseline gap-2 text-lg font-semibold tracking-tight"
          >
            Prima Auto Gallery
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
              Admin
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-white/55 underline-offset-4 hover:text-white hover:underline lg:hidden"
          >
            Lihat situs
          </Link>
        </div>

        <div className="mt-14 max-w-lg lg:mt-0">
          <h1 className="text-3xl font-semibold leading-[1.1] tracking-[-0.02em] sm:text-4xl">
            Satu tempat untuk mengelola showroom Anda.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/60">
            Inventaris, lead, dan pengaturan showroom dalam satu panel yang tenang dan terarah.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-2 text-xs text-white/55 lg:mt-0">
          <span>Akses khusus staf showroom.</span>
          <span className="hidden lg:inline">Butuh bantuan akses? Hubungi operator platform.</span>
        </div>
      </aside>

      <section className="flex items-center justify-center px-5 py-12 sm:px-8 lg:px-12">
        <div className="w-full max-w-md">
          {children}
          {footer ? (
            <div className="mt-8 border-t border-neutral-200 pt-5 text-sm text-neutral-500">
              {footer}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  )
}
