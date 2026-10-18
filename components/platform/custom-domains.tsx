'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckCircle2, Globe2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import {
  registerCustomDomainAction,
  verifyCustomDomainAction,
} from '@/lib/platform/actions'
import type {
  PlatformTenantDetail,
  PlatformTenantDomain,
} from '@/lib/platform/types'

const inputClass =
  'min-h-10 w-full border border-neutral-300 bg-white px-3 text-sm outline-none transition-colors focus:border-neutral-950 focus:ring-2 focus:ring-neutral-950/10 aria-[invalid=true]:border-red-500'

const primaryButton =
  'flex min-h-10 shrink-0 items-center justify-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/30 disabled:cursor-not-allowed disabled:opacity-60'

const secondaryButton =
  'flex min-h-10 shrink-0 items-center justify-center gap-2 border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-800 transition-colors hover:border-neutral-400 hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/20 disabled:cursor-not-allowed disabled:opacity-60'

const VERIFICATION_LABELS: Record<PlatformTenantDomain['verificationStatus'], string> = {
  pending: 'Menunggu verifikasi',
  verified: 'Terverifikasi',
  failed: 'Verifikasi gagal',
}

const SSL_LABELS: Record<PlatformTenantDomain['sslStatus'], string> = {
  none: 'Belum diproses',
  pending: 'Menunggu sertifikat',
  active: 'SSL aktif',
  failed: 'Sertifikat gagal',
}

const VERIFICATION_TONES: Record<PlatformTenantDomain['verificationStatus'], string> = {
  pending: 'border-neutral-300 bg-neutral-50 text-neutral-700',
  verified: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-red-200 bg-red-50 text-red-800',
}

const SSL_TONES: Record<PlatformTenantDomain['sslStatus'], string> = {
  none: 'border-neutral-300 bg-neutral-50 text-neutral-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-900',
  active: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-red-200 bg-red-50 text-red-800',
}

function formatCheckedAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function errorFor(
  result: { message: string; fieldErrors?: Record<string, string[]> },
  field: string,
): string {
  return result.fieldErrors?.[field]?.[0] ?? result.message
}

function StateBadge({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center border px-2.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  )
}

function DnsInstructions({ domain }: { domain: PlatformTenantDomain }) {
  if (!domain.dnsInstructions || domain.dnsInstructions.length === 0) return null

  return (
    <div className="mt-3 border border-neutral-200">
      <div className="border-b border-neutral-100 bg-neutral-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          Record DNS
        </p>
      </div>
      <div className="divide-y divide-neutral-100">
        {domain.dnsInstructions.map((instruction) => (
          <div key={`${instruction.type}-${instruction.name}`} className="p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="border border-neutral-300 px-1.5 py-0.5 text-[11px] font-bold tracking-wide text-neutral-700">
                {instruction.type}
              </span>
              <span className="text-xs text-neutral-500">{instruction.purpose}</span>
            </div>
            <dl className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Nama
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-neutral-900">
                  {instruction.name}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  Nilai
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-neutral-900">
                  {instruction.value}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}

function DomainRow({ domain, tenantId }: { domain: PlatformTenantDomain; tenantId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const checkedAt = formatCheckedAt(domain.lastCheckedAt)
  const isActive =
    domain.status === 'active' &&
    domain.verificationStatus === 'verified' &&
    domain.sslStatus === 'active'

  function verify() {
    setError(null)
    startTransition(async () => {
      const result = await verifyCustomDomainAction({ tenantId, domainId: domain.id })
      if (!result.ok) {
        setError(errorFor(result, 'domainId'))
        toast.error(result.message)
        return
      }

      const updated = result.data.domains.find((item) => item.id === domain.id)
      if (updated?.sslStatus === 'active' && updated.verificationStatus === 'verified') {
        toast.success(`${domain.hostname} terverifikasi dan siap melayani.`)
      } else if (updated?.verificationStatus === 'failed') {
        toast.error('DNS belum cocok. Periksa record TXT lalu coba lagi.')
      } else if (updated?.sslStatus === 'failed') {
        toast.error('Kepemilikan terverifikasi, tetapi sertifikat gagal diproses.')
      } else {
        toast.message('Verifikasi belum selesai. Coba lagi setelah DNS menyebar.')
      }
      router.refresh()
    })
  }

  return (
    <li className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Globe2 className="size-4 shrink-0 text-neutral-500" aria-hidden="true" />
            <p className="break-all text-sm font-semibold">{domain.hostname}</p>
            {isActive && (
              <CheckCircle2 className="size-4 text-emerald-700" aria-label="Aktif" />
            )}
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            Domain kustom
            {checkedAt ? ` · dicek ${checkedAt}` : ' · belum pernah diverifikasi'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StateBadge
              label={VERIFICATION_LABELS[domain.verificationStatus]}
              tone={VERIFICATION_TONES[domain.verificationStatus]}
            />
            <StateBadge label={SSL_LABELS[domain.sslStatus]} tone={SSL_TONES[domain.sslStatus]} />
            {domain.status !== 'active' && (
              <StateBadge
                label="Belum melayani"
                tone="border-neutral-300 bg-neutral-50 text-neutral-700"
              />
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={verify}
          disabled={pending || isActive}
          aria-label={`Verifikasi DNS ${domain.hostname}`}
          className={secondaryButton}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          {isActive ? 'Sudah aktif' : pending ? 'Memverifikasi…' : 'Verifikasi DNS'}
        </button>
      </div>

      <DnsInstructions domain={domain} />

      {domain.verificationStatus === 'failed' && (
        <p className="mt-3 flex items-start gap-2 text-xs text-red-800">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Record TXT belum cocok. Pastikan nama dan nilai di atas sudah tersimpan,
          lalu jalankan verifikasi lagi.
        </p>
      )}
      {domain.verificationStatus === 'verified' && domain.sslStatus === 'failed' && (
        <p className="mt-3 flex items-start gap-2 text-xs text-red-800">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Kepemilikan domain sudah terverifikasi, tetapi sertifikat belum aktif.
          Coba verifikasi lagi; domain belum melayani sampai SSL aktif.
        </p>
      )}
      {domain.verificationStatus === 'pending' && domain.lastCheckedAt && (
        <p className="mt-3 text-xs text-neutral-600">
          Record DNS belum terbaca. Propagasi DNS dapat memerlukan waktu; coba lagi
          beberapa saat lagi.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </li>
  )
}

function RegisterForm({ tenantId }: { tenantId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [hostname, setHostname] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await registerCustomDomainAction({ tenantId, hostname })
      if (!result.ok) {
        setError(errorFor(result, 'hostname'))
        toast.error(result.message)
        return
      }

      setHostname('')
      toast.success('Domain kustom didaftarkan. Publikasikan record DNS di bawah.')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} noValidate className="border-t border-neutral-100 p-5">
      <label htmlFor="custom-domain-hostname" className="block text-sm font-medium">
        Domain kustom
      </label>
      <p className="mt-1 text-xs text-neutral-500">
        Gunakan hostname milik showroom, misalnya showroom.example.com. Domain di
        bawah platform tetap dikelola sebagai subdomain platform.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="custom-domain-hostname"
          value={hostname}
          onChange={(event) => setHostname(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'custom-domain-hostname-error' : undefined}
          className={inputClass}
          placeholder="showroom.example.com"
          inputMode="url"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? 'Mendaftarkan…' : 'Daftarkan domain'}
        </button>
      </div>
      {error && (
        <p
          id="custom-domain-hostname-error"
          role="alert"
          className="mt-2 text-xs font-medium text-red-700"
        >
          {error}
        </p>
      )}
    </form>
  )
}

export function CustomDomains({ tenant }: { tenant: PlatformTenantDetail }) {
  const customDomains = tenant.domains.filter((domain) => domain.type === 'custom_domain')

  return (
    <section className="mt-6 border border-neutral-200 bg-white">
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="font-semibold">Domain kustom</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Hubungkan domain milik showroom. Subdomain platform tetap aktif sebagai
          alamat cadangan selama domain kustom diverifikasi.
        </p>
      </div>

      {customDomains.length === 0 ? (
        <p className="px-5 pt-4 text-sm text-neutral-500">
          Belum ada domain kustom. Daftarkan hostname untuk melihat instruksi DNS.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {customDomains.map((domain) => (
            <DomainRow key={domain.id} domain={domain} tenantId={tenant.id} />
          ))}
        </ul>
      )}

      <RegisterForm tenantId={tenant.id} />
    </section>
  )
}
