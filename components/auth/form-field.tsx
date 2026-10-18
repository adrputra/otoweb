import type { ReactNode } from 'react'

export const inputClassName =
  'h-11 w-full border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-500 focus-visible:border-neutral-950 focus-visible:ring-2 focus-visible:ring-neutral-950/10 disabled:cursor-not-allowed disabled:bg-neutral-50 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-100'

export function Field({
  id,
  label,
  hint,
  action,
  children,
}: {
  id: string
  label: string
  hint?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-neutral-900">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint ? <div className="text-xs leading-5 text-neutral-500">{hint}</div> : null}
    </div>
  )
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs font-medium leading-5 text-red-700">
      {message}
    </p>
  )
}
