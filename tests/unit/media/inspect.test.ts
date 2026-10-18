// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { inspectImage } from '@/lib/media/inspect'
import { MAX_IMAGE_BYTES } from '@/lib/media/limits'

import { createPngFixture } from '../../helpers/image-fixtures'

function jpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
  ])
}

function webpVp8x(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  bytes.set([0x56, 0x50, 0x38, 0x58], 12)
  const w = width - 1
  const h = height - 1
  bytes[24] = w & 0xff
  bytes[25] = (w >> 8) & 0xff
  bytes[26] = (w >> 16) & 0xff
  bytes[27] = h & 0xff
  bytes[28] = (h >> 8) & 0xff
  bytes[29] = (h >> 16) & 0xff
  return bytes
}

function webpVp8l(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(25)
  bytes.set([0x52, 0x49, 0x46, 0x46], 0)
  bytes.set([0x57, 0x45, 0x42, 0x50], 8)
  bytes.set([0x56, 0x50, 0x38, 0x4c], 12)
  bytes[20] = 0x2f
  const w = width - 1
  const h = height - 1
  bytes[21] = w & 0xff
  bytes[22] = ((w >> 8) & 0x3f) | ((h & 0x03) << 6)
  bytes[23] = (h >> 2) & 0xff
  bytes[24] = (h >> 10) & 0x0f
  return bytes
}

describe('inspectImage', () => {
  it('reads PNG dimensions from the IHDR header', () => {
    const result = inspectImage(createPngFixture({ width: 800, height: 600 }))
    expect(result).toMatchObject({
      ok: true,
      image: { contentType: 'image/png', extension: 'png', width: 800, height: 600 },
    })
  })

  it('reads JPEG dimensions from a start-of-frame segment', () => {
    const result = inspectImage(jpegHeader(1200, 800))
    expect(result).toMatchObject({
      ok: true,
      image: { contentType: 'image/jpeg', extension: 'jpg', width: 1200, height: 800 },
    })
  })

  it('reads WebP VP8X dimensions', () => {
    const result = inspectImage(webpVp8x(1600, 900))
    expect(result).toMatchObject({
      ok: true,
      image: { contentType: 'image/webp', extension: 'webp', width: 1600, height: 900 },
    })
  })

  it('reads WebP VP8L dimensions', () => {
    const result = inspectImage(webpVp8l(800, 600))
    expect(result).toMatchObject({
      ok: true,
      image: { contentType: 'image/webp', width: 800, height: 600 },
    })
  })

  it('rejects empty, corrupt, unsupported, oversized, and too-small content', () => {
    expect(inspectImage(new Uint8Array())).toMatchObject({ ok: false, code: 'corrupt' })
    expect(inspectImage(new TextEncoder().encode('not an image'))).toMatchObject({
      ok: false,
      code: 'unsupported_type',
    })
    expect(
      inspectImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toMatchObject({
      ok: false,
      code: 'corrupt',
    })
    expect(inspectImage(new Uint8Array(MAX_IMAGE_BYTES + 1))).toMatchObject({
      ok: false,
      code: 'too_large',
    })
    expect(inspectImage(createPngFixture({ width: 320, height: 200 }))).toMatchObject({
      ok: false,
      code: 'too_small',
    })
  })
})
