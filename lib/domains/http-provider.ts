import type {
  DnsVerificationRequest,
  DnsVerificationResult,
  DomainProvider,
  SslProvisioningRequest,
  SslProvisioningResult,
} from './types'

export interface HttpDomainProviderOptions {
  baseUrl: string
  token: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 10_000

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

function isDnsStatus(value: unknown): value is 'verified' | 'pending' | 'failed' {
  return value === 'verified' || value === 'pending' || value === 'failed'
}

function isSslStatus(value: unknown): value is 'active' | 'pending' | 'failed' {
  return value === 'active' || value === 'pending' || value === 'failed'
}

function safeMessage(value: unknown, fallback: string): string {
  if (!value || typeof value !== 'object') return fallback
  const message = (value as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message.trim() : fallback
}

/**
 * HTTP adapter for a DNS/SSL provisioning service.
 *
 * The service contract is documented in
 * `specs/013-custom-domains/contracts/domain-provider.md`. This adapter is
 * inert unless `DOMAIN_PROVIDER=http` and both server-only values are present.
 */
export class HttpDomainProvider implements DomainProvider {
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: HttpDomainProviderOptions) {
    this.baseUrl = trimTrailingSlash(options.baseUrl)
    this.token = options.token
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new Error(`Domain provider returned HTTP ${response.status}.`)
    }

    return response.json()
  }

  async verifyDns(input: DnsVerificationRequest): Promise<DnsVerificationResult> {
    try {
      const payload = await this.post('/verify-dns', {
        hostname: input.hostname,
        token: input.token,
        recordName: input.recordName,
        recordValue: input.recordValue,
      })
      const status = (payload as { status?: unknown } | null)?.status
      if (!isDnsStatus(status)) {
        return {
          status: 'failed',
          message: 'Domain provider returned an unknown DNS verification status.',
        }
      }
      return {
        status,
        message: safeMessage(payload, `DNS verification reported ${status}.`),
      }
    } catch {
      return {
        status: 'failed',
        message:
          'DNS verification provider is unreachable or rejected the request. Try again later.',
      }
    }
  }

  async provisionCertificate(
    input: SslProvisioningRequest,
  ): Promise<SslProvisioningResult> {
    try {
      const payload = await this.post('/certificates', { hostname: input.hostname })
      const status = (payload as { status?: unknown } | null)?.status
      if (!isSslStatus(status)) {
        return {
          status: 'failed',
          message: 'Domain provider returned an unknown certificate status.',
        }
      }

      const certificateId = (payload as { certificateId?: unknown } | null)?.certificateId
      return {
        status,
        ...(typeof certificateId === 'string' && certificateId
          ? { certificateId }
          : {}),
        message: safeMessage(payload, `Certificate provisioning reported ${status}.`),
      }
    } catch {
      return {
        status: 'failed',
        message:
          'Certificate provider is unreachable or rejected the request. Try again later.',
      }
    }
  }
}
