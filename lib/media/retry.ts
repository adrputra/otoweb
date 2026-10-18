import {
  isMediaProviderError,
  type MediaProvider,
  type MediaUploadInput,
  type MediaUploadResult,
} from './types'

export interface RetryOptions {
  /** Total attempts, including the first. Default 3. */
  readonly attempts?: number
  /** First backoff delay; doubles per retry. Default 200 ms. */
  readonly baseDelayMs?: number
  readonly sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Upload through a provider, retrying only failures classified as transient.
 * Permanent failures (invalid media, rejected credentials) surface immediately.
 */
export async function uploadWithRetry(
  provider: MediaProvider,
  input: MediaUploadInput,
  options: RetryOptions = {},
): Promise<MediaUploadResult> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 200)
  const sleep = options.sleep ?? defaultSleep

  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await provider.upload(input)
    } catch (error) {
      lastError = error

      const retryable = isMediaProviderError(error) && error.code === 'transient'
      if (!retryable || attempt === attempts) throw error

      await sleep(baseDelayMs * 2 ** (attempt - 1))
    }
  }

  throw lastError
}
