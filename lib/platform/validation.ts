import { z } from 'zod'

import { PLATFORM_TENANT_STATUSES } from './types'

/**
 * Client-safe platform administration contracts.
 *
 * This module is imported by the create/configure forms and re-used by the
 * server service. It must stay free of database, Node, and auth imports.
 */

export const TENANT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const TENANT_PLAN_PATTERN = /^[a-z0-9][a-z0-9_-]*$/
export const USER_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/
const HOST_WITH_PORT_PATTERN = /^([^:]+):(\d{1,5})$/

export function normalizeTenantSlug(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeTenantPlan(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Normalize an operator-supplied hostname into a DNS lookup key.
 *
 * Accepts case differences, a numeric port, surrounding whitespace, and one
 * trailing dot. Rejects paths, queries, userinfo, malformed labels, single
 * labels (a platform subdomain always includes a base domain), and over-long
 * values.
 */
export function normalizePlatformHostname(input: unknown): string | null {
  if (typeof input !== 'string') return null

  let value = input.trim().toLowerCase()
  if (!value) return null
  if (/[\s/\\?#@]/.test(value)) return null

  const withPort = value.match(HOST_WITH_PORT_PATTERN)
  if (withPort) {
    const port = Number(withPort[2])
    if (!Number.isInteger(port) || port < 1 || port > 65_535) return null
    value = withPort[1] ?? ''
  }

  if (value.endsWith('.')) value = value.slice(0, -1)
  if (!value || value.length > 253) return null
  if (!HOST_PATTERN.test(value)) return null
  if (value.includes('..')) return null

  const labels = value.split('.')
  if (labels.length < 2) return null

  for (const label of labels) {
    if (label.length < 1 || label.length > 63) return null
    if (!LABEL_PATTERN.test(label)) return null
  }

  return value
}

export const platformTenantStatusSchema = z.enum(PLATFORM_TENANT_STATUSES)

export const tenantSlugSchema = z
  .string()
  .transform((value) => normalizeTenantSlug(value))
  .pipe(
    z
      .string()
      .min(1, 'Slug wajib diisi')
      .max(63, 'Slug maksimal 63 karakter')
      .regex(TENANT_SLUG_PATTERN, 'Gunakan huruf kecil, angka, dan tanda hubung'),
  )

export const tenantPlanSchema = z
  .string()
  .transform((value) => normalizeTenantPlan(value))
  .pipe(
    z
      .string()
      .min(1, 'Plan wajib diisi')
      .max(40, 'Plan maksimal 40 karakter')
      .regex(TENANT_PLAN_PATTERN, 'Plan hanya boleh berisi huruf, angka, _ dan -'),
  )

const optionalHostnameSchema = z
  .string()
  .trim()
  .max(253, 'Hostname maksimal 253 karakter')
  .optional()
  .default('')
  .refine(
    (value) => value === '' || normalizePlatformHostname(value) !== null,
    'Masukkan hostname lengkap yang valid, misalnya showroom.otoweb.id',
  )

const optionalUserIdSchema = z
  .string()
  .trim()
  .optional()
  .default('')
  .refine(
    (value) => value === '' || USER_ID_PATTERN.test(value),
    'User ID harus berupa UUID',
  )

export const userIdSchema = z
  .string()
  .trim()
  .regex(USER_ID_PATTERN, 'User ID harus berupa UUID')

export const tenantIdSchema = z
  .string()
  .trim()
  .regex(USER_ID_PATTERN, 'Tenant ID tidak valid')

export const createTenantInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama tenant wajib diisi')
    .max(120, 'Nama tenant maksimal 120 karakter'),
  slug: tenantSlugSchema,
  plan: tenantPlanSchema,
  status: platformTenantStatusSchema,
  subdomain: optionalHostnameSchema,
  ownerUserId: optionalUserIdSchema,
})

export const assignOwnerInputSchema = z.object({
  tenantId: tenantIdSchema,
  userId: userIdSchema,
})

export const setSubdomainInputSchema = z.object({
  tenantId: tenantIdSchema,
  hostname: z
    .string()
    .trim()
    .max(253, 'Hostname maksimal 253 karakter')
    .refine(
      (value) => normalizePlatformHostname(value) !== null,
      'Masukkan hostname lengkap yang valid, misalnya showroom.otoweb.id',
    ),
})

export const setPlanInputSchema = z.object({
  tenantId: tenantIdSchema,
  plan: tenantPlanSchema,
})

export const setStatusInputSchema = z.object({
  tenantId: tenantIdSchema,
  status: platformTenantStatusSchema,
})

export type CreateTenantInput = z.output<typeof createTenantInputSchema>
export type AssignOwnerInput = z.output<typeof assignOwnerInputSchema>
export type SetSubdomainInput = z.output<typeof setSubdomainInputSchema>
export type SetPlanInput = z.output<typeof setPlanInputSchema>
export type SetStatusInput = z.output<typeof setStatusInputSchema>

/** Convert zod issues into the field-error shape returned by actions. */
export function toFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    const messages = fieldErrors[key] ?? []
    if (!messages.includes(issue.message)) messages.push(issue.message)
    fieldErrors[key] = messages
  }

  return fieldErrors
}
