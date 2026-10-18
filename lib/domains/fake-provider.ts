import type {
  DnsVerificationRequest,
  DnsVerificationResult,
  DomainProvider,
  SslProvisioningRequest,
  SslProvisioningResult,
} from './types'

export type FakeDnsOutcome = 'verified' | 'pending' | 'failed'
export type FakeSslOutcome = 'active' | 'pending' | 'failed'

export interface FakeDomainProviderOptions {
  /** Default DNS outcome. Defaults to `verified`. */
  dns?: FakeDnsOutcome
  /** Default certificate outcome. Defaults to `active`. */
  ssl?: FakeSslOutcome
  /** Per-hostname DNS overrides. */
  dnsByHostname?: Record<string, FakeDnsOutcome>
  /** Per-hostname certificate overrides. */
  sslByHostname?: Record<string, FakeSslOutcome>
}

export interface FakeDomainProviderCall {
  operation: 'verifyDns' | 'provisionCertificate'
  hostname: string
  token?: string
  recordName?: string
  recordValue?: string
}

function messageFor(operation: 'DNS' | 'SSL', outcome: string): string {
  if (outcome === 'pending') {
    return `${operation} masih diproses. Coba verifikasi lagi setelah beberapa saat.`
  }
  if (outcome === 'failed') {
    return `${operation} gagal. Periksa kembali record DNS sebelum mencoba lagi.`
  }
  return `${operation} berhasil (fake provider).`
}

/**
 * Deterministic in-memory provider for development and tests.
 *
 * It performs no network calls and never fabricates a real certificate. Tests
 * can inject pending/failed outcomes or override them per hostname to exercise
 * retry and fail-closed behavior.
 */
export class FakeDomainProvider implements DomainProvider {
  readonly calls: FakeDomainProviderCall[] = []

  private readonly defaultDns: FakeDnsOutcome
  private readonly defaultSsl: FakeSslOutcome
  private readonly dnsByHostname: Record<string, FakeDnsOutcome>
  private readonly sslByHostname: Record<string, FakeSslOutcome>

  constructor(options: FakeDomainProviderOptions = {}) {
    this.defaultDns = options.dns ?? 'verified'
    this.defaultSsl = options.ssl ?? 'active'
    this.dnsByHostname = { ...(options.dnsByHostname ?? {}) }
    this.sslByHostname = { ...(options.sslByHostname ?? {}) }
  }

  async verifyDns(input: DnsVerificationRequest): Promise<DnsVerificationResult> {
    this.calls.push({
      operation: 'verifyDns',
      hostname: input.hostname,
      token: input.token,
      recordName: input.recordName,
      recordValue: input.recordValue,
    })

    const outcome = this.dnsByHostname[input.hostname] ?? this.defaultDns
    return { status: outcome, message: messageFor('DNS', outcome) }
  }

  async provisionCertificate(
    input: SslProvisioningRequest,
  ): Promise<SslProvisioningResult> {
    this.calls.push({
      operation: 'provisionCertificate',
      hostname: input.hostname,
    })

    const outcome = this.sslByHostname[input.hostname] ?? this.defaultSsl
    if (outcome === 'active') {
      return {
        status: 'active',
        certificateId: `fake-cert-${input.hostname}`,
        message: messageFor('SSL', outcome),
      }
    }

    return { status: outcome, message: messageFor('SSL', outcome) }
  }
}
