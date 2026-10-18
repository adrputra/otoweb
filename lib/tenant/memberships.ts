import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { tenantMembers, tenants } from '@/db/schema'
import type * as schema from '@/db/schema'

import { isUuid } from './session'
import type { TenantIdentity, TenantMembership, TenantRole, TenantStatus } from './types'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

interface MembershipRow {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
  status: string
  tenant: TenantIdentity
}

function toMembership(row: MembershipRow): TenantMembership {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    role: row.role,
    status: row.status,
    tenant: row.tenant,
  }
}

/**
 * Return every membership for a user, including inactive ones, so a caller can
 * distinguish "no membership" from "inactive membership". Never throws for a
 * malformed user id: it yields no memberships.
 */
export async function listMembershipsForUser(
  db: Database,
  userId: string,
): Promise<TenantMembership[]> {
  if (!isUuid(userId)) return []

  const rows = await db
    .select({
      id: tenantMembers.id,
      tenantId: tenantMembers.tenantId,
      userId: tenantMembers.userId,
      role: tenantMembers.role,
      status: tenantMembers.status,
      tenant: {
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        plan: tenants.plan,
      },
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenants.id, tenantMembers.tenantId))
    .where(eq(tenantMembers.userId, userId))

  return rows.map((row) =>
    toMembership({
      ...row,
      tenant: {
        ...row.tenant,
        status: row.tenant.status as TenantStatus,
      },
    }),
  )
}

export async function findTenantById(
  db: Database,
  tenantId: string,
): Promise<TenantIdentity | null> {
  if (!isUuid(tenantId)) return null

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      plan: tenants.plan,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return { ...row, status: row.status as TenantStatus }
}
