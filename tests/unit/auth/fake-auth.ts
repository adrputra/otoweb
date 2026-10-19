import { isSessionActive } from '@/lib/auth/session'
import type { AuthBackend, AuthResult, AuthUser, SignInCredentials } from '@/lib/auth/types'

export interface FakeAccount {
  user: AuthUser
  password: string
  /** Epoch milliseconds; null/undefined means no known expiry. */
  expiresAt?: number | null
}

export type FakeFailure = 'signIn' | 'signOut' | 'requestReset' | 'updatePassword' | 'getUser'

export interface FakeAuthOptions {
  accounts?: FakeAccount[]
  startSignedInAs?: string
  sessionExpiresAt?: number | null
}

const UNKNOWN_EMAIL = 'unknown@example.com'

export const testUser: AuthUser = {
  id: '50000000-0000-4000-8000-000000000001',
  email: 'owner@example.com',
  displayName: 'Aditya Pranata',
}

export const secondUser: AuthUser = {
  id: '50000000-0000-4000-8000-000000000002',
  email: 'sales@example.com',
  displayName: 'Sales Showroom',
}

/**
 * Controlled in-memory AuthBackend used to prove auth behavior without a live
 * auth server. It implements the production interface exactly.
 */
export class FakeAuthBackend implements AuthBackend {
  readonly accounts = new Map<string, FakeAccount>()
  session: { email: string; expiresAt: number | null } | null = null
  failNext: FakeFailure | null = null
  signOutCalls = 0
  resetRequests: { email: string; redirectTo?: string }[] = []
  passwordUpdates: string[] = []

  constructor(options: FakeAuthOptions = {}) {
    const accounts = options.accounts ?? [
      { user: testUser, password: 'correct-horse' },
      { user: secondUser, password: 'battery-staple' },
    ]

    for (const account of accounts) {
      this.accounts.set(this.key(account.user.email), account)
    }

    if (options.startSignedInAs) {
      this.session = {
        email: this.key(options.startSignedInAs),
        expiresAt: options.sessionExpiresAt ?? null,
      }
    }
  }

  private key(email: string | null | undefined): string {
    return (email ?? UNKNOWN_EMAIL).trim().toLowerCase()
  }

  private accountFor(email: string): FakeAccount | undefined {
    return this.accounts.get(this.key(email))
  }

  private currentAccount(): FakeAccount | null {
    if (!this.session) return null

    const account = this.accounts.get(this.session.email)
    if (!account) return null

    const active = isSessionActive(
      { user: account.user, expiresAt: this.session.expiresAt },
      Date.now(),
    )

    if (!active) {
      this.session = null
      return null
    }

    return account
  }

  async getUser(): Promise<AuthUser | null> {
    if (this.failNext === 'getUser') {
      this.failNext = null
      throw new Error('Auth provider unavailable')
    }

    return this.currentAccount()?.user ?? null
  }

  async signInWithPassword(credentials: SignInCredentials): Promise<AuthResult<AuthUser>> {
    if (this.failNext === 'signIn') {
      this.failNext = null
      throw new Error('Auth provider unavailable')
    }

    const account = this.accountFor(credentials.email)
    if (!account || account.password !== credentials.password) {
      return { ok: false, error: 'invalid_credentials' }
    }

    this.session = {
      email: this.key(account.user.email),
      expiresAt: account.expiresAt ?? null,
    }

    return { ok: true, data: account.user }
  }

  async signOut(): Promise<AuthResult<null>> {
    this.signOutCalls += 1

    if (this.failNext === 'signOut') {
      this.failNext = null
      throw new Error('Auth provider unavailable')
    }

    this.session = null
    return { ok: true, data: null }
  }

  async requestPasswordReset(email: string, redirectTo?: string): Promise<AuthResult<null>> {
    if (this.failNext === 'requestReset') {
      this.failNext = null
      throw new Error('Auth provider unavailable')
    }

    this.resetRequests.push({ email: this.key(email), redirectTo })
    return { ok: true, data: null }
  }

  async updatePassword(password: string): Promise<AuthResult<AuthUser>> {
    if (this.failNext === 'updatePassword') {
      this.failNext = null
      throw new Error('Auth provider unavailable')
    }

    const account = this.currentAccount()
    if (!account) return { ok: false, error: 'session_invalid' }

    account.password = password
    this.passwordUpdates.push(password)
    return { ok: true, data: account.user }
  }

  /** Expire the active session without signing out. */
  expireSession(expiresAt: number = Date.now() - 1_000): void {
    if (this.session) this.session.expiresAt = expiresAt
  }

  /** Simulate remote invalidation or a tampered session. */
  invalidateSession(): void {
    this.session = null
  }
}
