# Contract: Auth Backend and Routes

**Feature**: `003-authentication`  
**Date**: 2026-10-18

## `AuthBackend` interface

Production implementation: `lib/auth/supabase-server.ts` using
`@supabase/ssr`. Test implementation: `tests/unit/auth/fake-auth.ts`.

```ts
export interface AuthUser {
  id: string
  email: string | null
  displayName: string | null
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'not_configured'
  | 'session_expired'
  | 'session_invalid'
  | 'weak_password'
  | 'unexpected'

export type AuthResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AuthErrorCode; message?: string }

export interface AuthBackend {
  getUser(): Promise<AuthUser | null>
  signInWithPassword(credentials: {
    email: string
    password: string
  }): Promise<AuthResult<AuthUser>>
  signOut(): Promise<AuthResult<null>>
  requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult<null>>
  updatePassword(password: string): Promise<AuthResult<AuthUser>>
}
```

**Contract guarantees**:
- `getUser()` returns `null` for anonymous, expired, invalid, or unavailable
  sessions; it never throws to callers that use the session helpers.
- `signInWithPassword()` returns `invalid_credentials` for wrong email/password
  and does not establish a session on failure.
- `signOut()` clears the provider session/cookies and is idempotent.
- `requestPasswordReset()` never reveals whether the email exists to the caller;
  the orchestration returns a generic success message.
- `updatePassword()` requires an active recovery/session context and rejects
  otherwise.

## Proxy resolver contract

```ts
export interface AuthResolution {
  user: AuthUser | null
  cookies?: { name: string; value: string; options?: CookieOptions }[]
  headers?: Record<string, string>
}

export type AuthResolver = (request: NextRequest) => Promise<AuthResolution>
```

`lib/auth/admin-proxy.ts` accepts an injected `resolveAuth`. The default resolver
is the Supabase proxy resolver. The proxy:

1. resolves the user, catching resolver errors as anonymous;
2. returns `NextResponse.next()` when a user exists;
3. otherwise redirects to `/login?next=<safe admin path>`;
4. applies refreshed cookies and cache headers to whichever response is returned.

## HTTP routes

| Method | Route | Auth required | Behavior |
|---|---|---|---|
| GET | `/login` | No | Renders sign-in; authenticated users redirect to safe `next`/`/admin` |
| POST (server action) | `/login` | No | Validates credentials, creates session, redirects to safe `next`/`/admin` |
| GET | `/forgot-password` | No | Renders reset request form |
| POST (server action) | `/forgot-password` | No | Requests Supabase reset email; generic success |
| GET | `/auth/callback?code=...&next=...` | No | Exchanges code/PKCE for session; redirects to safe `next` |
| GET | `/auth/callback?token_hash=...&type=recovery&next=...` | No | Verifies email OTP; redirects to safe `next` |
| GET | `/reset-password` | Recovery session | Renders new-password form or an invalid-link state |
| POST (server action) | `/reset-password` | Recovery session | Updates password; redirects to `/admin` |
| POST (server action) | admin shell | Yes | Signs out, clears cookies, redirects to `/login` |
| GET | `/admin/**` | Yes | Proxy allows only verified sessions; layout guards again |
| GET | `/register`, `/signup` | n/a | 404 (no route exists) |

## Environment contract

| Variable | Visibility | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Production | Placeholder in `.env.example` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Production | Placeholder in `.env.example`; never a service-role key |
| `NEXT_PUBLIC_SITE_URL` | public | No (default `http://localhost:3000`) | Used to build the reset callback URL |

No server-only Supabase Auth secret is needed for this feature. A service-role
key must never be added.
