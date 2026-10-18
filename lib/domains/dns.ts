import { randomBytes } from 'node:crypto'

import { DEFAULT_PLATFORM_ROOT_DOMAIN, normalizeHostname } from '@/lib/tenant/hostname'

import type { DnsInstruction, CustomDomainProviderEnvironment } from './types'

export const DNS_VERIFICATION_LABEL = '_otoweb-verify'
export const DNS_TXT_VALUE_PREFIX = 'otoweb-verify='
export const DNS_INSTRUCTION_TTL = 300

/** Generate a stable, URL-safe verification token for one domain. */
export function generateVerificationToken(): string {
  return randomBytes(24).toString('base64url')
}

export function verificationRecordName(hostname: string): string {
  return `${DNS_VERIFICATION_LABEL}.${hostname.toLowerCase()}`
}

export function verificationRecordValue(token: string): string {
  return `${DNS_TXT_VALUE_PREFIX}${token}`
}

/** Resolve the CNAME target shown to operators. Malformed values are ignored. */
export function resolveCnameTarget(
  env: CustomDomainProviderEnvironment = process.env,
): string {
  const configured = normalizeHostname(env.CUSTOM_DOMAIN_CNAME_TARGET)
  if (configured) return configured

  return normalizeHostname(env.TENANT_ROOT_DOMAIN) ?? DEFAULT_PLATFORM_ROOT_DOMAIN
}

/**
 * Build the exact DNS records a showroom owner must publish.
 *
 * The TXT record proves control of the hostname; the CNAME routes the hostname
 * to the platform deployment. Values are deterministic for a given token so a
 * retry never invalidates work already completed.
 */
export function buildDnsInstructions(input: {
  hostname: string
  token: string
  cnameTarget?: string
}): DnsInstruction[] {
  const hostname = input.hostname.toLowerCase()
  const cnameTarget = input.cnameTarget ?? resolveCnameTarget()

  return [
    {
      type: 'TXT',
      name: verificationRecordName(hostname),
      value: verificationRecordValue(input.token),
      ttl: DNS_INSTRUCTION_TTL,
      purpose: 'Verifikasi kepemilikan domain',
    },
    {
      type: 'CNAME',
      name: hostname,
      value: cnameTarget,
      ttl: DNS_INSTRUCTION_TTL,
      purpose: 'Arahkan trafik ke platform',
    },
  ]
}
