'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, LogOut, Plus, ShieldCheck } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { Toaster } from 'sonner'

import { logoutAction } from '@/lib/auth/actions'
import type { AuthUser } from '@/lib/auth/types'

const nav = [
  ['/platform', 'Tenant', Building2],
  ['/platform/tenants/new', 'Tenant baru', Plus],
] as const

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
  return initials || 'OP'
}

function LogoutButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      title="Keluar"
      aria-label="Keluar dari platform"
      className="flex size-9 items-center justify-center border border-white/20 text-neutral-300 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut className="size-4" aria-hidden="true" />
    </button>
  )
}

/**
 * Platform operations shell.
 *
 * Deliberately separate from `AdminShell`: the dark navigation rail, platform
 * label, and two-item navigation distinguish cross-tenant operations from any
 * showroom's admin. The showroom shell never links here.
 */
export function PlatformShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: AuthUser
}) {
  const path = usePathname()
  const isActive = (href: string) =>
    path === href || (href !== '/platform' && path.startsWith(`${href}/`))
  const displayName = user.displayName ?? user.email ?? 'Operator Platform'

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-950">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950 text-white">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/platform"
            className="flex min-h-11 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <span className="flex size-8 items-center justify-center bg-white text-neutral-950">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <span className="text-base font-bold tracking-tight">
              Platform <span className="font-normal text-neutral-400">OtoWeb</span>
            </span>
          </Link>

          <nav aria-label="Navigasi platform" className="hidden items-center gap-1 md:flex">
            {nav.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                className={`flex min-h-10 items-center gap-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  isActive(href)
                    ? 'bg-white text-neutral-950'
                    : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden max-w-44 truncate text-sm text-neutral-400 sm:block" title={user.email ?? undefined}>
              {displayName}
            </span>
            <span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-950">
              {initialsFor(displayName)}
            </span>
            <form action={logoutAction}>
              <LogoutButton />
            </form>
          </div>
        </div>

        <nav
          aria-label="Navigasi platform seluler"
          className="mx-auto flex w-full max-w-6xl gap-1 px-4 pb-3 md:hidden"
        >
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 px-3 text-sm font-medium ${
                isActive(href)
                  ? 'bg-white text-neutral-950'
                  : 'border border-white/15 text-neutral-300'
              }`}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm' }} />
    </div>
  )
}

export function PlatformPageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}
