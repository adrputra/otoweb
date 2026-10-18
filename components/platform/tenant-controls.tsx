'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import {
  assignTenantOwnerAction,
  disableTenantAction,
  setTenantPlanAction,
  setTenantStatusAction,
  setTenantSubdomainAction,
} from '@/lib/platform/actions'
import {
  PLATFORM_TENANT_STATUSES,
  type PlatformResult,
  type PlatformTenantDetail,
  type PlatformTenantStatus,
} from '@/lib/platform/types'

const STATUS_LABELS: Record<PlatformTenantStatus, string> = {
  active: 'Aktif',
  trial: 'Uji coba',
  suspended: 'Ditangguhkan',
  disabled: 'Nonaktif',
}

const inputClass =
  'min-h-10 w-full border border-neutral-300 bg-white px-3 text-sm outline-none transition-colors focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10 aria-[invalid=true]:border-red-500'

const primaryButton =
  'flex min-h-10 shrink-0 items-center justify-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/30 disabled:cursor-not-allowed disabled:opacity-60'

function Section({
  title,
  description,
  children,
  tone = 'default',
}: {
  title: string
  description: string
  children: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <section
      className={`border bg-white ${tone === 'danger' ? 'border-red-200' : 'border-neutral-200'}`}
    >
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{description}</p>
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function ResultMessage({ message, error }: { message: string | null; error: string | null }) {
  if (error) {
    return (
      <p role="alert" className="mt-3 text-sm font-medium text-red-700">
        {error}
      </p>
    )
  }
  if (message) {
    return <p className="mt-3 text-sm text-emerald-700">{message}</p>
  }
  return null
}

function errorFor(result: { message: string; fieldErrors?: Record<string, string[]> }, field: string) {
  return result.fieldErrors?.[field]?.[0] ?? result.message
}

function PlanForm({ tenant }: { tenant: PlatformTenantDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [plan, setPlan] = useState(tenant.plan)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await setTenantPlanAction({ tenantId: tenant.id, plan })
      if (!result.ok) {
        setError(errorFor(result, 'plan'))
        toast.error(result.message)
        return
      }
      setPlan(result.data.plan)
      setMessage('Plan tersimpan.')
      toast.success('Plan tenant diperbarui.')
      router.refresh()
    })
  }

  return (
    <Section title="Plan" description="Label paket layanan yang dipakai tenant.">
      <form onSubmit={submit} noValidate>
        <label htmlFor="platform-plan" className="block text-sm font-medium">
          Plan tenant
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="platform-plan"
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            aria-invalid={Boolean(error)}
            className={inputClass}
            placeholder="starter"
          />
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Simpan plan
          </button>
        </div>
        <ResultMessage message={message} error={error} />
      </form>
    </Section>
  )
}

function StatusForm({ tenant }: { tenant: PlatformTenantDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<PlatformTenantStatus>(tenant.status)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await setTenantStatusAction({ tenantId: tenant.id, status })
      if (!result.ok) {
        setError(errorFor(result, 'status'))
        toast.error(result.message)
        return
      }
      setStatus(result.data.status)
      setMessage('Status tersimpan.')
      toast.success('Status tenant diperbarui.')
      router.refresh()
    })
  }

  return (
    <Section
      title="Status"
      description="Status menentukan apakah showroom boleh melayani pengunjung."
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="platform-status" className="block text-sm font-medium">
          Status lifecycle
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <select
            id="platform-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as PlatformTenantStatus)}
            className={inputClass}
          >
            {PLATFORM_TENANT_STATUSES.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Simpan status
          </button>
        </div>
        <ResultMessage message={message} error={error} />
      </form>
    </Section>
  )
}

function OwnerForm({ tenant }: { tenant: PlatformTenantDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [userId, setUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await assignTenantOwnerAction({ tenantId: tenant.id, userId })
      if (!result.ok) {
        setError(errorFor(result, 'userId'))
        toast.error(result.message)
        return
      }
      setUserId('')
      setMessage('Pemilik ditetapkan.')
      toast.success('Pemilik tenant diperbarui.')
      router.refresh()
    })
  }

  return (
    <Section
      title="Pemilik"
      description="Tetapkan akun yang sudah diundang sebagai pemilik showroom."
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="platform-owner" className="block text-sm font-medium">
          User ID pemilik
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="platform-owner"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            aria-invalid={Boolean(error)}
            className={inputClass}
            placeholder="00000000-0000-4000-8000-000000000000"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Tetapkan pemilik
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Gunakan UUID akun dari penyedia identitas. Profil minimal dibuat otomatis bila belum ada.
        </p>
        <ResultMessage message={message} error={error} />
      </form>
    </Section>
  )
}

function SubdomainForm({ tenant }: { tenant: PlatformTenantDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const current =
    tenant.domains.find((domain) => domain.type === 'platform_subdomain')?.hostname ?? ''
  const [hostname, setHostname] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const result = await setTenantSubdomainAction({ tenantId: tenant.id, hostname })
      if (!result.ok) {
        setError(errorFor(result, 'hostname'))
        toast.error(result.message)
        return
      }
      const next =
        result.data.domains.find((domain) => domain.type === 'platform_subdomain')?.hostname ?? ''
      setHostname(next)
      setMessage('Subdomain tersimpan.')
      toast.success('Subdomain tenant diperbarui.')
      router.refresh()
    })
  }

  return (
    <Section
      title="Subdomain"
      description="Hostname platform yang menampilkan showroom tenant ini."
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="platform-hostname" className="block text-sm font-medium">
          Hostname
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="platform-hostname"
            value={hostname}
            onChange={(event) => setHostname(event.target.value)}
            aria-invalid={Boolean(error)}
            className={inputClass}
            placeholder="showroom.otoweb.id"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Simpan subdomain
          </button>
        </div>
        <ResultMessage message={message} error={error} />
      </form>
    </Section>
  )
}

function DisableTenant({ tenant }: { tenant: PlatformTenantDetail }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const alreadyDisabled = tenant.status === 'disabled'

  function disable() {
    if (alreadyDisabled) return
    if (!window.confirm(`Nonaktifkan ${tenant.name}? Showroom akan berhenti melayani publik.`)) {
      return
    }

    setError(null)
    startTransition(async () => {
      const result: PlatformResult<PlatformTenantDetail> = await disableTenantAction(tenant.id)
      if (!result.ok) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      toast.success(`${result.data.name} dinonaktifkan.`)
      router.refresh()
    })
  }

  return (
    <Section
      title="Zona berbahaya"
      description="Menonaktifkan tenant menghentikan seluruh akses publik ke showroom."
      tone="danger"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-700" aria-hidden="true" />
          <p className="text-sm text-neutral-600">
            {alreadyDisabled
              ? 'Tenant ini sudah nonaktif. Gunakan pengaturan status untuk mengaktifkan kembali.'
              : 'Status nonaktif berlaku segera setelah disimpan. Data tenant tidak dihapus.'}
          </p>
        </div>
        <button
          type="button"
          onClick={disable}
          disabled={pending || alreadyDisabled}
          className="flex min-h-10 items-center justify-center gap-2 border border-red-300 bg-red-50 px-4 text-sm font-semibold text-red-800 transition-colors hover:border-red-400 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {alreadyDisabled ? 'Tenant nonaktif' : 'Nonaktifkan tenant'}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </Section>
  )
}

export function TenantControls({ tenant }: { tenant: PlatformTenantDetail }) {
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <PlanForm tenant={tenant} />
      <StatusForm tenant={tenant} />
      <OwnerForm tenant={tenant} />
      <SubdomainForm tenant={tenant} />
      <div className="lg:col-span-2">
        <DisableTenant tenant={tenant} />
      </div>
    </div>
  )
}
