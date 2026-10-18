# Data Model: Authentication

**Feature**: `003-authentication`  
**Date**: 2026-10-18

Phase 4 does not add database tables or migrations. It consumes Supabase Auth
identities and stores session state in cookies. The entities below describe the
runtime contracts and state transitions.

## Auth identity

Represents a Supabase Auth user. The application never creates one.

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Supabase Auth user id; intended to match `profiles.id` in a later phase |
| `email` | string \| null | Used for display and sign-in |
| `displayName` | string \| null | Derived from user metadata (`full_name`/`name`) when present |

**Ownership**: Supabase Auth. The application reads it only.

**Invariants**:
- An identity without an id is not a valid session.
- The application does not persist or mutate identity data in Phase 4.

## Session

The cookie-backed access/refresh token pair plus the verified user lookup.

| Field | Type | Notes |
|---|---|---|
| `accessToken` | cookie (HTTP-only) | Managed by `@supabase/ssr`; never read by UI code |
| `refreshToken` | cookie (HTTP-only) | Managed by `@supabase/ssr` |
| `user` | `AuthUser` \| null | Result of server-verified `getUser()` |
| `expiresAt` | number (epoch ms) \| null | Used by the pure session helper and fake backend |

**State transitions**:

```text
anonymous --signInWithPassword(valid)--> active
anonymous --signInWithPassword(invalid)--> anonymous (error, no session)
active --request with valid token--> active
active --token expired, refresh succeeds--> active (cookies refreshed)
active --token expired, refresh fails--> expired -> treated as anonymous
active --invalid/tampered token--> invalid -> treated as anonymous
active --signOut--> anonymous (cookies cleared)
active --reset link callback--> recovery (same identity, recovery context)
recovery --updatePassword--> active (new password)
recovery --updatePassword without session--> rejected
```

**Invariants**:
- Admin access requires `user != null` from a server-verified lookup.
- Expired or invalid sessions must never grant admin access.
- Refreshed cookies must be written to the response that carries the request.

## Password reset request

| Field | Type | Notes |
|---|---|---|
| `email` | string | Trimmed, valid email; max 254 characters |
| `redirectTo` | string | `<site>/auth/callback?next=/reset-password` |
| `requestedAt` | number (epoch ms) | Audit value in tests only; Supabase owns delivery |

**Invariants**:
- The user-visible response is identical for known and unknown emails.
- No password is stored or logged by the application.

## Form validation rules

| Form | Field | Rule |
|---|---|---|
| Sign-in | `email` | Valid email, required, max 254 |
| Sign-in | `password` | Required, non-empty (provider decides correctness) |
| Forgot password | `email` | Valid email, required, max 254 |
| Reset password | `password` | Minimum 8 characters, max 72 |
| Reset password | `confirmPassword` | Must equal `password` |
| Login `next` | `next` | Same-origin admin path or `/admin` fallback |

## Relationship to existing schema

- `profiles.id` is already a UUID primary key intended to match a Supabase Auth
  user id. Phase 4 does not create profiles or memberships; Phase 5 owns tenant
  membership and role enforcement.
- `tenant_members` links profiles to tenants. Phase 4 does not query it.
