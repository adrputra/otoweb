'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CarFront,
  Users,
  Store,
  UserRoundCog,
  Settings,
  Menu,
  X,
  Plus,
  LogOut,
} from 'lucide-react'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Toaster } from 'sonner'

import { logoutAction } from '@/lib/auth/actions'
import type { AuthUser } from '@/lib/auth/types'

const nav = [
  ['/admin', 'Dashboard', LayoutDashboard], ['/admin/vehicles', 'Kendaraan', CarFront],
  ['/admin/leads', 'Leads', Users], ['/admin/showroom', 'Showroom', Store],
  ['/admin/staff', 'Staff', UserRoundCog], ['/admin/settings', 'Pengaturan', Settings],
] as const

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? '').join('')
  return initials || 'PA'
}

function LogoutButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      title="Keluar"
      aria-label="Keluar dari panel admin"
      className="flex size-9 items-center justify-center border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-neutral-300 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut className="size-4" aria-hidden="true" />
    </button>
  )
}

export function AdminShell({
  children,
  user,
}: {
  children: React.ReactNode
  user: AuthUser
}) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const active = (href: string) =>
    path === href || (href !== '/admin' && path.startsWith(`${href}/`))
  const displayName = user.displayName ?? user.email ?? 'Staf Showroom'

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-950">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-neutral-200 bg-white p-4 transition-transform md:w-16 md:px-2 md:translate-x-0 lg:w-64 lg:p-5 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between md:justify-center lg:justify-between">
          <Link
            href="/admin"
            className="truncate text-lg font-bold tracking-tight md:hidden lg:block"
          >
            Prima Auto <span className="font-normal text-neutral-400">/ Admin</span>
          </Link>
          <span className="hidden text-lg font-bold md:block lg:hidden">PA</span>
          <button
            className="flex size-11 items-center justify-center md:hidden"
            onClick={() => setOpen(false)}
            aria-label="Tutup menu"
          >
            <X />
          </button>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {nav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              title={label}
              className={`flex min-h-11 items-center gap-3 px-3 text-sm font-medium md:justify-center md:px-0 lg:justify-start lg:px-3 ${active(href) ? 'bg-neutral-950 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="md:hidden lg:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="absolute inset-x-5 bottom-5 hidden border-t border-neutral-100 pt-4 text-xs text-neutral-400 lg:block">
          Prima Auto Gallery
          <br />
          Jakarta Selatan
        </div>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Tutup overlay"
        />
      )}

      <main className="pb-20 md:pl-16 md:pb-0 lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-neutral-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            className="flex size-11 items-center justify-center md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Buka menu"
          >
            <Menu />
          </button>
          <div className="hidden text-sm text-neutral-500 md:block">
            {nav.find(([href]) => active(href))?.[1] || 'Admin'}
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span
              className="hidden max-w-48 truncate text-sm text-neutral-500 sm:block"
              title={user.email ?? undefined}
            >
              {displayName}
            </span>
            <div className="flex size-9 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white">
              {initialsFor(displayName)}
            </div>
            <form action={logoutAction}>
              <LogoutButton />
            </form>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.slice(0, 4).map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] ${active(href) ? 'text-neutral-950' : 'text-neutral-400'}`}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <Toaster position="top-center" toastOptions={{ className: 'text-sm' }} />
    </div>
  )
}

export function PageHeader({
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
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Prima Auto Gallery
        </p>
        <h1 className="break-words text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function AddButton({ children = 'Tambah' }: { children?: React.ReactNode }) {
  return (
    <span className="flex min-h-11 items-center justify-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white">
      <Plus className="size-4" />
      {children}
    </span>
  )
}
