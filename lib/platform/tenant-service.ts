import { and, asc, count, desc, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import {
  leads,
  profiles,
  showroomSettings,
  tenantDomains,
  tenantMembers,
  tenants,
  vehicles,
} from '@/db/schema'
import type * as schema from '@/db/schema'
import { buildDnsInstructions, resolveCnameTarget } from '@/lib/domains/dns'
import type { DomainSslStatus, DomainVerificationStatus } from '@/lib/domains/types'
import { withPlatformSession } from '@/lib/tenant/session'

import { findPlatformOperatorMembership } from './auth'
import type {
  PlatformMemberRole,
  PlatformResult,
  PlatformTenantDetail,
  PlatformTenantDomain,
  PlatformTenantMember,
  PlatformTenantStatus,
  PlatformTenantSummary,
} from './types'
import {
  assignOwnerInputSchema,
  createTenantInputSchema,
  normalizePlatformHostname,
  setPlanInputSchema,
  setStatusInputSchema,
  setSubdomainInputSchema,
  tenantIdSchema,
  toFieldErrors,
} from './validation'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export class PlatformForbiddenError extends Error {
  constructor() {
    super('Platform operator authorization required.')
    this.name = 'PlatformForbiddenError'
  }
}

export class PlatformNotFoundError extends Error {
  constructor(message = 'Tenant tidak ditemukan.') {
    super(message)
    this.name = 'PlatformNotFoundError'
  }
}

export class PlatformConflictError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message)
    this.name = 'PlatformConflictError'
  }
}

/**
 * Open a platform transaction, re-check the actor's explicit operator
 * membership inside the transaction, then run the operation. The check is
 * deliberately repeated at the data boundary so a privileged application
 * connection cannot bypass the route/action guard.
 */
export async function runPlatform<T>(
  db: Database,
  actorUserId: string,
  callback: (tx: Database) => Promise<T>,
): Promise<T> {
  if (!actorUserId) throw new PlatformForbiddenError()

  return withPlatformSession(db, { userId: actorUserId }, async (tx) => {
    if (!(await findPlatformOperatorMembership(tx, actorUserId))) {
      throw new PlatformForbiddenError()
    }
    return callback(tx)
  })
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === '23505') return true
  const message = (error as { message?: string }).message ?? ''
  return /duplicate key|unique constraint/i.test(message)
}

export function toResultError<T>(error: unknown): PlatformResult<T> {
  if (error instanceof PlatformForbiddenError) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Akses platform ditolak. Akun ini bukan operator platform.',
    }
  }
  if (error instanceof PlatformNotFoundError) {
    return { ok: false, error: 'not_found', message: error.message }
  }
  if (error instanceof PlatformConflictError) {
    return {
      ok: false,
      error: 'conflict',
      message: error.message,
      fieldErrors: { [error.field]: [error.message] },
    }
  }
  if (isUniqueViolation(error)) {
    return {
      ok: false,
      error: 'conflict',
      message: 'Nilai tersebut sudah digunakan oleh tenant lain.',
    }
  }
  throw error
}

function statusValue(value: string): PlatformTenantStatus {
  return value as PlatformTenantStatus
}

function toDomain(row: typeof tenantDomains.$inferSelect): PlatformTenantDomain {
  const isCustom = row.type === 'custom_domain'

  return {
    id: row.id,
    hostname: row.hostname,
    type: row.type,
    status: row.status,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    verificationStatus: row.verificationStatus as DomainVerificationStatus,
    verificationToken: row.verificationToken,
    sslStatus: row.sslStatus as DomainSslStatus,
    sslProvisionedAt: row.sslProvisionedAt ? row.sslProvisionedAt.toISOString() : null,
    lastCheckedAt: row.lastCheckedAt ? row.lastCheckedAt.toISOString() : null,
    dnsInstructions:
      isCustom && row.verificationToken
        ? buildDnsInstructions({
            hostname: row.hostname,
            token: row.verificationToken,
            cnameTarget: resolveCnameTarget(),
          })
        : null,
    createdAt: row.createdAt.toISOString(),
  }
}

function toMember(row: {
  id: string
  userId: string
  fullName: string | null
  role: PlatformMemberRole
  status: string
  createdAt: Date
}): PlatformTenantMember {
  return {
    id: row.id,
    userId: row.userId,
    fullName: row.fullName,
    role: row.role,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

function summaryFrom(
  tenant: typeof tenants.$inferSelect,
  domains: PlatformTenantDomain[],
  members: { role: PlatformMemberRole }[],
  vehicleCount: number,
  leadCount: number,
): PlatformTenantSummary {
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    status: statusValue(tenant.status),
    plan: tenant.plan,
    theme: tenant.theme,
    hostnames: domains.map((domain) => domain.hostname),
    ownerCount: members.filter((member) => member.role === 'owner').length,
    memberCount: members.length,
    vehicleCount,
    leadCount,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
  }
}

async function vehicleCountsByTenant(tx: Database): Promise<Map<string, number>> {
  const rows = await tx
    .select({ tenantId: vehicles.tenantId, value: count() })
    .from(vehicles)
    .groupBy(vehicles.tenantId)

  return new Map(rows.map((row) => [row.tenantId, Number(row.value)]))
}

async function leadCountsByTenant(tx: Database): Promise<Map<string, number>> {
  const rows = await tx
    .select({ tenantId: leads.tenantId, value: count() })
    .from(leads)
    .groupBy(leads.tenantId)

  return new Map(rows.map((row) => [row.tenantId, Number(row.value)]))
}

export async function listPlatformTenants(
  db: Database,
  actorUserId: string,
): Promise<PlatformResult<PlatformTenantSummary[]>> {
  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const tenantRows = await tx
        .select()
        .from(tenants)
        .orderBy(desc(tenants.createdAt), asc(tenants.name))
      const domainRows = await tx
        .select()
        .from(tenantDomains)
        .orderBy(asc(tenantDomains.hostname))
      const memberRows = await tx
        .select({
          tenantId: tenantMembers.tenantId,
          role: tenantMembers.role,
          status: tenantMembers.status,
        })
        .from(tenantMembers)
      const vehicleCounts = await vehicleCountsByTenant(tx)
      const leadCounts = await leadCountsByTenant(tx)

      const domainsByTenant = new Map<string, PlatformTenantDomain[]>()
      for (const row of domainRows) {
        const list = domainsByTenant.get(row.tenantId) ?? []
        list.push(toDomain(row))
        domainsByTenant.set(row.tenantId, list)
      }

      const membersByTenant = new Map<string, { role: PlatformMemberRole }[]>()
      for (const row of memberRows) {
        const list = membersByTenant.get(row.tenantId) ?? []
        list.push({ role: row.role as PlatformMemberRole })
        membersByTenant.set(row.tenantId, list)
      }

      return tenantRows.map((tenant) => {
        const domains = domainsByTenant.get(tenant.id) ?? []
        const members = membersByTenant.get(tenant.id) ?? []
        return summaryFrom(
          tenant,
          domains,
          members,
          vehicleCounts.get(tenant.id) ?? 0,
          leadCounts.get(tenant.id) ?? 0,
        )
      })
    })

    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

export async function loadTenantDetail(
  tx: Database,
  tenantId: string,
): Promise<PlatformTenantDetail | null> {
  const tenantRows = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  const tenant = tenantRows[0]
  if (!tenant) return null

  const domainRows = await tx
    .select()
    .from(tenantDomains)
    .where(eq(tenantDomains.tenantId, tenantId))
    .orderBy(asc(tenantDomains.hostname))

  const memberRows = await tx
    .select({
      id: tenantMembers.id,
      userId: tenantMembers.userId,
      fullName: profiles.fullName,
      role: tenantMembers.role,
      status: tenantMembers.status,
      createdAt: tenantMembers.createdAt,
    })
    .from(tenantMembers)
    .leftJoin(profiles, eq(profiles.id, tenantMembers.userId))
    .where(eq(tenantMembers.tenantId, tenantId))
    .orderBy(asc(tenantMembers.createdAt), asc(tenantMembers.id))

  const vehicleRows = await tx
    .select({ value: count() })
    .from(vehicles)
    .where(eq(vehicles.tenantId, tenantId))
  const leadRows = await tx
    .select({ value: count() })
    .from(leads)
    .where(eq(leads.tenantId, tenantId))
  const settingsRows = await tx
    .select({ displayName: showroomSettings.displayName })
    .from(showroomSettings)
    .where(eq(showroomSettings.tenantId, tenantId))
    .limit(1)

  const domains = domainRows.map(toDomain)
  const members = memberRows.map((row) =>
    toMember({
      id: row.id,
      userId: row.userId,
      fullName: row.fullName,
      role: row.role as PlatformMemberRole,
      status: row.status,
      createdAt: row.createdAt,
    }),
  )
  const summary = summaryFrom(
    tenant,
    domains,
    members,
    Number(vehicleRows[0]?.value ?? 0),
    Number(leadRows[0]?.value ?? 0),
  )

  return {
    ...summary,
    domains,
    members,
    owners: members.filter((member) => member.role === 'owner'),
    showroomDisplayName: settingsRows[0]?.displayName ?? null,
  }
}

export async function getPlatformTenant(
  db: Database,
  actorUserId: string,
  tenantId: string,
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsedId = tenantIdSchema.safeParse(tenantId)
  if (!parsedId.success) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Tenant ID tidak valid.',
      fieldErrors: toFieldErrors(parsedId.error.issues),
    }
  }

  try {
    const data = await runPlatform(db, actorUserId, (tx) =>
      loadTenantDetail(tx, parsedId.data),
    )
    if (!data) throw new PlatformNotFoundError()
    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

async function provisionProfile(tx: Database, userId: string): Promise<void> {
  await tx.insert(profiles).values({ id: userId }).onConflictDoNothing()
}

async function upsertOwnerMembership(tx: Database, tenantId: string, userId: string): Promise<void> {
  await provisionProfile(tx, userId)

  const existingRows = await tx
    .select({ id: tenantMembers.id, role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .limit(1)

  const existing = existingRows[0]
  const now = new Date()

  if (existing) {
    await tx
      .update(tenantMembers)
      .set({
        // Never strip an existing platform-operator authorization.
        role: existing.role === 'platform_admin' ? 'platform_admin' : 'owner',
        status: 'active',
        updatedAt: now,
      })
      .where(eq(tenantMembers.id, existing.id))
    return
  }

  await tx.insert(tenantMembers).values({
    tenantId,
    userId,
    role: 'owner',
    status: 'active',
  })
}

export async function createPlatformTenant(
  db: Database,
  actorUserId: string,
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsed = createTenantInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Periksa kembali data tenant.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    }
  }

  const values = parsed.data
  const hostname = values.subdomain ? normalizePlatformHostname(values.subdomain) : null
  if (values.subdomain && !hostname) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Hostname tidak valid.',
      fieldErrors: { subdomain: ['Masukkan hostname lengkap yang valid.'] },
    }
  }

  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const slugRows = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.slug, values.slug))
        .limit(1)
      if (slugRows.length > 0) {
        throw new PlatformConflictError('slug', 'Slug tenant sudah digunakan.')
      }

      if (hostname) {
        const hostnameRows = await tx
          .select({ id: tenantDomains.id })
          .from(tenantDomains)
          .where(eq(tenantDomains.hostname, hostname))
          .limit(1)
        if (hostnameRows.length > 0) {
          throw new PlatformConflictError('subdomain', 'Hostname sudah digunakan tenant lain.')
        }
      }

      const now = new Date()
      const inserted = await tx
        .insert(tenants)
        .values({
          name: values.name,
          slug: values.slug,
          plan: values.plan,
          status: values.status,
          updatedAt: now,
        })
        .returning()
      const tenant = inserted[0]
      if (!tenant) throw new Error('Tenant insert did not return a row.')

      await tx.insert(showroomSettings).values({
        tenantId: tenant.id,
        displayName: values.name,
      })

      if (hostname) {
        await tx.insert(tenantDomains).values({
          tenantId: tenant.id,
          hostname,
          type: 'platform_subdomain',
          status: 'active',
          verifiedAt: now,
          verificationStatus: 'verified',
          sslStatus: 'active',
          sslProvisionedAt: now,
          lastCheckedAt: now,
        })
      }

      if (values.ownerUserId) {
        await upsertOwnerMembership(tx, tenant.id, values.ownerUserId)
      }

      const detail = await loadTenantDetail(tx, tenant.id)
      if (!detail) throw new PlatformNotFoundError('Tenant baru tidak dapat dibaca kembali.')
      return detail
    })

    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

export async function assignTenantOwner(
  db: Database,
  actorUserId: string,
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsed = assignOwnerInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Periksa kembali data pemilik.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    }
  }

  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const tenantRows = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, parsed.data.tenantId))
        .limit(1)
      if (tenantRows.length === 0) throw new PlatformNotFoundError()

      await upsertOwnerMembership(tx, parsed.data.tenantId, parsed.data.userId)

      const detail = await loadTenantDetail(tx, parsed.data.tenantId)
      if (!detail) throw new PlatformNotFoundError()
      return detail
    })

    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

export async function setTenantSubdomain(
  db: Database,
  actorUserId: string,
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsed = setSubdomainInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Periksa kembali subdomain.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    }
  }

  const hostname = normalizePlatformHostname(parsed.data.hostname)
  if (!hostname) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Hostname tidak valid.',
      fieldErrors: { hostname: ['Masukkan hostname lengkap yang valid.'] },
    }
  }

  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const tenantRows = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, parsed.data.tenantId))
        .limit(1)
      if (tenantRows.length === 0) throw new PlatformNotFoundError()

      const conflictRows = await tx
        .select({ id: tenantDomains.id, tenantId: tenantDomains.tenantId })
        .from(tenantDomains)
        .where(eq(tenantDomains.hostname, hostname))
        .limit(1)
      const conflict = conflictRows[0]
      if (conflict && conflict.tenantId !== parsed.data.tenantId) {
        throw new PlatformConflictError('hostname', 'Hostname sudah digunakan tenant lain.')
      }

      const currentRows = await tx
        .select({ id: tenantDomains.id })
        .from(tenantDomains)
        .where(
          and(
            eq(tenantDomains.tenantId, parsed.data.tenantId),
            eq(tenantDomains.type, 'platform_subdomain'),
          ),
        )
        .orderBy(asc(tenantDomains.createdAt))
        .limit(1)

      const now = new Date()
      const current = currentRows[0]

      if (current) {
        await tx
          .update(tenantDomains)
          .set({
            hostname,
            status: 'active',
            verifiedAt: now,
            verificationStatus: 'verified',
            sslStatus: 'active',
            sslProvisionedAt: now,
            lastCheckedAt: now,
          })
          .where(eq(tenantDomains.id, current.id))
      } else {
        await tx.insert(tenantDomains).values({
          tenantId: parsed.data.tenantId,
          hostname,
          type: 'platform_subdomain',
          status: 'active',
          verifiedAt: now,
          verificationStatus: 'verified',
          sslStatus: 'active',
          sslProvisionedAt: now,
          lastCheckedAt: now,
        })
      }

      const detail = await loadTenantDetail(tx, parsed.data.tenantId)
      if (!detail) throw new PlatformNotFoundError()
      return detail
    })

    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

export async function setTenantPlan(
  db: Database,
  actorUserId: string,
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsed = setPlanInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Periksa kembali plan tenant.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    }
  }

  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const updated = await tx
        .update(tenants)
        .set({ plan: parsed.data.plan, updatedAt: new Date() })
        .where(eq(tenants.id, parsed.data.tenantId))
        .returning({ id: tenants.id })
      if (updated.length === 0) throw new PlatformNotFoundError()

      const detail = await loadTenantDetail(tx, parsed.data.tenantId)
      if (!detail) throw new PlatformNotFoundError()
      return detail
    })

    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

export async function setTenantStatus(
  db: Database,
  actorUserId: string,
  input: unknown,
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsed = setStatusInputSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Periksa kembali status tenant.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    }
  }

  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const updated = await tx
        .update(tenants)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(eq(tenants.id, parsed.data.tenantId))
        .returning({ id: tenants.id })
      if (updated.length === 0) throw new PlatformNotFoundError()

      const detail = await loadTenantDetail(tx, parsed.data.tenantId)
      if (!detail) throw new PlatformNotFoundError()
      return detail
    })

    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

/** Explicit tenant-disable capability; status is the single source of truth. */
export async function disableTenant(
  db: Database,
  actorUserId: string,
  tenantId: string,
): Promise<PlatformResult<PlatformTenantDetail>> {
  return setTenantStatus(db, actorUserId, { tenantId, status: 'disabled' })
}
