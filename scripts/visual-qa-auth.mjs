/**
 * Visual-QA helper: start a real local PostgreSQL session for the seeded
 * development account. The app exposes this only when ALLOW_DEV_LOGIN=1 and
 * NODE_ENV is not production.
 */
export async function signIn(context, baseUrl, as = 'owner') {
  const response = await context.request.get(`${baseUrl}/api/dev-login?as=${as}`, {
    maxRedirects: 0,
  })

  if (response.status() !== 307 && response.status() !== 200) {
    throw new Error(`Dev sign-in failed for ${as}: HTTP ${response.status()}`)
  }
}
