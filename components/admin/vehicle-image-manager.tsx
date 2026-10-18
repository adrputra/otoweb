'use client'

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import {
  Camera,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { uploadFileWithProgress, type UploadProgress } from '@/lib/media/client-upload'
import {
  ACCEPTED_IMAGE_ACCEPT,
  isAcceptedImageType,
  MAX_IMAGE_BYTES,
  MAX_VEHICLE_IMAGES,
} from '@/lib/media/limits'
import type { VehicleImage } from '@/lib/types'

export interface VehicleImageManagerHandle {
  hasPendingUploads: () => boolean
  uploadPending: (vehicleId: string) => Promise<{ uploaded: number; failures: string[] }>
}

export interface VehicleImageManagerProps {
  vehicleId?: string
  initialImages?: VehicleImage[]
  onCoverPreviewChange?: (url: string | undefined) => void
  onBusyChange?: (busy: boolean) => void
  ref?: Ref<VehicleImageManagerHandle>
}

type PhotoStatus = 'stored' | 'queued' | 'uploading' | 'error'

interface ManagedPhoto {
  key: string
  serverId?: string
  url: string
  thumbnailUrl?: string
  alt: string
  progress: number
  status: PhotoStatus
  error?: string
  isCover: boolean
  removing?: boolean
  file?: File
  objectUrl?: string
}

interface UploadResponse {
  image: VehicleImage
  deduplicated: boolean
}

interface ImageListResponse {
  ok?: boolean
  data?: { images: VehicleImage[] }
  message?: string
}

function altForFile(file: File): string {
  const readable = file.name
    .replace(/\.[^./\\]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .slice(0, 160)
  return readable || 'Foto kendaraan'
}

function fromServerImage(image: VehicleImage): ManagedPhoto {
  return {
    key: image.id,
    serverId: image.id,
    url: image.url,
    thumbnailUrl: image.thumbnailUrl,
    alt: image.alt,
    progress: 100,
    status: 'stored',
    isCover: image.isCover,
  }
}

function initialPhotos(images: readonly VehicleImage[]): ManagedPhoto[] {
  return images.map(fromServerImage)
}

function previewSource(photo: ManagedPhoto): string {
  return photo.thumbnailUrl ?? photo.url
}

let localPhotoSequence = 0

function nextLocalPhotoKey(): string {
  localPhotoSequence += 1
  return `local-${localPhotoSequence}`
}

export function VehicleImageManager({
  vehicleId,
  initialImages = [],
  onCoverPreviewChange,
  onBusyChange,
  ref,
}: VehicleImageManagerProps) {
  const [photos, setPhotos] = useState<ManagedPhoto[]>(() => initialPhotos(initialImages))
  const photosRef = useRef(photos)
  const desiredCoverKey = useRef<string | null>(
    initialImages.find((image) => image.isCover)?.id ?? initialImages[0]?.id ?? null,
  )
  const coverPhoto = photos.find((photo) => photo.isCover) ?? photos[0]
  const coverUrl = coverPhoto ? previewSource(coverPhoto) : undefined

  useEffect(() => {
    onCoverPreviewChange?.(coverUrl)
  }, [coverUrl, onCoverPreviewChange])

  useEffect(() => {
    onBusyChange?.(photos.some((photo) => photo.status === 'uploading'))
  }, [photos, onBusyChange])

  const commit = (next: ManagedPhoto[]) => {
    photosRef.current = next
    setPhotos(next)
  }

  const patchPhoto = (key: string, patch: Partial<ManagedPhoto>) => {
    commit(photosRef.current.map((photo) => (photo.key === key ? { ...photo, ...patch } : photo)))
  }

  const reportBusy = (next: ManagedPhoto[]) => {
    onBusyChange?.(next.some((photo) => photo.status === 'uploading'))
  }

  const applyServerImages = (images: VehicleImage[]) => {
    const locals = photosRef.current.filter((photo) => !photo.serverId)
    const next = [...images.map(fromServerImage), ...locals]
    const cover = images.find((image) => image.isCover)
    if (cover) desiredCoverKey.current = cover.id
    commit(next)
    reportBusy(next)
  }

  const uploadOne = async (
    key: string,
    file: File,
    alt: string,
    vehicle: string,
  ): Promise<VehicleImage | null> => {
    patchPhoto(key, { status: 'uploading', progress: 0, error: undefined })
    reportBusy(photosRef.current)

    const result = await uploadFileWithProgress<UploadResponse>({
      url: `/api/admin/vehicles/${vehicle}/images`,
      file,
      alt,
      onProgress: ({ percent }: UploadProgress) => {
        patchPhoto(key, { progress: percent })
      },
    })

    if (!result.ok) {
      patchPhoto(key, { status: 'error', error: result.error.message })
      reportBusy(photosRef.current)
      return null
    }

    const image = result.data.image
    const duplicate = photosRef.current.some(
      (photo) => photo.key !== key && photo.serverId === image.id,
    )

    if (duplicate) {
      const removed = photosRef.current.find((photo) => photo.key === key)
      if (removed?.objectUrl) URL.revokeObjectURL(removed.objectUrl)
      commit(photosRef.current.filter((photo) => photo.key !== key))
      reportBusy(photosRef.current)
      return image
    }

    const previous = photosRef.current.find((photo) => photo.key === key)
    if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl)

    patchPhoto(key, {
      serverId: image.id,
      url: image.url,
      thumbnailUrl: image.thumbnailUrl,
      alt: image.alt,
      progress: 100,
      status: 'stored',
      error: undefined,
      isCover: image.isCover,
      file: undefined,
      objectUrl: undefined,
    })
    if (image.isCover) desiredCoverKey.current = key
    reportBusy(photosRef.current)
    return image
  }

  const uploadMany = async (
    entries: { key: string; file: File; alt: string }[],
    vehicle: string,
  ): Promise<{ uploaded: number; failures: string[] }> => {
    let uploaded = 0
    const failures: string[] = []

    for (const entry of entries) {
      const image = await uploadOne(entry.key, entry.file, entry.alt, vehicle)
      if (image) uploaded += 1
      else failures.push(entry.alt)
    }

    return { uploaded, failures }
  }

  const patchJson = async (body: unknown): Promise<{ ok: true; images: VehicleImage[] } | { ok: false; message: string }> => {
    if (!vehicleId) return { ok: false, message: 'Simpan draft terlebih dahulu.' }

    try {
      const response = await fetch(`/api/admin/vehicles/${vehicleId}/images`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json().catch(() => null)) as ImageListResponse | null

      if (!response.ok || !payload?.ok || !payload.data?.images) {
        return { ok: false, message: payload?.message ?? 'Gagal menyimpan perubahan foto.' }
      }

      return { ok: true, images: payload.data.images }
    } catch {
      return { ok: false, message: 'Koneksi terputus saat menyimpan perubahan foto.' }
    }
  }

  const chooseCover = async (photo: ManagedPhoto) => {
    if (!photo.serverId) {
      desiredCoverKey.current = photo.key
      commit(photosRef.current.map((item) => ({ ...item, isCover: item.key === photo.key })))
      return
    }
    if (photo.isCover) return

    const previous = photosRef.current
    const previousCover = desiredCoverKey.current
    desiredCoverKey.current = photo.key
    commit(previous.map((item) => ({ ...item, isCover: item.key === photo.key })))

    const result = await patchJson({ action: 'cover', imageId: photo.serverId })
    if (!result.ok) {
      desiredCoverKey.current = previousCover
      commit(previous)
      toast.error(result.message)
      return
    }

    applyServerImages(result.images)
  }

  const persistDesiredCover = async () => {
    const key = desiredCoverKey.current
    if (!key || !vehicleId) return

    const desired = photosRef.current.find((photo) => photo.key === key && photo.serverId)
    const current = photosRef.current.find((photo) => photo.isCover && photo.serverId)
    if (!desired?.serverId || current?.serverId === desired.serverId) return

    const result = await patchJson({ action: 'cover', imageId: desired.serverId })
    if (result.ok) applyServerImages(result.images)
  }

  const reorderStored = async (next: ManagedPhoto[]) => {
    const previous = photosRef.current
    if (next.some((photo) => !photo.serverId)) {
      toast.error('Tunggu semua foto selesai diunggah sebelum mengubah urutan.')
      return
    }

    commit(next)

    const result = await patchJson({
      action: 'reorder',
      imageIds: next.map((photo) => photo.serverId),
    })

    if (!result.ok) {
      commit(previous)
      toast.error(result.message)
      return
    }

    applyServerImages(result.images)
  }

  const movePhoto = (photo: ManagedPhoto, direction: -1 | 1) => {
    const current = photosRef.current
    const index = current.findIndex((item) => item.key === photo.key)
    const target = index + direction
    if (index < 0 || target < 0 || target >= current.length) return
    if (!current[index]?.serverId || !current[target]?.serverId) {
      toast.error('Tunggu semua foto selesai diunggah sebelum mengubah urutan.')
      return
    }
    void reorderStored(arrayMove(current, index, target))
  }

  const drag = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return
    const current = photosRef.current
    const from = current.findIndex((photo) => photo.key === event.active.id)
    const to = current.findIndex((photo) => photo.key === event.over?.id)
    if (from < 0 || to < 0) return
    void reorderStored(arrayMove(current, from, to))
  }

  const removePhoto = async (photo: ManagedPhoto) => {
    if (!photo.serverId) {
      if (photo.objectUrl) URL.revokeObjectURL(photo.objectUrl)
      commit(photosRef.current.filter((item) => item.key !== photo.key))
      if (desiredCoverKey.current === photo.key) {
        desiredCoverKey.current = photosRef.current[0]?.key ?? null
      }
      return
    }

    patchPhoto(photo.key, { removing: true })

    try {
      const response = await fetch(
        `/api/admin/vehicles/${vehicleId}/images/${photo.serverId}`,
        { method: 'DELETE' },
      )
      const payload = (await response.json().catch(() => null)) as ImageListResponse | null

      if (!response.ok || !payload?.ok || !payload.data?.images) {
        patchPhoto(photo.key, { removing: false })
        toast.error(payload?.message ?? 'Gagal menghapus foto.')
        return
      }

      applyServerImages(payload.data.images)
      toast.success('Foto dihapus.')
    } catch {
      patchPhoto(photo.key, { removing: false })
      toast.error('Koneksi terputus saat menghapus foto.')
    }
  }

  const retry = async (photo: ManagedPhoto) => {
    if (!photo.file) return
    if (!vehicleId) {
      patchPhoto(photo.key, { status: 'queued', error: undefined, progress: 0 })
      return
    }
    await uploadOne(photo.key, photo.file, photo.alt, vehicleId)
    await persistDesiredCover()
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return

    const current = photosRef.current
    const added: ManagedPhoto[] = []
    const rejected: string[] = []

    for (const file of Array.from(files)) {
      if (current.length + added.length >= MAX_VEHICLE_IMAGES) {
        rejected.push(`Maksimal ${MAX_VEHICLE_IMAGES} foto per kendaraan.`)
        break
      }
      if (file.type && !isAcceptedImageType(file.type)) {
        rejected.push(`${file.name}: format tidak didukung.`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        rejected.push(`${file.name}: melebihi 10 MB.`)
        continue
      }

      const key = nextLocalPhotoKey()
      const objectUrl = URL.createObjectURL(file)
      added.push({
        key,
        url: objectUrl,
        objectUrl,
        alt: altForFile(file),
        progress: 0,
        status: vehicleId ? 'uploading' : 'queued',
        isCover: current.length + added.length === 0,
        file,
      })
      if (desiredCoverKey.current === null && current.length + added.length === 0) {
        desiredCoverKey.current = key
      }
    }

    if (rejected.length > 0) {
      toast.error(
        rejected.length === 1
          ? (rejected[0] ?? 'Foto tidak dapat ditambahkan.')
          : `${rejected[0]} (+${rejected.length - 1} lainnya)`,
      )
    }

    if (added.length === 0) return

    const next = [...current, ...added]
    commit(next)
    reportBusy(next)

    if (vehicleId) {
      void uploadMany(
        added.map((photo) => ({ key: photo.key, file: photo.file as File, alt: photo.alt })),
        vehicleId,
      ).then(() => persistDesiredCover())
    }
  }

  useImperativeHandle(ref, () => ({
    hasPendingUploads: () =>
      photosRef.current.some(
        (photo) => photo.file !== undefined && (photo.status === 'queued' || photo.status === 'error'),
      ),
    uploadPending: async (vehicle: string) => {
      const pending = photosRef.current.filter(
        (photo) => photo.file && (photo.status === 'queued' || photo.status === 'error'),
      )
      if (pending.length === 0) return { uploaded: 0, failures: [] }

      const result = await uploadMany(
        pending.map((photo) => ({ key: photo.key, file: photo.file as File, alt: photo.alt })),
        vehicle,
      )
      await persistDesiredCover()
      return result
    },
  }))

  const uploadCount = photos.filter((photo) => photo.status === 'uploading').length
  const failedCount = photos.filter((photo) => photo.status === 'error').length
  const allStored = photos.every((photo) => photo.status === 'stored')

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-neutral-500" data-testid="photo-count">
            {photos.length}/{MAX_VEHICLE_IMAGES} foto · pertama menjadi cover default
          </p>
          <p className="mt-1 text-[11px] text-neutral-400">
            JPEG, PNG, WebP · maks 10 MB · minimal 640×480. Tarik atau gunakan panah untuk
            mengurutkan.
          </p>
        </div>
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 bg-neutral-950 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800">
          <Camera className="size-3.5" />
          Pilih foto
          <input
            type="file"
            accept={ACCEPTED_IMAGE_ACCEPT}
            multiple
            className="sr-only"
            aria-label="Pilih foto kendaraan"
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ''
            }}
          />
        </label>
      </div>

      <DndContext id="vehicle-photo-sortable" collisionDetection={closestCenter} onDragEnd={drag}>
        <SortableContext items={photos.map((photo) => photo.key)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((photo, index) => (
              <PhotoTile
                key={photo.key}
                photo={photo}
                canMoveUp={index > 0 && allStored}
                canMoveDown={index < photos.length - 1 && allStored}
                onDelete={() => void removePhoto(photo)}
                onCover={() => void chooseCover(photo)}
                onMove={(direction) => movePhoto(photo, direction)}
                onRetry={() => void retry(photo)}
              />
            ))}
            {photos.length < MAX_VEHICLE_IMAGES && (
              <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-600">
                <ImagePlus className="size-6" />
                <span className="text-xs">Tambah foto</span>
                <input
                  type="file"
                  accept={ACCEPTED_IMAGE_ACCEPT}
                  multiple
                  className="sr-only"
                  aria-label="Tambah foto kendaraan"
                  onChange={(event) => {
                    addFiles(event.target.files)
                    event.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3 min-h-5 text-xs text-neutral-500" aria-live="polite">
        {uploadCount > 0 && (
          <span className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" />
            Mengunggah {uploadCount} foto...
          </span>
        )}
        {uploadCount === 0 && failedCount > 0 && (
          <span className="text-red-600">
            {failedCount} foto gagal diunggah. Gunakan tombol coba lagi pada foto.
          </span>
        )}
        {uploadCount === 0 && failedCount === 0 && photos.length > 0 && (
          <span>Urutan dan cover tersimpan otomatis.</span>
        )}
      </div>
    </div>
  )
}

function PhotoTile({
  photo,
  canMoveUp,
  canMoveDown,
  onDelete,
  onCover,
  onMove,
  onRetry,
}: {
  photo: ManagedPhoto
  canMoveUp: boolean
  canMoveDown: boolean
  onDelete: () => void
  onCover: () => void
  onMove: (direction: -1 | 1) => void
  onRetry: () => void
}) {
  const {
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
  } = useSortable({
    id: photo.key,
    disabled: photo.status !== 'stored' || photo.removing === true,
  })
  const controlClass =
    'flex size-8 items-center justify-center bg-white/95 text-neutral-700 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
        transition,
      }}
      className="group relative min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white"
      data-testid="vehicle-photo"
      data-cover={photo.isCover ? 'true' : 'false'}
      data-status={photo.status}
      data-alt={photo.alt}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewSource(photo)}
        alt={photo.alt}
        className="aspect-[4/3] w-full object-cover"
        loading="lazy"
      />

      <div className="absolute left-2 top-2 flex gap-1">
        {photo.status === 'stored' && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className={controlClass}
            aria-label={`Geser ${photo.alt}`}
          >
            <GripVertical className="size-3.5" />
          </button>
        )}
        {photo.isCover && (
          <span className="rounded bg-neutral-950 px-2 py-1 text-[10px] font-semibold text-white">
            COVER
          </span>
        )}
        {photo.removing && (
          <span className="rounded bg-white/95 px-2 py-1 text-[10px] font-semibold text-neutral-600">
            Menghapus...
          </span>
        )}
      </div>

      <div className="absolute right-2 top-2 flex gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={!canMoveUp || photo.removing}
          className={controlClass}
          aria-label={`Naikkan ${photo.alt}`}
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={!canMoveDown || photo.removing}
          className={controlClass}
          aria-label={`Turunkan ${photo.alt}`}
        >
          <ChevronDown className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={photo.removing}
          className={`${controlClass} text-red-600 hover:text-red-700`}
          aria-label={`Hapus ${photo.alt}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {!photo.isCover && photo.status === 'stored' && (
        <button
          type="button"
          onClick={onCover}
          className="absolute inset-x-2 bottom-2 min-h-9 rounded bg-white/95 py-1 text-[10px] font-semibold text-neutral-800 hover:bg-white"
        >
          Jadikan cover
        </button>
      )}

      {photo.status === 'uploading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/55 text-white">
          <Loader2 className="size-5 animate-spin" />
          <span className="text-[11px] font-semibold">{photo.progress}%</span>
          <div
            className="h-1 w-2/3 overflow-hidden rounded bg-white/30"
            role="progressbar"
            aria-label={`Progres unggahan ${photo.alt}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={photo.progress}
          >
            <div className="h-full bg-white" style={{ width: `${photo.progress}%` }} />
          </div>
        </div>
      )}

      {photo.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/95 p-3 text-center">
          <span className="text-[11px] font-semibold text-red-600">Gagal diunggah</span>
          <span className="line-clamp-2 text-[10px] text-neutral-500">{photo.error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-9 items-center gap-1.5 border border-neutral-300 px-2 py-1 text-[10px] font-semibold hover:border-neutral-400"
          >
            <RefreshCw className="size-3" />
            Coba lagi
          </button>
        </div>
      )}

      {photo.status === 'queued' && (
        <div className="absolute inset-x-2 bottom-2 rounded bg-white/95 py-1 text-center text-[10px] text-neutral-600">
          Menunggu disimpan
        </div>
      )}
    </div>
  )
}
