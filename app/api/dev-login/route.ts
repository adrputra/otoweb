import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { getAppDatabase } from '@/lib/db/runtime'
import { createLocalAuthBackend, type AuthCookieStore } from '@/lib/auth/local-backend'

/**
 * Development/visual-QA only sign-in shortcut.
 *
 * Disabled unless BOTH `NODE_ENV !== 'production'` and `ALLOW_DEV_LOGIN=1`.
 * The seeded development accounts are only created when `SEED_DEV_AUTH=1` is
 * present while seeding. Production deployments never expose this route.
 *
 * Query: `?as=owner` (default) or `?as=operator`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_LOGIN !== '1') {
    return new NextResponse('Not found', { status: 404 })
  }

  const asOperator = request.nextUrl.searchParams.get('as') === 'operator'
  const email = asOperator ? 'operator@otoweb.test' : 'owner@primaauto.test'
  const destination = asOperator ? '/platform' : '/admin'

  const db = await getAppDatabase()
  const cookieStore = await cookies()
  const auth = createLocalAuthBackend({
    db,
    cookies: cookieStore as unknown as AuthCookieStore,
  })

  const result = await auth.signInWithPassword({
    email,
    password: 'correct-horse',
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: 'Development account is not seeded. Set SEED_DEV_AUTH=1 and re-seed.' },
      { status: 401 },
    )
  }

  return NextResponse.redirect(new URL(destination, request.url))
}
