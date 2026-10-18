'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  Camera,
  ChevronDown,
  ChevronUp,
  GripVertical,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { brands, carCatalog, commonFeatures } from '@/data/car-catalog'
import {
  createVehicleAction,
  updateVehicleAction,
} from '@/lib/admin/vehicle-actions'
import type { Vehicle } from '@/lib/types'
import {
  vehicleInputSchema,
  slugifyVehicle,
  type VehicleFormValues,
} from '@/lib/validation/vehicle'

type Photo = {
  id: string
  url: string
  name: string
  progress: number
  isCover: boolean
}

const money = (value: number | string) =>
  new Intl.NumberFormat('id-ID').format(Number(value) || 0)

function emptyValues(): VehicleFormValues {
  return {
    brand: '',
    model: '',
    variant: '',
    year: new Date().getFullYear(),
    transmission: 'AT',
    fuel: 'bensin',
    bodyType: 'SUV',
    engineCc: 1500,
    mileageKm: 0,
    color: '',
    price: 0,
    plateRegion: '',
    taxExpiry: '',
    description: '',
    featured: false,
    location: 'Jakarta Selatan',
    features: [],
    ownerCount: 1,
    documents: { stnk: true, bpkb: true },
    publication: 'draft',
  }
}

function toFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    variant: vehicle.variant,
    year: vehicle.year,
    transmission: vehicle.transmission,
    fuel: vehicle.fuel,
    bodyType: vehicle.bodyType,
    engineCc: vehicle.engineCc,
    mileageKm: vehicle.mileageKm,
    color: vehicle.color,
    price: vehicle.price,
    plateRegion: vehicle.plateRegion,
    taxExpiry: vehicle.taxExpiry.slice(0, 10),
    description: vehicle.description,
    featured: vehicle.featured,
    location: vehicle.location,
    features: vehicle.features,
    ownerCount: vehicle.ownerCount,
    documents: vehicle.documents,
    publication: vehicle.publication,
  }
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-700">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

function FormSection({
  visible,
  title,
  children,
}: {
  visible: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      className={`${visible ? '' : 'hidden md:block'} rounded-xl border border-neutral-200 bg-white p-5`}
    >
      <h2 className="mb-4 font-bold">{title}</h2>
      {children}
    </section>
  )
}

function PhotoItem({
  photo,
  onDelete,
  onCover,
  onMove,
}: {
  photo: Photo
  onDelete: () => void
  onCover: () => void
  onMove: (direction: -1 | 1) => void
}) {
  const sortable = useSortable({ id: photo.id })

  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: sortable.transform
          ? `translate3d(${sortable.transform.x}px, ${sortable.transform.y}px, 0)`
          : undefined,
        transition: sortable.transition,
      }}
      className="group relative min-w-0 overflow-hidden rounded-lg border bg-white"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.name}
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="absolute left-2 top-2 flex gap-1">
        <button
          type="button"
          {...sortable.attributes}
          {...sortable.listeners}
          className="rounded bg-white/90 p-1.5"
          aria-label="Geser foto"
        >
          <GripVertical className="size-3.5" />
        </button>
        {photo.isCover && (
          <span className="rounded bg-neutral-950 px-2 py-1 text-[10px] text-white">
            COVER
          </span>
        )}
      </div>
      <div className="absolute right-2 top-2 flex gap-1 opacity-100 focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onMove(-1)}
          className="rounded bg-white p-1.5"
          aria-label="Naik"
        >
          <ChevronUp className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          className="rounded bg-white p-1.5"
          aria-label="Turun"
        >
          <ChevronDown className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded bg-white p-1.5 text-red-600"
          aria-label="Hapus foto"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={onCover}
        className="absolute inset-x-2 bottom-2 min-h-11 rounded bg-white/90 py-1 text-[10px] opacity-100 focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
      >
        Jadikan cover
      </button>
      {photo.progress < 100 && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-200">
          <div
            className="h-full bg-neutral-950"
            style={{ width: `${photo.progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const router = useRouter()
  const defaults = vehicle ? toFormValues(vehicle) : emptyValues()

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleInputSchema) as never,
    defaultValues: defaults,
    mode: 'onBlur',
  })

  const brand = useWatch({ control, name: 'brand' })
  const model = useWatch({ control, name: 'model' })
  const variant = useWatch({ control, name: 'variant' })
  const price = useWatch({ control, name: 'price' })
  const year = useWatch({ control, name: 'year' })
  const mileage = useWatch({ control, name: 'mileageKm' })

  const [photos, setPhotos] = useState<Photo[]>(
    vehicle?.images?.map((image, index) => ({
      id: image.id,
      url: image.url,
      name: image.alt,
      progress: 100,
      isCover: index === 0 || image.isCover,
    })) ?? [],
  )
  const [features, setFeatures] = useState<string[]>(vehicle?.features ?? [])
  const [feature, setFeature] = useState('')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)

  const slug = useMemo(
    () =>
      vehicle?.slug ??
      slugifyVehicle(
        [brand, model, variant].filter(Boolean).join(' '),
        year || '',
      ),
    [brand, model, variant, vehicle?.slug, year],
  )

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const addPhotos = (files: FileList | null) => {
    if (!files) return

    const incoming = Array.from(files).slice(0, 20 - photos.length)
    if (!incoming.length) {
      toast.error('Maksimal 20 foto')
      return
    }

    setBusy(true)
    const added = incoming.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      name: file.name,
      progress: 0,
      isCover: photos.length === 0 && index === 0,
    }))

    setPhotos((current) => [...current, ...added])
    added.forEach((photo, index) =>
      setTimeout(
        () =>
          setPhotos((items) =>
            items.map((item) =>
              item.id === photo.id ? { ...item, progress: 100 } : item,
            ),
          ),
        300 + index * 120,
      ),
    )
    setTimeout(() => setBusy(false), 700)
  }

  const submit = async (
    values: VehicleFormValues,
    override?: 'draft' | 'published',
  ) => {
    const payload = {
      ...values,
      features,
      documents: values.documents ?? { stnk: false, bpkb: false },
      ownerCount: values.ownerCount ?? 0,
      publication: override ?? values.publication ?? 'draft',
    }

    const result = vehicle
      ? await updateVehicleAction(vehicle.id, payload)
      : await createVehicleAction(payload)

    if (!result.ok) {
      if (result.fieldErrors) {
        for (const [key, messages] of Object.entries(result.fieldErrors)) {
          setError(key as keyof VehicleFormValues, {
            type: 'server',
            message: messages[0],
          })
        }
      }
      toast.error(result.message ?? 'Periksa kembali data kendaraan.')
      return
    }

    toast.success(
      payload.publication === 'published'
        ? 'Kendaraan dipublikasikan'
        : 'Kendaraan tersimpan',
    )

    if (!vehicle) {
      router.push('/admin/vehicles')
      router.refresh()
      return
    }

    reset({ ...payload, publication: result.data.publication })
    router.refresh()
  }

  const drag = (event: DragEndEvent) => {
    if (event.over && event.active.id !== event.over.id) {
      setPhotos((current) =>
        arrayMove(
          current,
          current.findIndex((photo) => photo.id === event.active.id),
          current.findIndex((photo) => photo.id === event.over?.id),
        ),
      )
    }
  }

  const err = (key: keyof VehicleFormValues) =>
    errors[key]?.message as string | undefined
  const input =
    'h-10 rounded-md border border-neutral-200 bg-white px-3 text-sm'

  return (
    <form onSubmit={handleSubmit((values) => submit(values))} className="pb-40 md:pb-28">
      <div className="mb-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Prima Auto Gallery
        </p>
        <h1 className="text-2xl font-bold">
          {vehicle ? 'Edit kendaraan' : 'Tambah kendaraan'}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Foto menjadi langkah pertama untuk staff.
        </p>
      </div>
      <div className="mb-6 flex gap-1 overflow-x-auto border-b md:hidden">
        {['Foto', 'Dasar', 'Harga', 'Detail', 'Publikasi'].map((label, index) => (
          <button
            type="button"
            key={label}
            onClick={() => setStep(index)}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-xs font-semibold ${
              step === index
                ? 'border-neutral-950'
                : 'border-transparent text-neutral-400'
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="flex flex-col gap-6">
          <FormSection visible={step === 0} title="Foto kendaraan">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">
                  {photos.length}/20 foto · pertama menjadi cover default
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Unggahan foto tersimpan pada tahap pengelolaan media.
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-md bg-neutral-950 px-3 py-2 text-xs font-semibold text-white">
                <Camera className="size-3.5" />
                Pilih foto
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) => addPhotos(event.target.files)}
                />
              </label>
            </div>
            <DndContext
              id="vehicle-photo-sortable"
              collisionDetection={closestCenter}
              onDragEnd={drag}
            >
              <SortableContext
                items={photos.map((photo) => photo.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map((photo, index) => (
                    <PhotoItem
                      key={photo.id}
                      photo={photo}
                      onDelete={() =>
                        setPhotos(photos.filter((item) => item.id !== photo.id))
                      }
                      onCover={() =>
                        setPhotos(
                          photos.map((item) => ({
                            ...item,
                            isCover: item.id === photo.id,
                          })),
                        )
                      }
                      onMove={(direction) => {
                        const next = index + direction
                        if (next >= 0 && next < photos.length) {
                          setPhotos(arrayMove(photos, index, next))
                        }
                      }}
                    />
                  ))}
                  <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-neutral-400">
                    <ImagePlus className="size-6" />
                    <span className="text-xs">Tambah foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(event) => addPhotos(event.target.files)}
                    />
                  </label>
                </div>
              </SortableContext>
            </DndContext>
            {busy && (
              <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="size-3.5 animate-spin" />
                Menyiapkan pratinjau foto...
              </p>
            )}
          </FormSection>

          <FormSection visible={step === 1} title="Dasar kendaraan">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Brand" error={err('brand')}>
                <select {...register('brand')} className={input}>
                  <option value="">Pilih brand</option>
                  {brands.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
              <Field label="Model" error={err('model')}>
                <select {...register('model')} disabled={!brand} className={input}>
                  <option value="">Pilih model</option>
                  {brand &&
                    carCatalog[brand as keyof typeof carCatalog]?.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                </select>
              </Field>
              <Field label="Varian" error={err('variant')}>
                <input {...register('variant')} className={input} />
              </Field>
              <Field label="Tahun" error={err('year')}>
                <input
                  {...register('year', { valueAsNumber: true })}
                  type="number"
                  className={input}
                />
              </Field>
              <Field label="Warna" error={err('color')}>
                <input {...register('color')} className={input} />
              </Field>
              <Field label="Tipe bodi" error={err('bodyType')}>
                <input {...register('bodyType')} className={input} />
              </Field>
            </div>
          </FormSection>

          <FormSection visible={step === 2} title="Harga">
            <Field label="Harga jual (Rupiah)" error={err('price')}>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <input
                    value={money(field.value)}
                    onChange={(event) =>
                      field.onChange(+event.target.value.replace(/\D/g, ''))
                    }
                    inputMode="numeric"
                    className="h-11 w-full rounded-md border px-3 text-lg font-semibold"
                  />
                )}
              />
            </Field>
            <p className="mt-1 text-xs text-neutral-400">Rp {money(price)}</p>
            <div className="mt-4">
              <Field label="Deskripsi" error={err('description')}>
                <textarea
                  {...register('description')}
                  rows={4}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection visible={step === 3} title="Detail">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jarak tempuh (km)" error={err('mileageKm')}>
                <input
                  {...register('mileageKm', { valueAsNumber: true })}
                  type="number"
                  className={input}
                />
              </Field>
              <Field label="Transmisi">
                <select {...register('transmission')} className={input}>
                  <option>AT</option>
                  <option>CVT</option>
                  <option>MT</option>
                </select>
              </Field>
              <Field label="Bahan bakar">
                <select {...register('fuel')} className={input}>
                  <option value="bensin">Bensin</option>
                  <option value="diesel">Diesel</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="listrik">Listrik</option>
                </select>
              </Field>
              <Field label="Pajak berlaku sampai" error={err('taxExpiry')}>
                <input
                  {...register('taxExpiry')}
                  type="date"
                  className={input}
                />
              </Field>
              <Field label="Kapasitas mesin (cc)" error={err('engineCc')}>
                <input
                  {...register('engineCc', { valueAsNumber: true })}
                  type="number"
                  className={input}
                />
              </Field>
              <Field label="Plat nomor" error={err('plateRegion')}>
                <input {...register('plateRegion')} className={input} />
              </Field>
              <Field label="Lokasi unit" error={err('location')}>
                <input {...register('location')} className={input} />
              </Field>
              <Field label="Jumlah pemilik" error={err('ownerCount')}>
                <input
                  {...register('ownerCount', { valueAsNumber: true })}
                  type="number"
                  className={input}
                />
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap gap-5">
              <label className="flex items-center gap-3 text-sm">
                <input
                  {...register('documents.stnk')}
                  type="checkbox"
                  className="size-4"
                />
                STNK tersedia
              </label>
              <label className="flex items-center gap-3 text-sm">
                <input
                  {...register('documents.bpkb')}
                  type="checkbox"
                  className="size-4"
                />
                BPKB tersedia
              </label>
            </div>
            <div className="mt-5">
              <span className="mb-2 block text-sm font-medium">Fitur</span>
              <div className="flex min-h-11 flex-wrap gap-2 rounded-md border p-2">
                {features.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-xs"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() =>
                        setFeatures(features.filter((value) => value !== item))
                      }
                      aria-label={`Hapus ${item}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={feature}
                  onChange={(event) => setFeature(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      if (feature && !features.includes(feature)) {
                        setFeatures([...features, feature])
                      }
                      setFeature('')
                    }
                  }}
                  placeholder="Tambah fitur..."
                  className="min-w-32 flex-1 text-sm outline-none"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {commonFeatures
                  .filter((item) => !features.includes(item))
                  .slice(0, 5)
                  .map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setFeatures([...features, item])}
                      className="rounded-full border px-2 py-1 text-[11px] text-neutral-500"
                    >
                      + {item}
                    </button>
                  ))}
              </div>
            </div>
          </FormSection>

          <FormSection visible={step === 4} title="Publikasi">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <Field label="Status publikasi">
                <select {...register('publication')} className={input}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Arsip</option>
                </select>
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <input
                  {...register('featured')}
                  type="checkbox"
                  className="size-4"
                />
                Tampilkan sebagai unit unggulan
              </label>
            </div>
          </FormSection>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-xl border bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
              Live preview
            </p>
            {photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photos[0].url}
                alt="Preview kendaraan"
                className="aspect-[4/3] w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
                Belum ada foto
              </div>
            )}
            <p className="mt-3 text-xs text-neutral-400">
              {brand || 'Brand'} · {model || 'Model'}
            </p>
            <p className="font-bold">{variant || 'Varian kendaraan'}</p>
            <p className="mt-2 font-semibold">Rp {money(price)}</p>
            <p className="text-xs text-neutral-500">
              {year} · {mileage || 0} km
            </p>
            <p className="mt-4 border-t pt-3 text-xs text-neutral-500">
              /cars/{slug || 'slug-kendaraan'}
            </p>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex justify-end gap-2 border-t bg-white/95 px-5 py-3 backdrop-blur md:bottom-0 lg:left-64">
        <button
          type="button"
          disabled={isSubmitting || busy}
          onClick={handleSubmit((values) => submit(values, 'draft'))}
          className="flex h-10 items-center gap-2 border px-4 text-sm font-semibold"
        >
          <Save className="size-4" />
          Simpan draft
        </button>
        <button
          type="button"
          disabled={isSubmitting || busy}
          onClick={handleSubmit((values) => submit(values, 'published'))}
          className="h-10 bg-neutral-950 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Publikasikan
        </button>
      </div>
    </form>
  )
}
