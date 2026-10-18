import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { tenantDomains, tenants } from '@/db/schema'
import type * as schema from '@/db/schema'
import {
  buildDnsInstructions,
  generateVerificationToken,
  resolveCnameTarget,
} from '@/lib/domains/dns'
import { createDomainProvider } from '@/lib/domains/provider'
import type {
  DnsVerificationResult,
  DomainProvider,
  SslProvisioningResult,
} from '@/lib/domains/types'
import { resolvePlatformRootDomains } from '@/lib/tenant/hostname'

import {
  loadTenantDetail,
  PlatformConflictError,
  PlatformNotFoundError,
  runPlatform,
  toResultError,
} from './tenant-service'
import type { PlatformResult, PlatformTenantDetail } from './types'
import {
  normalizePlatformHostname,
  registerCustomDomainInputSchema,
  toFieldErrors,
  verifyCustomDomainInputSchema,
} from './validation'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface DomainServiceDependencies {
  provider?: DomainProvider
  now?: () => Date
  createToken?: () => string
  cnameTarget?: string
}

function invalidResult<T>(
  message: string,
  fieldErrors?: Record<string, string[]>,
): PlatformResult<T> {
  return { ok: false, error: 'invalid', message, ...(fieldErrors ? { fieldErrors } : {}) }
}

/**
 * True when a hostname belongs to the platform's own tenant roots. Those
 * hostnames are managed as platform subdomains rather than custom domains.
 */
export function isPlatformRootHostname(hostname: string): boolean {
  const config = resolvePlatformRootDomains()
  const roots = [...config.rootDomains, ...config.developmentRootDomains]

  return roots.some((root) => hostname === root || hostname.endsWith(`.${root}`))
}


async function verifyDnsSafely(
  provider: DomainProvider,
  input: Parameters<DomainProvider['verifyDns']>[0],
): Promise<DnsVerificationResult> {
  try {
    return await provider.verifyDns(input)
  } catch {
    return {
      status: 'failed',
      message: 'Penyedia verifikasi DNS tidak dapat dihubungi. Coba lagi nanti.',
    }
  }
}

async function provisionCertificateSafely(
  provider: DomainProvider,
  input: Parameters<DomainProvider['provisionCertificate']>[0],
): Promise<SslProvisioningResult> {
  try {
    return await provider.provisionCertificate(input)
  } catch {
    return {
      status: 'failed',
      message: 'Penyedia sertifikat tidak dapat dihubungi. Coba lagi nanti.',
    }
  }
}

async function readDetail(
  db: Database,
  actorUserId: string,
  tenantId: string,
): Promise<PlatformResult<PlatformTenantDetail>> {
  try {
    const detail = await runPlatform(db, actorUserId, (tx) =>
      loadTenantDetail(tx, tenantId),
    )
    if (!detail) throw new PlatformNotFoundError()
    return { ok: true, data: detail }
  } catch (error) {
    return toResultError(error)
  }
}

/**
 * Register a custom hostname for a tenant.
 *
 * The record starts pending with a stable verification token. DNS ownership
 * and certificate state remain unset until the operator triggers verification.
 */
export async function registerCustomDomain(
  db: Database,
  actorUserId: string,
  input: unknown,
  deps: DomainServiceDependencies = {},
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsed = registerCustomDomainInputSchema.safeParse(input)
  if (!parsed.success) {
    return invalidResult(
      'Periksa kembali hostname domain.',
      toFieldErrors(parsed.error.issues),
    )
  }

  const hostname = normalizePlatformHostname(parsed.data.hostname)
  if (!hostname) {
    return invalidResult('Hostname tidak valid.', {
      hostname: ['Masukkan hostname lengkap yang valid, misalnya showroom.example.com.'],
    })
  }

  if (isPlatformRootHostname(hostname)) {
    return invalidResult(
      'Hostname ini berada di bawah domain platform dan dikelola sebagai subdomain platform.',
      {
        hostname: [
          'Gunakan menu Subdomain untuk hostname platform. Domain kustom harus berada di luar domain platform.',
        ],
      },
    )
  }

  const token = (deps.createToken ?? generateVerificationToken)()
  const now = deps.now?.() ?? new Date()

  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const tenantRows = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, parsed.data.tenantId))
        .limit(1)
      if (tenantRows.length === 0) throw new PlatformNotFoundError()

      const conflictRows = await tx
        .select({ id: tenantDomains.id })
        .from(tenantDomains)
        .where(eq(tenantDomains.hostname, hostname))
        .limit(1)
      if (conflictRows.length > 0) {
        throw new PlatformConflictError(
          'hostname',
          'Hostname sudah terdaftar. Domain hanya dapat dimiliki satu tenant.',
        )
      }

      await tx.insert(tenantDomains).values({
        tenantId: parsed.data.tenantId,
        hostname,
        type: 'custom_domain',
        status: 'pending',
        verifiedAt: null,
        verificationStatus: 'pending',
        verificationToken: token,
        sslStatus: 'none',
        sslProvisionedAt: null,
        lastCheckedAt: null,
        createdAt: now,
      })

      const detail = await loadTenantDetail(tx, parsed.data.tenantId)
      if (!detail) throw new PlatformNotFoundError()
      return detail
    })

    return { ok: true, data }
  } catch (error) {
    return toResultError(error)
  }
}

/**
 * Verify DNS ownership and provision a certificate for a custom domain.
 *
 * Provider calls happen outside the database transaction. The final write
 * re-runs the platform-operator authorization check inside a fresh platform
 * transaction.
 */
export async function verifyCustomDomain(
  db: Database,
  actorUserId: string,
  input: unknown,
  deps: DomainServiceDependencies = {},
): Promise<PlatformResult<PlatformTenantDetail>> {
  const parsed = verifyCustomDomainInputSchema.safeParse(input)
  if (!parsed.success) {
    return invalidResult(
      'Periksa kembali permintaan verifikasi.',
      toFieldErrors(parsed.error.issues),
    )
  }

  const provider = deps.provider ?? createDomainProvider()

  let prepared: {
    hostname: string
    token: string
    alreadyActive: boolean
  }

  try {
    prepared = await runPlatform(db, actorUserId, async (tx) => {
      const rows = await tx
        .select()
        .from(tenantDomains)
        .where(
          and(
            eq(tenantDomains.id, parsed.data.domainId),
            eq(tenantDomains.tenantId, parsed.data.tenantId),
          ),
        )
        .limit(1)
      const row = rows[0]

      if (!row || row.type !== 'custom_domain') throw new PlatformNotFoundError()

      const alreadyActive =
        row.status === 'active' &&
        row.verificationStatus === 'verified' &&
        row.sslStatus === 'active' &&
        row.verifiedAt !== null

      return {
        hostname: row.hostname,
        token: row.verificationToken ?? '',
        alreadyActive,
      }
    })
  } catch (error) {
    return toResultError(error)
  }

  if (prepared.alreadyActive) {
    return readDetail(db, actorUserId, parsed.data.tenantId)
  }

  if (!prepared.token) {
    return invalidResult(
      'Domain ini tidak memiliki token verifikasi. Daftarkan ulang domain untuk membuat instruksi DNS.',
      { domainId: ['Token verifikasi tidak ditemukan.'] },
    )
  }

  const instructions = buildDnsInstructions({
    hostname: prepared.hostname,
    token: prepared.token,
    cnameTarget: deps.cnameTarget ?? resolveCnameTarget(),
  })
  const txt = instructions[0]

  const dns = await verifyDnsSafely(provider, {
    hostname: prepared.hostname,
    token: prepared.token,
    recordName: txt?.name ?? '',
    recordValue: txt?.value ?? '',
  })

  let ssl: SslProvisioningResult | null = null
  if (dns.status === 'verified') {
    ssl = await provisionCertificateSafely(provider, { hostname: prepared.hostname })
  }

  const now = deps.now?.() ?? new Date()

  try {
    const data = await runPlatform(db, actorUserId, async (tx) => {
      const rows = await tx
        .select()
        .from(tenantDomains)
        .where(
          and(
            eq(tenantDomains.id, parsed.data.domainId),
            eq(tenantDomains.tenantId, parsed.data.tenantId),
          ),
        )
        .limit(1)
      const row = rows[0]
      if (!row || row.type !== 'custom_domain') throw new PlatformNotFoundError()

      if (dns.status !== 'verified') {
        await tx
          .update(tenantDomains)
          .set({
            status: 'pending',
            verificationStatus: dns.status,
            lastCheckedAt: now,
          })
          .where(eq(tenantDomains.id, row.id))
      } else {
        const sslStatus = ssl?.status ?? 'failed'
        const active = sslStatus === 'active'

        await tx
          .update(tenantDomains)
          .set({
            status: active ? 'active' : 'pending',
            verificationStatus: 'verified',
            verifiedAt: row.verifiedAt ?? now,
            sslStatus,
            sslProvisionedAt: active ? now : row.sslProvisionedAt,
            lastCheckedAt: now,
          })
          .where(eq(tenantDomains.id, row.id))
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
