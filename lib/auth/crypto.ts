import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)

const HASH_PREFIX = 'scrypt'
const SALT_BYTES = 16
const KEY_BYTES = 64
const MAX_PASSWORD_LENGTH = 1024

/**
 * Hash a password with Node's built-in scrypt.
 *
 * Stored format: `scrypt$<salt base64url>$<derived key base64url>`. Keeping the
 * salt in the value makes each hash unique without a separate column.
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error('Password exceeds the maximum supported length.')
  }

  const salt = randomBytes(SALT_BYTES)
  const derived = (await scrypt(password, salt, KEY_BYTES)) as Buffer

  return `${HASH_PREFIX}$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

/** Constant-time verification of a stored scrypt hash. Malformed values fail closed. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (password.length > MAX_PASSWORD_LENGTH) return false

  const [prefix, saltPart, hashPart] = stored.split('$')
  if (prefix !== HASH_PREFIX || !saltPart || !hashPart) return false

  const salt = Buffer.from(saltPart, 'base64url')
  const expected = Buffer.from(hashPart, 'base64url')
  if (salt.length < 8 || expected.length < 16) return false

  const derived = (await scrypt(password, salt, expected.length)) as Buffer
  if (derived.length !== expected.length) return false

  return timingSafeEqual(derived, expected)
}

/** Generate an opaque session token for the browser cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Store only a hash of the session token so a database leak cannot replay sessions. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
