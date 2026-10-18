import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import type * as schema from '@/db/schema'

import { findTenantByHostname } from './hostname'
import { findTenantById, listMembershipsForUser } from './memberships'
import type { HostnameTenantResult, TenantIdentity, TenantMembership } from './types'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface TenantDirectory {
  findTenantByHostname(hostname: string | null | undefined): Promise<HostnameTenantResult>
  findTenantById(tenantId: string): Promise<TenantIdentity | null>
  listMembershipsForUser(userId: string): Promise<TenantMembership[]>
}

/** Bind the tenant lookups to a database connection. */
export function createTenantDirectory(db: Database): TenantDirectory {
  return {
    findTenantByHostname: (hostname) => findTenantByHostname(db, hostname),
    findTenantById: (tenantId) => findTenantById(db, tenantId),
    listMembershipsForUser: (userId) => listMembershipsForUser(db, userId),
  }
}
