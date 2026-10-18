'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, Link2, Save, TriangleAlert, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { updateShowroomSettingsAction } from '@/lib/admin/showroom-settings-actions'
import {
  ACCEPTED_IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  isAcceptedImageType,
} from '@/lib/media/limits'
import { uploadFileWithProgress } from '@/lib/media/client-upload'
import { contrastRatio, relativeLuminance, showroomThemeStyle } from '@/lib/theme'
import {
  showroomSettingsInputSchema,
  type ShowroomSettingsInput,
} from '@/lib/validation/showroom-settings'

type UploadKind = 'logo' | 'hero'

const inputClass =
  'h-10 w-full border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100'
const textareaClass =
  'min-h-24 w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100'
const labelClass = 'mb-1.5 block text-xs font-semibold text-neutral-600'

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-neutral-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-200 bg-white p-5">
      <h2 className="mb-5 text-sm font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'

  return (
    <div>
      <span className={labelClass}>{label}</span>
      <div className="flex items-stretch gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={safe}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer border border-neutral-200 bg-white p-1"
        />
        <input
          type="text"
          name={label === 'Warna utama' ? 'primaryColor' : 'secondaryColor'}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
          placeholder="#b88a44"
        />
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  )
}

function MediaPreview({ src, name }: { src: string; name: string }) {
  const valid = src.startsWith('/') || /^https?:\/\//i.test(src)
  const image = valid && src ? src : ''

  return (
    <div className="relative flex h-24 items-center justify-center overflow-hidden border border-neutral-200 bg-neutral-50">
      {image ? (
        <Image src={image} alt="" fill sizes="320px" className="object-contain p-2" />
      ) : (
        <span className="px-4 text-center text-xs font-medium text-neutral-400">
          {name}
        </span>
      )}
    </div>
  )
}

function UploadControl({
  kind,
  label,
  value,
  onChange,
  uploading,
  onUpload,
}: {
  kind: UploadKind
  label: string
  value: string
  onChange: (value: string) => void
  uploading: { kind: UploadKind; percent: number } | null
  onUpload: (kind: UploadKind, file: File | null) => void
}) {
  const busy = uploading?.kind === kind

  return (
    <div className="flex flex-col gap-3">
      <MediaPreview src={value} name={kind === 'logo' ? 'Belum ada logo' : 'Belum ada gambar hero'} />
      <div className="flex items-center gap-2">
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:border-neutral-400">
          <Upload className="size-3.5" />
          {busy ? `${uploading.percent}%` : label}
          <input
            type="file"
            accept={ACCEPTED_IMAGE_ACCEPT}
            className="sr-only"
            disabled={Boolean(uploading)}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              onUpload(kind, file)
              event.target.value = ''
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs font-medium text-neutral-500 underline-offset-4 hover:underline"
          >
            Hapus
          </button>
        )}
      </div>
    </div>
  )
}

export function ShowroomSettingsForm({
  initialValues,
}: {
  initialValues: ShowroomSettingsInput
}) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ShowroomSettingsInput>({
    resolver: zodResolver(showroomSettingsInputSchema) as never,
    defaultValues: initialValues,
    mode: 'onBlur',
  })

  const values = useWatch({ control, defaultValue: initialValues })
  const [uploading, setUploading] = useState<{ kind: UploadKind; percent: number } | null>(null)

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

  const handleUpload = async (kind: UploadKind, file: File | null) => {
    if (!file) return
    if (!isAcceptedImageType(file.type)) {
      toast.error('Format gambar harus JPEG, PNG, atau WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Ukuran gambar maksimal 10 MB.')
      return
    }

    const field = kind === 'logo' ? 'logoUrl' : 'heroImageUrl'
    setUploading({ kind, percent: 0 })

    const result = await uploadFileWithProgress<{ url: string }>({
      url: '/api/admin/settings/media',
      file,
      fields: { kind },
      onProgress: (progress) => setUploading({ kind, percent: progress.percent }),
    })

    setUploading(null)

    if (!result.ok) {
      toast.error(result.error.message)
      return
    }

    setValue(field, result.data.url, { shouldDirty: true, shouldValidate: true })
    toast.success(kind === 'logo' ? 'Logo berhasil diunggah.' : 'Gambar hero berhasil diunggah.')
  }

  const onSubmit = handleSubmit(async (submitted) => {
    try {
      const result = await updateShowroomSettingsAction(submitted)

      if (!result.ok) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            if (messages[0]) {
              setError(field as keyof ShowroomSettingsInput, {
                type: 'server',
                message: messages[0],
              })
            }
          }
        }
        toast.error(result.message ?? 'Periksa kembali profil showroom.')
        return
      }

      reset(result.data.values)
      toast.success('Profil showroom disimpan.')
    } catch {
      toast.error('Profil showroom belum tersimpan. Coba lagi.')
    }
  })

  const primary = values.primaryColor || '#b88a44'
  const secondary = values.secondaryColor || '#171717'
  const theme = showroomThemeStyle({ primary, secondary })
  const previewHero =
    values.heroImageUrl?.startsWith('/') || /^https?:\/\//i.test(values.heroImageUrl ?? '')
      ? (values.heroImageUrl ?? '/placeholder.jpg')
      : '/placeholder.jpg'
  const lightPrimary = relativeLuminance(primary) > 0.5 || contrastRatio(primary, '#ffffff') < 3

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin/settings"
          className="flex size-8 items-center justify-center border border-neutral-200 bg-white text-neutral-500 transition hover:text-neutral-950"
          aria-label="Kembali"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Pengaturan
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Profil showroom</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Perubahan tampil di halaman publik setelah disimpan.
          </p>
        </div>
      </div>

      <form id="showroom-form" onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <Section title="Identitas">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama showroom" error={errors.displayName?.message}>
                <input
                  {...register('displayName')}
                  className={inputClass}
                  placeholder="Nama showroom"
                />
              </Field>
              <Field label="Tagline" error={errors.tagline?.message}>
                <input {...register('tagline')} className={inputClass} placeholder="Tagline" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Deskripsi" error={errors.description?.message}>
                  <textarea
                    {...register('description')}
                    className={textareaClass}
                    placeholder="Deskripsi showroom"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                <UploadControl
                  kind="logo"
                  label="Unggah logo"
                  value={values.logoUrl ?? ''}
                  onChange={(value) =>
                    setValue('logoUrl', value, { shouldDirty: true, shouldValidate: true })
                  }
                  uploading={uploading}
                  onUpload={handleUpload}
                />
                <UploadControl
                  kind="hero"
                  label="Unggah hero"
                  value={values.heroImageUrl ?? ''}
                  onChange={(value) =>
                    setValue('heroImageUrl', value, { shouldDirty: true, shouldValidate: true })
                  }
                  uploading={uploading}
                  onUpload={handleUpload}
                />
              </div>
              <Field label="Logo URL" error={errors.logoUrl?.message}>
                <input
                  {...register('logoUrl')}
                  className={inputClass}
                  placeholder="https://... atau /uploads/..."
                />
              </Field>
              <Field label="Hero image URL" error={errors.heroImageUrl?.message}>
                <input
                  {...register('heroImageUrl')}
                  className={inputClass}
                  placeholder="https://... atau /uploads/..."
                />
              </Field>
            </div>
          </Section>

          <Section title="Brand">
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="primaryColor"
                render={({ field }) => (
                  <ColorField
                    label="Warna utama"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.primaryColor?.message}
                  />
                )}
              />
              <Controller
                control={control}
                name="secondaryColor"
                render={({ field }) => (
                  <ColorField
                    label="Warna sekunder"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.secondaryColor?.message}
                  />
                )}
              />
            </div>
            {lightPrimary && (
              <div className="mt-4 flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                Warna utama cukup terang. Aksen teks publik otomatis digelapkan agar tetap
                terbaca, dan teks pada permukaan berwarna mengikuti kontras yang aman.
              </div>
            )}
          </Section>

          <Section title="Kontak">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telepon" error={errors.phone?.message}>
                <input {...register('phone')} className={inputClass} placeholder="+6221..." />
              </Field>
              <Field label="WhatsApp" error={errors.whatsapp?.message}>
                <input {...register('whatsapp')} className={inputClass} placeholder="62812..." />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <input
                  {...register('email')}
                  className={inputClass}
                  placeholder="halo@showroom.id"
                  type="email"
                />
              </Field>
              <Field label="Jam buka" error={errors.openingHours?.message}>
                <input
                  {...register('openingHours')}
                  className={inputClass}
                  placeholder="Senin–Sabtu, 08.00–18.00"
                />
              </Field>
            </div>
          </Section>

          <Section title="Alamat">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Alamat jalan" error={errors.address?.message}>
                  <input {...register('address')} className={inputClass} placeholder="Jl. ..." />
                </Field>
              </div>
              <Field label="Kota" error={errors.city?.message}>
                <input {...register('city')} className={inputClass} placeholder="Jakarta Selatan" />
              </Field>
              <Field label="Provinsi" error={errors.province?.message}>
                <input {...register('province')} className={inputClass} placeholder="DKI Jakarta" />
              </Field>
              <Field label="Kode pos" error={errors.postalCode?.message}>
                <input {...register('postalCode')} className={inputClass} placeholder="12430" />
              </Field>
              <Field label="Google Maps URL" error={errors.googleMapsUrl?.message}>
                <input
                  {...register('googleMapsUrl')}
                  className={inputClass}
                  placeholder="https://maps.google.com/?q=..."
                />
              </Field>
            </div>
          </Section>

          <Section title="Sosial media">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Instagram" error={errors.instagramUrl?.message}>
                <input
                  {...register('instagramUrl')}
                  className={inputClass}
                  placeholder="@username"
                />
              </Field>
              <Field label="TikTok" error={errors.tiktokUrl?.message}>
                <input
                  {...register('tiktokUrl')}
                  className={inputClass}
                  placeholder="@username"
                />
              </Field>
              <Field label="Facebook" error={errors.facebookUrl?.message}>
                <input
                  {...register('facebookUrl')}
                  className={inputClass}
                  placeholder="facebook.com/..."
                />
              </Field>
            </div>
          </Section>

          <Section title="SEO">
            <div className="flex flex-col gap-4">
              <Field
                label="SEO title"
                error={errors.seoTitle?.message}
                hint="Kosongkan untuk memakai nama showroom."
              >
                <input {...register('seoTitle')} className={inputClass} />
              </Field>
              <Field
                label="SEO description"
                error={errors.seoDescription?.message}
                hint="Kosongkan untuk memakai deskripsi showroom."
              >
                <textarea {...register('seoDescription')} className={textareaClass} />
              </Field>
            </div>
          </Section>
        </div>

        <aside className="order-first xl:sticky xl:top-24 xl:order-none xl:self-start">
          <details className="border border-neutral-200 bg-white" open>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-sm font-bold">Live preview</p>
                <p className="text-xs text-neutral-500">Tampilan publik</p>
              </div>
              <Eye className="size-4 text-neutral-400" />
            </summary>
            <div className="p-4" style={theme}>
              <div className="relative flex h-40 flex-col justify-end overflow-hidden p-5">
                <Image
                  src={previewHero}
                  alt=""
                  fill
                  sizes="380px"
                  className="object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(0deg, var(--showroom-secondary) 0%, rgba(0,0,0,0.15) 75%)',
                  }}
                />
                <div className="relative flex items-center gap-2 text-white/80">
                  {values.logoUrl &&
                  (values.logoUrl.startsWith('/') || /^https?:\/\//i.test(values.logoUrl)) ? (
                    <span className="relative block size-6 overflow-hidden">
                      <Image src={values.logoUrl} alt="" fill sizes="24px" className="object-contain" />
                    </span>
                  ) : null}
                  <p className="text-xs font-semibold uppercase tracking-widest">
                    {values.displayName || 'Nama showroom'}
                  </p>
                </div>
                <h3
                  className="relative mt-1 whitespace-pre-line text-xl font-bold"
                  style={{ color: 'var(--showroom-on-secondary)' }}
                >
                  {values.displayName || 'Nama showroom'}
                </h3>
                <p
                  className="relative mt-1 line-clamp-2 text-xs opacity-75"
                  style={{ color: 'var(--showroom-on-secondary)' }}
                >
                  {values.tagline || 'Tagline showroom'}
                </p>
              </div>
              <div className="mt-4 border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">Unit pilihan</p>
                <p className="mt-1 font-bold">Toyota Fortuner</p>
                <p
                  className="mt-1 text-sm font-semibold"
                  style={{ color: 'var(--showroom-accent)' }}
                >
                  Rp 485.000.000
                </p>
              </div>
              <div className="mt-5 border-t border-neutral-100 pt-4">
                <p className="mb-2 text-xs font-semibold text-neutral-500">Google preview</p>
                <p className="truncate text-sm text-blue-700">
                  {values.seoTitle || values.displayName || 'SEO title'}
                </p>
                <p className="text-xs text-green-700">showroom.id</p>
                <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                  {values.seoDescription || values.description || 'SEO description'}
                </p>
              </div>
              <div className="mt-5 flex items-center gap-2 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                <Link2 className="size-3.5" />
                {values.email || 'Kontak belum diisi'}
              </div>
            </div>
          </details>
        </aside>
      </form>

      <div className="sticky bottom-0 z-10 mt-6 flex items-center justify-between border border-neutral-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <p className="hidden text-xs text-neutral-500 sm:block">
          {!isDirty ? 'Semua perubahan tersimpan' : 'Ada perubahan yang belum disimpan'}
        </p>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => reset(initialValues)}
            className="h-9 border border-neutral-200 px-3 text-sm font-medium"
          >
            Batal
          </button>
          <button
            type="submit"
            form="showroom-form"
            disabled={isSubmitting || Boolean(uploading)}
            className="flex h-9 items-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="size-4" />
            {isSubmitting ? 'Menyimpan…' : 'Simpan perubahan'}
          </button>
        </div>
      </div>
    </div>
  )
}
