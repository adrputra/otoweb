'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CheckCircle2, Loader2, Send } from 'lucide-react'

import { submitContactLeadAction } from '@/lib/public/lead-actions'
import {
  contactLeadInputSchema,
  type ContactLeadFormValues,
} from '@/lib/validation/lead'

const inputClass =
  'h-11 w-full border border-neutral-200 bg-white px-3 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100'
const textareaClass =
  'min-h-32 w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-100'
const labelClass = 'mb-1.5 block text-xs font-semibold text-neutral-600'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <span className="mt-1 block text-xs text-red-600">{message}</span>
}

/**
 * Public contact form.
 *
 * The tenant is resolved by the server action from the request hostname; the
 * browser payload contains only the visitor's inquiry.
 */
export function PublicContactForm() {
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ContactLeadFormValues>({
    resolver: zodResolver(contactLeadInputSchema),
    defaultValues: { name: '', phone: '', email: '', message: '' },
  })

  async function onSubmit(values: ContactLeadFormValues) {
    setFormError('')
    const result = await submitContactLeadAction(values)

    if (result.ok) {
      setSubmitted(true)
      reset()
      return
    }

    if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        if (field === 'name' || field === 'phone' || field === 'email' || field === 'message') {
          setError(field, { message: messages[0] })
        }
      }
    }

    setFormError(result.message ?? 'Pesan tidak dapat dikirim. Coba lagi.')
  }

  if (submitted) {
    return (
      <div
        className="flex min-h-64 flex-col items-start justify-center border border-neutral-200 bg-white p-6 sm:p-8"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="size-8 text-[color:var(--showroom-accent)]" />
        <h3 className="mt-5 text-xl font-semibold tracking-tight">Pesan Anda terkirim.</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-600">
          Tim showroom akan menghubungi Anda melalui nomor yang Anda berikan.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className="mt-6 border-b border-neutral-950 pb-1 text-sm font-semibold"
        >
          Kirim pesan lain
        </button>
      </div>
    )
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit)}
      className="border border-neutral-200 bg-white p-6 sm:p-8"
    >
      <h3 className="text-xl font-semibold tracking-tight">Kirim pertanyaan</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-500">
        Ceritakan unit yang Anda cari. Kami akan menghubungi Anda kembali.
      </p>

      {formError && (
        <div
          className="mt-4 flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Nama</span>
          <input
            {...register('name')}
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            className={inputClass}
            placeholder="Nama lengkap"
          />
          <FieldError message={errors.name?.message} />
        </label>

        <label className="block">
          <span className={labelClass}>Nomor telepon</span>
          <input
            {...register('phone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            aria-invalid={Boolean(errors.phone)}
            className={inputClass}
            placeholder="0812 3456 7890"
          />
          <FieldError message={errors.phone?.message} />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelClass}>Email (opsional)</span>
          <input
            {...register('email')}
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            className={inputClass}
            placeholder="nama@email.com"
          />
          <FieldError message={errors.email?.message} />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelClass}>Pesan</span>
          <textarea
            {...register('message')}
            aria-invalid={Boolean(errors.message)}
            className={textareaClass}
            placeholder="Saya tertarik dengan Toyota Fortuner 2021. Apakah masih tersedia?"
          />
          <FieldError message={errors.message?.message} />
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-[var(--showroom-secondary)] px-5 text-sm font-semibold text-[color:var(--showroom-on-secondary)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        {isSubmitting ? 'Mengirim…' : 'Kirim pesan'}
      </button>
    </form>
  )
}
