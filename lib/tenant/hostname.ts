import { and, eq, isNotNull } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { tenantDomains, tenants } from '@/db/schema'
import type * as schema from '@/db/schema'

import {
  isUsableTenantStatus,
  type HostnameTenantResult,
  type TenantStatus,
} from './types'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/
const HOST_WITH_PORT_PATTERN = /^([^:]+):(\d{1,5})$/

/**
 * Normalize an attacker-influenced Host header into a lookup key.
 *
 * Accepts case differences, a numeric port, surrounding whitespace, and one
 * trailing dot. Anything else (paths, queries, userinfo, IPv6 literals,
 * malformed labels, or over-long values) returns null and must not resolve.
 */
export function normalizeHostname(input: string | null | undefined): string | null {
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

  for (const label of value.split('.')) {
    if (label.length < 1 || label.length > 63) return null
    if (!LABEL_PATTERN.test(label)) return null
  }

  return value
}

/**
 * Resolve a hostname to a tenant through the verified tenant_domains table.
 *
 * A domain that is not active/verified, or a tenant that is suspended/disabled,
 * fails closed. Unknown input never falls back to a default tenant.
 */
export async function findTenantByHostname(
  db: Database,
  hostname: string | null | undefined,
): Promise<HostnameTenantResult> {
  const normalized = normalizeHostname(hostname)
  if (!normalized) return { ok: false, error: 'unknown_hostname' }

  const rows = await db
    .select({
      hostname: tenantDomains.hostname,
      domainStatus: tenantDomains.status,
      verifiedAt: tenantDomains.verifiedAt,
      tenant: {
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        plan: tenants.plan,
      },
    })
    .from(tenantDomains)
    .innerJoin(tenants, eq(tenants.id, tenantDomains.tenantId))
    .where(and(eq(tenantDomains.hostname, normalized), isNotNull(tenants.id)))
    .limit(1)

  const row = rows[0]
  if (!row) return { ok: false, error: 'unknown_hostname' }
  if (row.domainStatus !== 'active' || row.verifiedAt == null) {
    return { ok: false, error: 'unknown_hostname' }
  }

  const status = row.tenant.status as TenantStatus
  if (!isUsableTenantStatus(status)) return { ok: false, error: 'tenant_unavailable' }

  return { ok: true, tenant: { ...row.tenant, status } }
}
