/**
 * Server-only custom-domain provider contracts.
 *
 * These types are safe to import from shared view-model modules because this
 * file contains no runtime Node or database imports.
 */

export const DOMAIN_VERIFICATION_STATUSES = ['pending', 'verified', 'failed'] as const
export type DomainVerificationStatus = (typeof DOMAIN_VERIFICATION_STATUSES)[number]

export const DOMAIN_SSL_STATUSES = ['none', 'pending', 'active', 'failed'] as const
export type DomainSslStatus = (typeof DOMAIN_SSL_STATUSES)[number]

export type DnsRecordType = 'TXT' | 'CNAME'

export interface DnsInstruction {
  type: DnsRecordType
  name: string
  value: string
  ttl: number
  purpose: string
}

export interface DnsVerificationRequest {
  hostname: string
  token: string
  recordName: string
  recordValue: string
}

export type DnsVerificationResult =
  | { status: 'verified'; message?: string }
  | { status: 'pending'; message?: string }
  | { status: 'failed'; message?: string }

export interface SslProvisioningRequest {
  hostname: string
}

export type SslProvisioningResult =
  | { status: 'active'; certificateId?: string; message?: string }
  | { status: 'pending'; message?: string }
  | { status: 'failed'; message?: string }

/**
 * DNS ownership verification plus certificate provisioning.
 *
 * Implementations must never log or return the configured credential.
 */
export interface DomainProvider {
  verifyDns(input: DnsVerificationRequest): Promise<DnsVerificationResult>
  provisionCertificate(input: SslProvisioningRequest): Promise<SslProvisioningResult>
}

export interface CustomDomainProviderEnvironment {
  NODE_ENV?: string
  DOMAIN_PROVIDER?: string
  DOMAIN_PROVIDER_URL?: string
  DOMAIN_PROVIDER_TOKEN?: string
  CUSTOM_DOMAIN_CNAME_TARGET?: string
  TENANT_ROOT_DOMAIN?: string
}

export type DomainProviderKind = 'fake' | 'http' | 'unconfigured'
