import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { getDatabase } from '@/db/client'

import { resolveTenantContext } from './context'
import { createTenantDirectory, type TenantDirectory } from './directory'
import type { TenantContext, TenantContextResult } from './types'

export interface TenantServerDependencies {
  directory?: TenantDirectory
  hostname?: string | null
}

/** Refuse to run server-only tenant code in a browser-like environment. */
export function assertServerOnly(moduleName: string = 'lib/tenant'): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      `${moduleName} is server-only and must never be imported by browser code.`,
    )
  }
}

async function readHostname(deps: TenantServerDependencies): Promise<string | null> {
  if (Object.prototype.hasOwnProperty.call(deps, 'hostname')) {
    return deps.hostname ?? null
  }

  const requestHeaders = await headers()
  return requestHeaders.get('host')
}

/**
 * Resolve the tenant context for a signed-in request.
 *
 * Every failure (missing configuration, database error, unknown host, mismatch)
 * is converted to a typed denial. A thrown error never yields a tenant.
 */
export async function resolveRequestTenantContext(
  user: { id: string } | null,
  deps: TenantServerDependencies = {},
): Promise<TenantContextResult> {
  assertServerOnly('lib/tenant/server')

  if (!user) return { ok: false, error: 'unauthenticated' }

  try {
    const directory = deps.directory ?? createTenantDirectory(getDatabase())
    const hostname = await readHostname(deps)

    const hostnameResult = await directory.findTenantByHostname(hostname)
    const memberships = await directory.listMembershipsForUser(user.id)

    return resolveTenantContext({
      user,
      memberships,
      hostnameTenant: hostnameResult.ok ? hostnameResult.tenant : null,
    })
  } catch {
    return { ok: false, error: 'tenant_unavailable' }
  }
}

/**
 * Require a valid tenant context at a server boundary. A denied request is sent
 * to the public home instead of rendering any admin content.
 */
export async function requireTenantContext(
  user: { id: string } | null,
  deps: TenantServerDependencies = {},
): Promise<TenantContext> {
  const result = await resolveRequestTenantContext(user, deps)
  if (!result.ok) redirect('/')
  return result.context
}
