/**
 * Browser upload transport for vehicle images.
 *
 * `XMLHttpRequest` is used instead of `fetch` because it exposes real upload
 * progress. One request carries one file so progress and failures stay
 * per-file; transient network/5xx failures retry with backoff.
 */

export interface UploadProgress {
  readonly loaded: number
  readonly total: number
  readonly percent: number
}

export interface ClientUploadError {
  readonly message: string
  readonly status?: number
  readonly retryable: boolean
}

export type ClientUploadResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ClientUploadError }

/** Minimal XHR surface used by the uploader, injectable for tests. */
export interface UploadXhr {
  upload: {
    onprogress: ((event: { loaded: number; total: number }) => void) | null
  }
  onload: (() => void) | null
  onerror: (() => void) | null
  ontimeout: (() => void) | null
  readonly status: number
  readonly responseText: string
  timeout: number
  open(method: string, url: string): void
  send(body: FormData): void
  abort(): void
}

export interface UploadFileOptions {
  readonly url: string
  readonly file: File
  readonly alt?: string
  /** Additional multipart fields for non-image specific upload contracts. */
  readonly fields?: Readonly<Record<string, string>>
  /** Additional attempts after the first. Default 2. */
  readonly retries?: number
  /** Abort a stalled request. Default 60 seconds. */
  readonly timeoutMs?: number
  readonly onProgress?: (progress: UploadProgress) => void
  readonly xhrFactory?: () => UploadXhr
  readonly sleep?: (ms: number) => Promise<void>
}

interface Envelope<T> {
  ok?: boolean
  data?: T
  message?: string
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function defaultXhr(): UploadXhr {
  // XMLHttpRequest satisfies the structural surface above; the cast keeps the
  // transport test-injectable without leaking the DOM type through the module.
  return new XMLHttpRequest() as unknown as UploadXhr
}

function isRetryableStatus(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500
}

function parseEnvelope<T>(text: string): Envelope<T> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Envelope<T>) : null
  } catch {
    return null
  }
}

function attempt<T>(
  options: UploadFileOptions,
  factory: () => UploadXhr,
): Promise<ClientUploadResult<T>> {
  return new Promise((resolve) => {
    const xhr = factory()
    let settled = false

    const finish = (result: ClientUploadResult<T>) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const form = new FormData()
    form.append('file', options.file, options.file.name)
    if (options.alt) form.append('alt', options.alt)
    for (const [key, value] of Object.entries(options.fields ?? {})) {
      if (key !== 'file') form.append(key, value)
    }

    xhr.upload.onprogress = (event) => {
      const percent =
        event.total > 0 ? Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100))) : 0
      options.onProgress?.({ loaded: event.loaded, total: event.total, percent })
    }

    xhr.onload = () => {
      const envelope = parseEnvelope<T>(xhr.responseText)

      if (xhr.status >= 200 && xhr.status < 300) {
        if (!envelope || envelope.ok !== true) {
          finish({
            ok: false,
            error: { message: envelope?.message ?? 'Respons unggahan tidak valid.', status: xhr.status, retryable: false },
          })
          return
        }
        options.onProgress?.({ loaded: options.file.size, total: options.file.size, percent: 100 })
        finish({ ok: true, data: envelope.data as T })
        return
      }

      finish({
        ok: false,
        error: {
          message: envelope?.message ?? 'Gagal mengunggah foto.',
          status: xhr.status,
          retryable: isRetryableStatus(xhr.status),
        },
      })
    }

    xhr.onerror = () => {
      finish({
        ok: false,
        error: { message: 'Koneksi terputus saat mengunggah foto.', retryable: true },
      })
    }

    xhr.ontimeout = () => {
      finish({
        ok: false,
        error: { message: 'Unggahan melewati batas waktu.', retryable: true },
      })
    }

    xhr.timeout = options.timeoutMs ?? 60_000
    xhr.open('POST', options.url)
    xhr.send(form)
  })
}

/** Upload one file with per-file progress and bounded transient retries. */
export async function uploadFileWithProgress<T>(
  options: UploadFileOptions,
): Promise<ClientUploadResult<T>> {
  const attempts = Math.max(1, (options.retries ?? 2) + 1)
  const factory = options.xhrFactory ?? defaultXhr
  const sleep = options.sleep ?? defaultSleep

  let last: ClientUploadResult<T> | null = null

  for (let attemptIndex = 1; attemptIndex <= attempts; attemptIndex += 1) {
    last = await attempt(options, factory)
    if (last.ok) return last
    if (!last.error.retryable || attemptIndex === attempts) return last

    options.onProgress?.({ loaded: 0, total: options.file.size, percent: 0 })
    await sleep(400 * 2 ** (attemptIndex - 1))
  }

  return (
    last ?? {
      ok: false,
      error: { message: 'Gagal mengunggah foto.', retryable: true },
    }
  )
}
