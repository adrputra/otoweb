'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { createTenantAction } from '@/lib/platform/actions'
import {
  PLATFORM_TENANT_STATUSES,
  type PlatformTenantStatus,
} from '@/lib/platform/types'

const STATUS_LABELS: Record<PlatformTenantStatus, string> = {
  active: 'Aktif',
  trial: 'Uji coba',
  suspended: 'Ditangguhkan',
  disabled: 'Nonaktif',
}

const PLAN_SUGGESTIONS = ['trial', 'starter', 'growth', 'scale']

const inputClass =
  'mt-2 h-10 w-full border border-neutral-300 bg-white px-3 text-sm outline-none transition-colors focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10 aria-[invalid=true]:border-red-500'

function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-neutral-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function CreateTenantForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [plan, setPlan] = useState('starter')
  const [status, setStatus] = useState<PlatformTenantStatus>('trial')
  const [subdomain, setSubdomain] = useState('')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  function changeName(value: string) {
    setName(value)
    if (!slugTouched) setSlug(suggestSlug(value))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setFieldErrors({})

    startTransition(async () => {
      const result = await createTenantAction({
        name,
        slug,
        plan,
        status,
        subdomain,
        ownerUserId,
      })

      if (!result.ok) {
        setMessage(result.message)
        setFieldErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }

      toast.success(`Tenant ${result.data.name} dibuat.`)
      router.push(`/platform/tenants/${result.data.id}`)
      router.refresh()
    })
  }

  const error = (field: string) => fieldErrors[field]?.[0]

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4 sm:px-6">
        <h2 className="font-semibold">Identitas tenant</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Data ini membuat showroom baru yang langsung dapat dikonfigurasi.
        </p>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
        <Field id="tenant-name" label="Nama tenant" error={error('name')}>
          <input
            id="tenant-name"
            name="name"
            value={name}
            onChange={(event) => changeName(event.target.value)}
            required
            autoComplete="organization"
            aria-invalid={Boolean(error('name'))}
            aria-describedby={error('name') ? 'tenant-name-error' : undefined}
            className={inputClass}
            placeholder="Prima Auto Gallery"
          />
        </Field>

        <Field
          id="tenant-slug"
          label="Slug"
          hint="Huruf kecil, angka, dan tanda hubung. Digunakan sebagai identitas stabil."
          error={error('slug')}
        >
          <input
            id="tenant-slug"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            required
            aria-invalid={Boolean(error('slug'))}
            aria-describedby={error('slug') ? 'tenant-slug-error' : 'tenant-slug-hint'}
            className={inputClass}
            placeholder="prima-auto-gallery"
          />
        </Field>

        <Field id="tenant-plan" label="Plan" error={error('plan')}>
          <input
            id="tenant-plan"
            name="plan"
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            required
            list="platform-plan-options"
            aria-invalid={Boolean(error('plan'))}
            aria-describedby={error('plan') ? 'tenant-plan-error' : undefined}
            className={inputClass}
            placeholder="starter"
          />
          <datalist id="platform-plan-options">
            {PLAN_SUGGESTIONS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>

        <Field id="tenant-status" label="Status" error={error('status')}>
          <select
            id="tenant-status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value as PlatformTenantStatus)}
            aria-invalid={Boolean(error('status'))}
            aria-describedby={error('status') ? 'tenant-status-error' : undefined}
            className={inputClass}
          >
            {PLATFORM_TENANT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          id="tenant-subdomain"
          label="Subdomain (opsional)"
          hint="Hostname lengkap, misalnya showroom.otoweb.id."
          error={error('subdomain')}
        >
          <input
            id="tenant-subdomain"
            name="subdomain"
            value={subdomain}
            onChange={(event) => setSubdomain(event.target.value)}
            aria-invalid={Boolean(error('subdomain'))}
            aria-describedby={error('subdomain') ? 'tenant-subdomain-error' : 'tenant-subdomain-hint'}
            className={inputClass}
            placeholder="showroom.otoweb.id"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>

        <Field
          id="tenant-owner"
          label="User ID pemilik (opsional)"
          hint="UUID akun yang sudah diundang melalui penyedia identitas."
          error={error('ownerUserId')}
        >
          <input
            id="tenant-owner"
            name="ownerUserId"
            value={ownerUserId}
            onChange={(event) => setOwnerUserId(event.target.value)}
            aria-invalid={Boolean(error('ownerUserId'))}
            aria-describedby={error('ownerUserId') ? 'tenant-owner-error' : 'tenant-owner-hint'}
            className={inputClass}
            placeholder="00000000-0000-4000-8000-000000000000"
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
      </div>

      {message && (
        <p role="alert" className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800 sm:px-6">
          {message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button
          type="button"
          onClick={() => router.push('/platform')}
          disabled={pending}
          className="flex min-h-10 items-center justify-center border border-neutral-300 px-4 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-400 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex min-h-10 items-center justify-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {pending ? 'Membuat tenant…' : 'Buat tenant'}
        </button>
      </div>
    </form>
  )
}
