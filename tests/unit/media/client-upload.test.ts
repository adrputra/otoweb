import { describe, expect, it } from 'vitest'

import {
  uploadFileWithProgress,
  type UploadProgress,
  type UploadXhr,
} from '@/lib/media/client-upload'

interface FakeResponse {
  readonly status: number
  readonly body: string
  readonly progress?: readonly number[]
  readonly fail?: 'error' | 'timeout'
}

class FakeXhr implements UploadXhr {
  upload: { onprogress: ((event: { loaded: number; total: number }) => void) | null } = {
    onprogress: null,
  }
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  ontimeout: (() => void) | null = null
  status = 0
  responseText = ''
  timeout = 0
  sent: FormData | null = null

  constructor(private readonly response: FakeResponse) {}

  open() {}

  send(body: FormData) {
    this.sent = body
    queueMicrotask(() => {
      for (const percent of this.response.progress ?? []) {
        this.upload.onprogress?.({ loaded: percent, total: 100 })
      }
      if (this.response.fail === 'error') {
        this.onerror?.()
        return
      }
      if (this.response.fail === 'timeout') {
        this.ontimeout?.()
        return
      }
      this.status = this.response.status
      this.responseText = this.response.body
      this.onload?.()
    })
  }

  abort() {}
}

function factory(responses: readonly FakeResponse[]): {
  create: () => UploadXhr
  calls: () => number
} {
  let index = 0
  return {
    create: () => new FakeXhr(responses[Math.min(index++, responses.length - 1)] as FakeResponse),
    calls: () => index,
  }
}

const file = new File([new Uint8Array([1, 2, 3])], 'foto depan.png', { type: 'image/png' })

describe('uploadFileWithProgress', () => {
  it('reports per-file progress and resolves the stored image', async () => {
    const progress: number[] = []
    const responses = factory([
      {
        status: 201,
        progress: [0, 25, 80, 100],
        body: JSON.stringify({ ok: true, data: { image: { id: 'image-1' } } }),
      },
    ])

    const result = await uploadFileWithProgress<{ image: { id: string } }>({
      url: '/api/admin/vehicles/vehicle-1/images',
      file,
      alt: 'foto depan',
      xhrFactory: responses.create,
      onProgress: ({ percent }: UploadProgress) => progress.push(percent),
    })

    expect(result).toEqual({ ok: true, data: { image: { id: 'image-1' } } })
    expect(progress).toEqual([0, 25, 80, 100, 100])
  })

  it('retries transient server errors and network failures', async () => {
    const serverErrors = factory([
      { status: 503, body: JSON.stringify({ ok: false, message: 'down' }) },
      { status: 201, body: JSON.stringify({ ok: true, data: { image: { id: 'image-2' } } }) },
    ])

    const result = await uploadFileWithProgress<{ image: { id: string } }>({
      url: '/api/admin/vehicles/vehicle-1/images',
      file,
      xhrFactory: serverErrors.create,
      sleep: async () => {},
    })

    expect(result).toEqual({ ok: true, data: { image: { id: 'image-2' } } })
    expect(serverErrors.calls()).toBe(2)

    const network = factory([
      { status: 0, body: '', fail: 'error' },
      { status: 201, body: JSON.stringify({ ok: true, data: { image: { id: 'image-3' } } }) },
    ])

    const networkResult = await uploadFileWithProgress<{ image: { id: string } }>({
      url: '/api/admin/vehicles/vehicle-1/images',
      file,
      xhrFactory: network.create,
      sleep: async () => {},
    })

    expect(networkResult).toMatchObject({ ok: true })
    expect(network.calls()).toBe(2)
  })

  it('does not retry validation failures', async () => {
    const responses = factory([
      {
        status: 400,
        body: JSON.stringify({ ok: false, error: 'invalid', message: 'Format foto salah.' }),
      },
    ])

    const result = await uploadFileWithProgress({
      url: '/api/admin/vehicles/vehicle-1/images',
      file,
      xhrFactory: responses.create,
      sleep: async () => {},
    })

    expect(result).toEqual({
      ok: false,
      error: { message: 'Format foto salah.', status: 400, retryable: false },
    })
    expect(responses.calls()).toBe(1)
  })

  it('gives up after the configured attempts and includes the request body', async () => {
    let attempts = 0
    let captured: FakeXhr | null = null

    const result = await uploadFileWithProgress({
      url: '/api/admin/vehicles/vehicle-1/images',
      file,
      alt: 'foto depan',
      retries: 1,
      xhrFactory: () => {
        attempts += 1
        captured = new FakeXhr({
          status: 500,
          body: JSON.stringify({ ok: false, message: 'boom' }),
        })
        return captured
      },
      sleep: async () => {},
    })

    expect(result).toMatchObject({ ok: false, error: { retryable: true, status: 500 } })
    expect(attempts).toBe(2)
    expect(captured).not.toBeNull()
    const sent = (captured as unknown as FakeXhr).sent
    expect(sent?.get('alt')).toBe('foto depan')
    expect(sent?.get('file')).toBeInstanceOf(File)
  })

  it('treats timeouts as retryable', async () => {
    const responses = factory([{ status: 0, body: '', fail: 'timeout' }])
    const result = await uploadFileWithProgress({
      url: '/api/admin/vehicles/vehicle-1/images',
      file,
      retries: 0,
      xhrFactory: responses.create,
    })

    expect(result).toMatchObject({ ok: false, error: { message: /batas waktu/i } })
  })
})
