'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive,
  CheckCircle2,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { AddButton, PageHeader } from '@/components/admin-shell'
import { formatKm, formatRupiah } from '@/lib/format'
import {
  archiveVehicleAction,
  deleteVehicleAction,
  duplicateVehicleAction,
  publishVehicleAction,
  reserveVehicleAction,
  sellVehicleAction,
} from '@/lib/admin/vehicle-actions'
import type { Vehicle } from '@/lib/types'

const statusLabel = {
  available: 'Tersedia',
  reserved: 'Dipesan',
  sold: 'Terjual',
} as const

type ActionName = 'publish' | 'reserved' | 'sold' | 'archive' | 'duplicate' | 'delete'

function errorMessage(error: { message?: string }) {
  return error.message ?? 'Tindakan gagal. Coba lagi.'
}

export function VehicleTable({ initialVehicles }: { initialVehicles: Vehicle[] }) {
  const router = useRouter()
  const [items, setItems] = useState<Vehicle[]>(initialVehicles)
  const [query, setQuery] = useState('')
  const [availability, setAvailability] = useState('all')
  const [publication, setPublication] = useState('all')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      items.filter(
        (vehicle) =>
          `${vehicle.brand} ${vehicle.model} ${vehicle.variant}`
            .toLowerCase()
            .includes(query.toLowerCase()) &&
          (availability === 'all' || vehicle.availability === availability) &&
          (publication === 'all' || vehicle.publication === publication),
      ),
    [items, query, availability, publication],
  )

  const act = async (id: string, action: ActionName) => {
    if (action === 'delete') {
      if (
        !window.confirm(
          'Hapus kendaraan ini? Tindakan ini tidak dapat dibatalkan.',
        )
      ) {
        return
      }
    }

    setPendingId(id)

    try {
      if (action === 'delete') {
        const result = await deleteVehicleAction(id)
        if (!result.ok) {
          toast.error(errorMessage(result))
          return
        }
        setItems((current) => current.filter((vehicle) => vehicle.id !== id))
        toast.success('Kendaraan dihapus.')
      } else if (action === 'duplicate') {
        const result = await duplicateVehicleAction(id)
        if (!result.ok) {
          toast.error(errorMessage(result))
          return
        }
        setItems((current) => [result.data, ...current])
        toast.success('Duplikat draft dibuat.')
      } else {
        const result =
          action === 'publish'
            ? await publishVehicleAction(id)
            : action === 'reserved'
              ? await reserveVehicleAction(id)
              : action === 'sold'
                ? await sellVehicleAction(id)
                : await archiveVehicleAction(id)

        if (!result.ok) {
          toast.error(errorMessage(result))
          return
        }

        setItems((current) =>
          current.map((vehicle) => (vehicle.id === id ? result.data : vehicle)),
        )
        toast.success(
          action === 'publish'
            ? 'Kendaraan dipublikasikan.'
            : action === 'reserved'
              ? 'Kendaraan ditandai dipesan.'
              : action === 'sold'
                ? 'Kendaraan ditandai terjual.'
                : 'Kendaraan diarsipkan.',
        )
      }

      router.refresh()
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Kendaraan"
        description={`${filtered.length} dari ${items.length} unit`}
        action={
          <Link href="/admin/vehicles/new" aria-label="Tambah kendaraan">
            <AddButton>Tambah kendaraan</AddButton>
          </Link>
        }
      />
      <div className="mb-5 flex flex-col gap-3 md:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 size-4 text-neutral-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari merek, model, atau varian"
            className="h-11 w-full min-w-0 border border-neutral-200 bg-white pl-10 pr-3 text-base outline-none focus:border-neutral-950"
          />
        </div>
        <select
          value={availability}
          onChange={(event) => setAvailability(event.target.value)}
          className="h-11 min-w-0 border border-neutral-200 bg-white px-3 text-base md:text-sm"
        >
          <option value="all">Semua ketersediaan</option>
          <option value="available">Tersedia</option>
          <option value="reserved">Dipesan</option>
          <option value="sold">Terjual</option>
        </select>
        <select
          value={publication}
          onChange={(event) => setPublication(event.target.value)}
          className="h-11 min-w-0 border border-neutral-200 bg-white px-3 text-base md:text-sm"
        >
          <option value="all">Semua publikasi</option>
          <option value="published">Terbit</option>
          <option value="draft">Draft</option>
          <option value="archived">Arsip</option>
        </select>
      </div>
      <div className="overflow-hidden border border-neutral-200 bg-white">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="p-4 font-medium">Kendaraan</th>
                <th className="p-4 font-medium">Harga</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Publikasi</th>
                <th className="p-4 font-medium">Diperbarui</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((vehicle) => (
                <Row
                  key={vehicle.id}
                  vehicle={vehicle}
                  act={act}
                  pending={pendingId === vehicle.id}
                />
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-neutral-100 md:hidden">
          {filtered.map((vehicle) => (
            <MobileRow
              key={vehicle.id}
              vehicle={vehicle}
              act={act}
              pending={pendingId === vehicle.id}
            />
          ))}
        </div>
      </div>
    </>
  )
}

interface RowProps {
  vehicle: Vehicle
  act: (id: string, action: ActionName) => void
  pending: boolean
}

function Row({ vehicle, act, pending }: RowProps) {
  return (
    <tr>
      <td className="p-4">
        <p className="font-semibold">
          {vehicle.brand} {vehicle.model}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {vehicle.variant} · {vehicle.year} · {formatKm(vehicle.mileageKm)}
        </p>
      </td>
      <td className="p-4 font-medium">{formatRupiah(vehicle.price)}</td>
      <td className="p-4">
        <Status vehicle={vehicle} />
      </td>
      <td className="p-4 text-xs text-neutral-500">{vehicle.publication}</td>
      <td className="p-4 text-xs text-neutral-500">
        {vehicle.updatedAt.slice(0, 10)}
      </td>
      <td className="p-4">
        <Actions vehicle={vehicle} act={act} pending={pending} />
      </td>
    </tr>
  )
}

function MobileRow({ vehicle, act, pending }: RowProps) {
  return (
    <div className="flex items-start justify-between gap-4 p-4">
      <div>
        <p className="font-semibold">
          {vehicle.brand} {vehicle.model}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          {vehicle.variant} · {vehicle.year} · {formatKm(vehicle.mileageKm)}
        </p>
        <p className="mt-3 font-medium">{formatRupiah(vehicle.price)}</p>
        <div className="mt-2 flex gap-2">
          <Status vehicle={vehicle} />
          <span className="text-xs text-neutral-400">{vehicle.publication}</span>
        </div>
      </div>
      <Actions vehicle={vehicle} act={act} pending={pending} />
    </div>
  )
}

function Status({ vehicle }: { vehicle: Vehicle }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        vehicle.availability === 'available'
          ? 'text-emerald-700'
          : vehicle.availability === 'reserved'
            ? 'text-amber-700'
            : 'text-neutral-500'
      }`}
    >
      <CheckCircle2 className="size-3" />
      {statusLabel[vehicle.availability]}
    </span>
  )
}

function Actions({ vehicle, act, pending }: RowProps) {
  const buttonClass =
    'flex size-8 items-center justify-center border border-neutral-200 text-neutral-500 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {vehicle.publication === 'published' && (
        <Link
          href={`/cars/${vehicle.slug}`}
          target="_blank"
          className={buttonClass}
          title="Preview"
          aria-label={`Preview ${vehicle.brand} ${vehicle.model}`}
        >
          <ExternalLink className="size-3.5" />
        </Link>
      )}
      <Link
        href={`/admin/vehicles/${vehicle.id}/edit`}
        className={buttonClass}
        title="Ubah"
        aria-label={`Ubah ${vehicle.brand} ${vehicle.model}`}
      >
        <Pencil className="size-3.5" />
      </Link>
      {vehicle.publication !== 'published' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(vehicle.id, 'publish')}
          className={buttonClass}
          title="Terbitkan"
          aria-label={`Terbitkan ${vehicle.brand} ${vehicle.model}`}
        >
          <Upload className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => act(vehicle.id, 'duplicate')}
        className={buttonClass}
        title="Duplikat"
        aria-label={`Duplikat ${vehicle.brand} ${vehicle.model}`}
      >
        <Copy className="size-3.5" />
      </button>
      {vehicle.publication === 'published' &&
        vehicle.availability === 'available' && (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(vehicle.id, 'reserved')}
            className={buttonClass}
            title="Tandai dipesan"
            aria-label={`Tandai ${vehicle.brand} ${vehicle.model} dipesan`}
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        )}
      {vehicle.publication === 'published' && vehicle.availability !== 'sold' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(vehicle.id, 'sold')}
          className={buttonClass}
          title="Tandai terjual"
          aria-label={`Tandai ${vehicle.brand} ${vehicle.model} terjual`}
        >
          <CheckCircle2 className="size-3.5" />
        </button>
      )}
      {vehicle.publication !== 'archived' && (
        <button
          type="button"
          disabled={pending}
          onClick={() => act(vehicle.id, 'archive')}
          className={buttonClass}
          title="Arsipkan"
          aria-label={`Arsipkan ${vehicle.brand} ${vehicle.model}`}
        >
          <Archive className="size-3.5" />
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => act(vehicle.id, 'delete')}
        className={`${buttonClass} hover:text-red-600`}
        title="Hapus"
        aria-label={`Hapus ${vehicle.brand} ${vehicle.model}`}
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  )
}
