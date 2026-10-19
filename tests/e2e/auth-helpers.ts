import type { BrowserContext } from '@playwright/test'

/**
 * Sign in through the development-only local-auth endpoint.
 *
 * The endpoint seeds a real PostgreSQL session cookie. It is only enabled in
 * the Playwright dev servers via `ALLOW_DEV_LOGIN=1` and `SEED_DEV_AUTH=1`.
 */
async function devSignIn(context: BrowserContext, as: 'owner' | 'operator'): Promise<void> {
  const response = await context.request.get(`/api/dev-login?as=${as}`, {
    maxRedirects: 0,
  })

  if (response.status() !== 307 && response.status() !== 200) {
    throw new Error(`Dev sign-in failed for ${as}: HTTP ${response.status()}`)
  }
}

export function signInAsOwner(context: BrowserContext): Promise<void> {
  return devSignIn(context, 'owner')
}

export function signInAsOperator(context: BrowserContext): Promise<void> {
  return devSignIn(context, 'operator')
}
