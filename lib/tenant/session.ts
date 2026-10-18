import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import type * as schema from '@/db/schema'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TenantSessionErrorCode = 'missing_tenant_id' | 'invalid_tenant_id' | 'invalid_user_id'

export class TenantSessionError extends Error {
  constructor(readonly code: TenantSessionErrorCode) {
    super(`Tenant session rejected: ${code}`)
    this.name = 'TenantSessionError'
  }
}

export interface TenantSessionValues {
  tenantId: string
  userId: string
  isPlatformAdmin?: boolean
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function assertTenantSessionValues(values: TenantSessionValues): void {
  if (!values.tenantId) throw new TenantSessionError('missing_tenant_id')
  if (!isUuid(values.tenantId)) throw new TenantSessionError('invalid_tenant_id')
  if (!isUuid(values.userId)) throw new TenantSessionError('invalid_user_id')
}

/**
 * Run tenant-scoped work inside a transaction with server-controlled,
 * transaction-local row-level-security settings.
 *
 * The settings are never process-wide, so a pooled connection cannot leak one
 * request's tenant into another. Missing or malformed identifiers are rejected
 * before any SQL runs.
 */
export async function withTenantSession<T>(
  db: Database,
  values: TenantSessionValues,
  callback: (tx: Database) => Promise<T>,
): Promise<T> {
  assertTenantSessionValues(values)

  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${values.tenantId}, true)`)
    await tx.execute(sql`select set_config('app.user_id', ${values.userId}, true)`)
    await tx.execute(
      sql`select set_config('app.is_platform_admin', ${values.isPlatformAdmin ? 'true' : 'false'}, true)`,
    )

    return callback(tx as Database)
  })
}
