'use client'

import { useMemo, useState } from 'react'
import { MessageCircle, Search, Users } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader, useAdminShowroom } from '@/components/admin-shell'
import { updateLeadStatusAction } from '@/lib/admin/lead-actions'
import type { AdminLeadStats } from '@/lib/admin/lead-queries'
import { formatDate, whatsappLink } from '@/lib/format'
import type { Lead, LeadStatus } from '@/lib/types'
import {
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
} from '@/lib/validation/lead'

const statusStyles: Record<LeadStatus, string> = {
  new: 'border-amber-200 bg-amber-50 text-amber-900',
  contacted: 'border-sky-200 bg-sky-50 text-sky-900',
  qualified: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  won: 'border-neutral-900 bg-neutral-950 text-white',
  lost: 'border-neutral-200 bg-neutral-100 text-neutral-500',
}

function statsCards(stats: AdminLeadStats) {
  return [
    ['Total', stats.total],
    ['Baru', stats.new],
    ['Dihubungi', stats.contacted],
    ['Kualifikasi', stats.qualified],
    ['Menang', stats.won],
    ['Kalah', stats.lost],
  ] as const
}

/** Client lead dashboard: filter, inspect, and update the tenant's inquiries. */
export function LeadTable({ initialLeads }: { initialLeads: Lead[] }) {
  const showroom = useAdminShowroom()
  const [items, setItems] = useState<Lead[]>(initialLeads)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [source, setSource] = useState('all')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      items.filter((lead) => {
        const haystack = `${lead.name} ${lead.phone} ${lead.email} ${lead.message} ${
          lead.vehicleLabel ?? ''
        }`.toLowerCase()

        return (
          haystack.includes(query.trim().toLowerCase()) &&
          (status === 'all' || lead.status === status) &&
          (source === 'all' || lead.source === source)
        )
      }),
    [items, query, status, source],
  )

  const stats: AdminLeadStats = useMemo(() => {
    const next: AdminLeadStats = {
      total: items.length,
      new: 0,
      contacted: 0,
      qualified: 0,
      won: 0,
      lost: 0,
    }
    for (const lead of items) next[lead.status] += 1
    return next
  }, [items])

  async function changeStatus(lead: Lead, nextStatus: LeadStatus) {
    if (lead.status === nextStatus) return

    const previous = lead.status
    setPendingId(lead.id)
    setItems((current) =>
      current.map((item) =>
        item.id === lead.id ? { ...item, status: nextStatus } : item,
      ),
    )

    const result = await updateLeadStatusAction({
      leadId: lead.id,
      status: nextStatus,
    })

    setPendingId(null)

    if (!result.ok) {
      setItems((current) =>
        current.map((item) =>
          item.id === lead.id ? { ...item, status: previous } : item,
        ),
      )
      toast.error(result.message ?? 'Status lead gagal diperbarui.')
      return
    }

    setItems((current) =>
      current.map((item) => (item.id === lead.id ? result.data : item)),
    )
    toast.success(`Status ${lead.name || 'lead'} diperbarui.`)
  }

  const hasFilters = query.trim() !== '' || status !== 'all' || source !== 'all'

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${stats.total} percakapan dari semua kanal`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statsCards(stats).map(([label, value]) => (
          <div key={label} className="border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">{label}</p>
            <p
              className="mt-2 text-2xl font-bold"
              data-testid={`lead-stat-${label.toLowerCase()}`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-5 mt-6 flex flex-col gap-3 md:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, telepon, email, pesan, atau unit"
            aria-label="Cari lead"
            className="h-11 w-full min-w-0 border border-neutral-200 bg-white pl-10 pr-3 text-base outline-none focus:border-neutral-950"
          />
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter status"
          className="h-11 min-w-0 border border-neutral-200 bg-white px-3 text-base md:text-sm"
        >
          <option value="all">Semua status</option>
          {LEAD_STATUSES.map((value) => (
            <option key={value} value={value}>
              {LEAD_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value)}
          aria-label="Filter sumber"
          className="h-11 min-w-0 border border-neutral-200 bg-white px-3 text-base md:text-sm"
        >
          <option value="all">Semua sumber</option>
          {LEAD_SOURCES.map((value) => (
            <option key={value} value={value}>
              {LEAD_SOURCE_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden border border-neutral-200 bg-white">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Users className="size-7 text-neutral-300" />
            <h2 className="mt-4 font-semibold">
              {items.length === 0 ? 'Belum ada lead' : 'Tidak ada lead yang cocok'}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-500">
              {items.length === 0
                ? 'Lead dari formulir kontak dan tombol WhatsApp akan muncul di sini secara otomatis.'
                : 'Ubah kata kunci atau filter untuk melihat lead lainnya.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  setStatus('all')
                  setSource('all')
                }}
                className="mt-5 border-b border-neutral-950 pb-1 text-sm font-semibold"
              >
                Hapus filter
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="p-4 font-medium">Lead</th>
                    <th className="p-4 font-medium">Kontak</th>
                    <th className="p-4 font-medium">Sumber</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Tanggal</th>
                    <th className="p-4 font-medium">
                      <span className="sr-only">Balas</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((lead) => (
                    <DesktopRow
                      key={lead.id}
                      lead={lead}
                      pending={pendingId === lead.id}
                      showroomName={showroom.name}
                      onChange={changeStatus}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-neutral-100 md:hidden">
              {filtered.map((lead) => (
                <MobileRow
                  key={lead.id}
                  lead={lead}
                  pending={pendingId === lead.id}
                  showroomName={showroom.name}
                  onChange={changeStatus}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

interface RowProps {
  lead: Lead
  pending: boolean
  showroomName: string
  onChange: (lead: Lead, status: LeadStatus) => void
}

function LeadSummary({ lead }: { lead: Lead }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{lead.name || 'Tanpa nama'}</p>
        <span className="text-[11px] font-medium text-neutral-400">
          {LEAD_SOURCE_LABELS[lead.source]}
        </span>
      </div>
      <p className="mt-1 max-w-md text-sm leading-6 text-neutral-600">
        {lead.message}
      </p>
      {lead.vehicleLabel && (
        <p className="mt-2 text-xs text-neutral-400">{lead.vehicleLabel}</p>
      )}
    </div>
  )
}

function Contact({ lead }: { lead: Lead }) {
  if (!lead.phone && !lead.email) {
    return <span className="text-xs text-neutral-400">Tanpa kontak</span>
  }

  return (
    <div className="text-xs leading-5 text-neutral-600">
      {lead.phone && <p>{lead.phone}</p>}
      {lead.email && <p className="break-words text-neutral-400">{lead.email}</p>}
    </div>
  )
}

function StatusSelect({
  lead,
  pending,
  onChange,
}: {
  lead: Lead
  pending: boolean
  onChange: (lead: Lead, status: LeadStatus) => void
}) {
  return (
    <select
      value={lead.status}
      disabled={pending}
      onChange={(event) => onChange(lead, event.target.value as LeadStatus)}
      aria-label={`Status ${lead.name || 'lead'}`}
      className={`h-9 min-w-28 border px-2 text-xs font-medium outline-none transition disabled:cursor-wait disabled:opacity-60 ${statusStyles[lead.status]}`}
    >
      {LEAD_STATUSES.map((value) => (
        <option key={value} value={value}>
          {LEAD_STATUS_LABELS[value]}
        </option>
      ))}
    </select>
  )
}

function Reply({ lead, showroomName }: { lead: Lead; showroomName: string }) {
  if (!lead.phone) return null

  return (
    <a
      href={whatsappLink(
        lead.phone,
        `Halo ${lead.name || 'Bapak/Ibu'}, terima kasih sudah menghubungi ${showroomName}.`,
      )}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 items-center justify-center gap-1.5 border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400 hover:text-neutral-950"
    >
      <MessageCircle className="size-3.5" />
      Balas
    </a>
  )
}

function DesktopRow({ lead, pending, showroomName, onChange }: RowProps) {
  return (
    <tr>
      <td className="max-w-md p-4">
        <LeadSummary lead={lead} />
      </td>
      <td className="min-w-44 p-4">
        <Contact lead={lead} />
      </td>
      <td className="p-4 text-xs text-neutral-500">
        {LEAD_SOURCE_LABELS[lead.source]}
      </td>
      <td className="p-4">
        <StatusSelect lead={lead} pending={pending} onChange={onChange} />
      </td>
      <td className="whitespace-nowrap p-4 text-xs text-neutral-500">
        {formatDate(lead.createdAt)}
      </td>
      <td className="p-4 text-right">
        <Reply lead={lead} showroomName={showroomName} />
      </td>
    </tr>
  )
}

function MobileRow({ lead, pending, showroomName, onChange }: RowProps) {
  return (
    <div className="p-4">
      <LeadSummary lead={lead} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Contact lead={lead} />
        <span className="text-xs text-neutral-400">
          {formatDate(lead.createdAt)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusSelect lead={lead} pending={pending} onChange={onChange} />
        <Reply lead={lead} showroomName={showroomName} />
      </div>
    </div>
  )
}
