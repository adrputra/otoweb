# Authentication

Status: implemented as **local PostgreSQL-backed authentication**. There is no
external identity provider and no Supabase dependency.

The application stores login identities and scrypt password hashes in
`profiles`, and opaque session records in `auth_sessions`. The browser receives
only a random HTTP-only cookie; the database stores its SHA-256 hash.

## What exists

| Artifact | Purpose |
| --- | --- |
| `proxy.ts` | Next.js 16 request proxy; redirects cookie-less `/admin/**` and `/platform/**` requests |
| `lib/auth/admin-proxy.ts` | Testable proxy factory with an injectable session resolver |
| `lib/auth/local-proxy.ts` | Fast cookie-presence probe used by the proxy (no database access) |
| `lib/auth/local.ts` | Request-scoped local auth backend factory |
| `lib/auth/local-backend.ts` | Sign-in, session lookup, sign-out, and password update against PostgreSQL |
| `lib/auth/crypto.ts` | scrypt password hashing and session-token hashing |
| `lib/auth/server.ts` | `getCurrentUser()` and `requireAdminUser()` |
| `lib/auth/actions.ts` | Server actions: sign in, sign out, reset request, password update |
| `lib/auth/service.ts` | Testable auth orchestration over the `AuthBackend` interface |
| `lib/auth/session.ts` | Cookie name, lifetime, and session-validity helpers |
| `lib/auth/paths.ts` | Safe same-origin `/admin` and `/platform` redirects |
| `app/login/` | Sign-in page and client form |
| `app/forgot-password/` | Operator-assisted reset request form |
| `app/reset-password/` | Password update for a signed-in user |
| `app/api/dev-login/` | Development/QA-only sign-in shortcut (disabled outside non-production with `ALLOW_DEV_LOGIN=1`) |
| `scripts/auth-admin.ts` | Operator CLI to create or reset an admin account |
| `tests/unit/auth/` | Crypto, local backend, session, proxy, flow, and no-registration tests |

## Routes

| Route | Access | Behavior |
| --- | --- | --- |
| `/login` | Public | Sign in with email/password; authenticated users redirect to a safe admin `next` |
| `/forgot-password` | Public | Submit an operator-assisted reset request; the response never reveals account existence |
| `/reset-password` | Signed-in | Set a new password for the current account |
| `/admin/**` | Signed-in + tenant member | Proxy checks the cookie; the layout verifies the session and tenant context |
| `/platform/**` | Signed-in + `platform_admin` | Proxy checks the cookie; the layout verifies the operator membership |
| `/register`, `/signup` | — | Do not exist; requests return 404 |

## Environment

Only the database and site origin are required:

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
NEXT_PUBLIC_SITE_URL=https://your-deployment.example
```

Create or reset an admin after migrations:

```bash
pnpm db:migrate
pnpm auth:admin --email admin@example.com --name "Administrator"
```

Omit `--password` to generate a random password; the command prints it once.
The default role is `platform_admin` (showroom admin plus `/platform`). Use
`--role owner` for a showroom-only owner and `--tenant <slug>` to choose the
tenant (default `prima-auto-gallery`).

## Session lifecycle

```text
anonymous --valid email/password--> active (HTTP-only otoweb_session cookie)
active --request--> hash cookie, look up auth_sessions, reject expired rows
active --Keluar--> delete session row and clear cookie
active --password update--> update scrypt hash; revoke every other session
expired/invalid/missing--> admin request redirects to /login
```

Key decisions:

- Passwords use Node's built-in scrypt with a 16-byte random salt and a 64-byte
  derived key. Verifications are constant-time.
- Session tokens are 32 random bytes. Only their SHA-256 hash is stored, so a
  database leak cannot replay a live session.
- The cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when
  `NODE_ENV=production`. Its lifetime is seven days.
- The proxy is a fast cookie gate and does not query the database. The admin
  and platform layouts are the authoritative server-side checks.
- Login errors do not reveal whether the email exists.

## Password reset

There is no email provider. Reset is operator-assisted:

1. The user submits the form at `/forgot-password`; the UI returns a generic
   acknowledgement.
2. The operator sets a new password:

   ```bash
   pnpm auth:admin --email user@example.com --password "new-password"
   ```

3. The user signs in with the new password. Existing sessions remain valid
   unless the password is changed from `/reset-password` (which revokes other
   sessions).

## No public registration

- No `register`/`signup` route exists in `app/`.
- Accounts are created by operators with `pnpm auth:admin`.
- `tests/unit/auth/no-registration.test.ts` walks the route tree and checks the
  auth screens; `tests/e2e/auth.spec.ts` asserts `/register`, `/signup`, and
  `/sign-up` return 404.

## Development and QA

- `SEED_DEV_AUTH=1` while seeding adds development credentials:
  - `owner@primaauto.test` / `correct-horse` (Prima owner)
  - `operator@otoweb.test` / `correct-horse` (platform operator)
- `ALLOW_DEV_LOGIN=1` enables `GET /api/dev-login?as=owner|operator`, which
  creates a real local session for those accounts. Both gates are required;
  the route returns 404 in production.
- Playwright and visual-QA scripts use this endpoint instead of injecting an
  auth cookie.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

Phase 5 integration remains unchanged: authentication alone is not sufficient
for tenant access. `requireAdminUser()` calls `requireTenantContext()` after the
session lookup, and the platform boundary requires an active `platform_admin`
membership. See [`TENANCY.md`](./TENANCY.md).
