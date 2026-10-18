import { and, eq, isNotNull, like } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { tenantDomains, tenants } from '@/db/schema'
import type * as schema from '@/db/schema'

import {
  isUsableTenantStatus,
  type HostnameTenantResult,
  type TenantIdentity,
  type TenantStatus,
} from './types'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/
const HOST_WITH_PORT_PATTERN = /^([^:]+):(\d{1,5})$/

/** Production tenant root used when `TENANT_ROOT_DOMAIN` is not configured. */
export const DEFAULT_PLATFORM_ROOT_DOMAIN = 'otoweb.id'

/** Hosts that may use the documented development default showroom. */
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1'])

export interface PlatformRootConfig {
  /** Root domains where `<label>.<root>` may resolve a tenant. */
  rootDomains: string[]
  /** Development-only roots that also allow local aliases. */
  developmentRootDomains: string[]
}

export interface HostnameResolutionOptions {
  rootDomains?: readonly string[]
  developmentRootDomains?: readonly string[]
  allowDevelopmentAliases?: boolean
}

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

/** Normalize a configured platform root. Invalid values return null. */
export function normalizeRootDomain(input: string | null | undefined): string | null {
  return normalizeHostname(input)
}

/**
 * Return the single subdomain label when `hostname` belongs directly to
 * `rootDomain`, for example `prima` in `prima.otoweb.id`.
 *
 * The root itself, multi-label prefixes (`a.b.otoweb.id`), and unrelated
 * suffixes return null.
 */
export function platformSubdomainLabel(
  hostname: string | null | undefined,
  rootDomain: string | null | undefined,
): string | null {
  const host = normalizeHostname(hostname)
  const root = normalizeRootDomain(rootDomain)
  if (!host || !root) return null

  const suffix = `.${root}`
  if (!host.endsWith(suffix)) return null

  const label = host.slice(0, -suffix.length)
  if (!label || label.includes('.')) return null
  return LABEL_PATTERN.test(label) ? label : null
}

/** True for the bare loopback hosts that keep the development default showroom. */
export function isLoopbackHostname(hostname: string | null | undefined): boolean {
  const host = normalizeHostname(hostname)
  return host !== null && LOOPBACK_HOSTNAMES.has(host)
}

/**
 * Resolve the configured platform roots.
 *
 * Production uses only `TENANT_ROOT_DOMAIN` (or `otoweb.id`). Development and
 * tests additionally accept `localhost` for `*.localhost` tenant testing.
 */
export function resolvePlatformRootDomains(
  env: { NODE_ENV?: string | undefined; TENANT_ROOT_DOMAIN?: string | undefined } = process.env,
): PlatformRootConfig {
  const configured = normalizeRootDomain(env.TENANT_ROOT_DOMAIN) ?? DEFAULT_PLATFORM_ROOT_DOMAIN
  const rootDomains = [configured]
  const developmentRootDomains: string[] = []

  if (env.NODE_ENV !== 'production') {
    developmentRootDomains.push('localhost')
  }

  return { rootDomains, developmentRootDomains }
}

function normalizeRoots(values: readonly string[] | undefined): string[] {
  const roots: string[] = []

  for (const value of values ?? []) {
    const root = normalizeRootDomain(value)
    if (root && !roots.includes(root)) roots.push(root)
  }

  return roots
}

function resolutionConfig(options: HostnameResolutionOptions): Required<
  Pick<PlatformRootConfig, 'rootDomains' | 'developmentRootDomains'>
> & {
  allowDevelopmentAliases: boolean
} {
  const defaults = resolvePlatformRootDomains()
  const rootDomains = normalizeRoots(options.rootDomains ?? defaults.rootDomains)
  const developmentRootDomains = normalizeRoots(
    options.developmentRootDomains ?? defaults.developmentRootDomains,
  )

  return {
    rootDomains,
    developmentRootDomains,
    allowDevelopmentAliases: options.allowDevelopmentAliases ?? developmentRootDomains.length > 0,
  }
}

function toTenant(row: {
  id: string
  name: string
  slug: string
  status: TenantStatus | string
  plan: string
}): TenantIdentity {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as TenantStatus,
    plan: row.plan,
  }
}

async function findExactTenant(
  db: Database,
  hostname: string,
): Promise<HostnameTenantResult | null> {
  const rows = await db
    .select({
      hostname: tenantDomains.hostname,
      domainType: tenantDomains.type,
      domainStatus: tenantDomains.status,
      verifiedAt: tenantDomains.verifiedAt,
      verificationStatus: tenantDomains.verificationStatus,
      sslStatus: tenantDomains.sslStatus,
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
    .where(eq(tenantDomains.hostname, hostname))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  // An explicit registration is authoritative. A disabled/unverified domain
  // must not fall through to wildcard inference.
  if (row.domainStatus !== 'active' || row.verifiedAt == null) {
    return { ok: false, error: 'unknown_hostname' }
  }

  // Custom domains additionally require proven ownership and an active
  // certificate. Platform subdomains keep their existing active+verified
  // contract (covered by the platform wildcard certificate).
  if (
    row.domainType === 'custom_domain' &&
    (row.verificationStatus !== 'verified' || row.sslStatus !== 'active')
  ) {
    return { ok: false, error: 'unknown_hostname' }
  }

  const tenant = toTenant(row.tenant)
  if (!isUsableTenantStatus(tenant.status)) return { ok: false, error: 'tenant_unavailable' }

  return { ok: true, tenant }
}

async function findTenantBySlugLabel(
  db: Database,
  label: string,
): Promise<HostnameTenantResult | null> {
  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      status: tenants.status,
      plan: tenants.plan,
    })
    .from(tenants)
    .where(eq(tenants.slug, label))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const tenant = toTenant(row)
  if (!isUsableTenantStatus(tenant.status)) return { ok: false, error: 'tenant_unavailable' }

  return { ok: true, tenant }
}

/**
 * Development-only alias lookup.
 *
 * `prima.localhost` maps to the tenant owning the active, verified
 * `platform_subdomain` `prima.otoweb.id`. Zero or multiple matching tenants
 * fail closed so a short alias can never silently select the wrong showroom.
 */
async function findTenantByDevelopmentAlias(
  db: Database,
  label: string,
): Promise<HostnameTenantResult | null> {
  const rows = await db
    .select({
      hostname: tenantDomains.hostname,
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
    .where(
      and(
        eq(tenantDomains.type, 'platform_subdomain'),
        eq(tenantDomains.status, 'active'),
        isNotNull(tenantDomains.verifiedAt),
        like(tenantDomains.hostname, `${label}.%`),
      ),
    )

  const matches = new Map<string, HostnameTenantResult>()

  for (const row of rows) {
    const [firstLabel] = row.hostname.split('.')
    if (firstLabel !== label) continue

    const tenant = toTenant(row.tenant)
    matches.set(
      tenant.id,
      isUsableTenantStatus(tenant.status)
        ? { ok: true, tenant }
        : { ok: false, error: 'tenant_unavailable' },
    )
  }

  if (matches.size === 0) return null
  if (matches.size > 1) return { ok: false, error: 'unknown_hostname' }

  return [...matches.values()][0] ?? null
}

/**
 * Resolve a hostname to a tenant.
 *
 * Order:
 *   1. Active, verified `tenant_domains` record (authoritative).
 *   2. Single-label subdomain of a configured root, resolved by tenant slug.
 *   3. Development-only short alias derived from an active platform subdomain.
 *
 * Unknown input never falls back to a default tenant. An exact record that is
 * inactive/unverified also fails closed rather than trying wildcard inference.
 */
export async function findTenantByHostname(
  db: Database,
  hostname: string | null | undefined,
  options: HostnameResolutionOptions = {},
): Promise<HostnameTenantResult> {
  const normalized = normalizeHostname(hostname)
  if (!normalized) return { ok: false, error: 'unknown_hostname' }

  const exact = await findExactTenant(db, normalized)
  if (exact) return exact

  const config = resolutionConfig(options)
  const roots = [
    ...config.rootDomains,
    ...config.developmentRootDomains.filter((root) => !config.rootDomains.includes(root)),
  ]

  for (const root of roots) {
    const label = platformSubdomainLabel(normalized, root)
    if (!label) continue

    const bySlug = await findTenantBySlugLabel(db, label)
    if (bySlug) return bySlug

    if (config.allowDevelopmentAliases && config.developmentRootDomains.includes(root)) {
      const byAlias = await findTenantByDevelopmentAlias(db, label)
      if (byAlias) return byAlias
    }

    return { ok: false, error: 'unknown_hostname' }
  }

  return { ok: false, error: 'unknown_hostname' }
}
