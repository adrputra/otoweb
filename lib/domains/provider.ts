import { FakeDomainProvider } from './fake-provider'
import { HttpDomainProvider } from './http-provider'
import type {
  CustomDomainProviderEnvironment,
  DnsVerificationResult,
  DomainProvider,
  DomainProviderKind,
  SslProvisioningResult,
} from './types'

const NOT_CONFIGURED_MESSAGE =
  'No domain provider is configured. Set DOMAIN_PROVIDER and its server-only credentials before verifying custom domains.'

const HTTP_MISCONFIGURED_MESSAGE =
  'DOMAIN_PROVIDER=http requires DOMAIN_PROVIDER_URL and DOMAIN_PROVIDER_TOKEN. Custom-domain verification is disabled until both are set.'

/** A provider that never claims success. Used when production is unconfigured. */
class UnconfiguredDomainProvider implements DomainProvider {
  constructor(private readonly message: string) {}

  async verifyDns(): Promise<DnsVerificationResult> {
    return { status: 'failed', message: this.message }
  }

  async provisionCertificate(): Promise<SslProvisioningResult> {
    return { status: 'failed', message: this.message }
  }
}

export function resolveDomainProviderKind(
  env: CustomDomainProviderEnvironment = process.env,
): DomainProviderKind {
  if (env.DOMAIN_PROVIDER === 'http') return 'http'
  if (env.DOMAIN_PROVIDER === 'fake') {
    // Environment validation rejects fake in production; fail closed if a
    // caller bypasses validation.
    return env.NODE_ENV === 'production' ? 'unconfigured' : 'fake'
  }

  return env.NODE_ENV === 'production' ? 'unconfigured' : 'fake'
}

/**
 * Build the server-only provider for the current environment.
 *
 * Development and tests are deterministic and offline. Production must opt in
 * with `DOMAIN_PROVIDER=http` and both server-only settings; otherwise
 * verification fails closed instead of fabricating a verified domain.
 */
export function createDomainProvider(
  env: CustomDomainProviderEnvironment = process.env,
): DomainProvider {
  const kind = resolveDomainProviderKind(env)

  if (kind === 'http') {
    if (!env.DOMAIN_PROVIDER_URL || !env.DOMAIN_PROVIDER_TOKEN) {
      return new UnconfiguredDomainProvider(HTTP_MISCONFIGURED_MESSAGE)
    }

    return new HttpDomainProvider({
      baseUrl: env.DOMAIN_PROVIDER_URL,
      token: env.DOMAIN_PROVIDER_TOKEN,
    })
  }

  if (kind === 'fake') return new FakeDomainProvider()

  return new UnconfiguredDomainProvider(NOT_CONFIGURED_MESSAGE)
}
