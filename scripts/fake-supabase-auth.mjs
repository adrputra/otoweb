import { createServer } from 'node:http'

/**
 * QA-only GoTrue stand-in.
 *
 * Visual QA and the admin Playwright acceptance need a logged-in session but
 * this repository has no Supabase project (and no Docker). This server answers
 * the two endpoints auth-js calls for an already-issued access token. It is
 * started only by the QA scripts; the application never imports or enables it.
 */

const port = Number(process.env.FAKE_AUTH_PORT ?? 54321)
const userId = process.env.FAKE_AUTH_USER_ID ?? '50000000-0000-4000-8000-000000000001'
const email = process.env.FAKE_AUTH_EMAIL ?? 'owner@primaauto.test'

const user = {
  id: userId,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  email_confirmed_at: '2026-10-18T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-10-18T00:00:00.000Z',
  last_sign_in_at: '2026-10-18T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Aditya Pranata' },
  identities: [],
  created_at: '2026-10-18T00:00:00.000Z',
  updated_at: '2026-10-18T00:00:00.000Z',
}

function send(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`)

  if (url.pathname === '/health') {
    send(response, 200, { ok: true })
    return
  }

  if (url.pathname === '/auth/v1/user') {
    send(response, 200, { user })
    return
  }

  if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
    send(response, 200, {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user,
    })
    return
  }

  send(response, 404, { error: 'not_found' })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`[fake-auth] listening on http://127.0.0.1:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
