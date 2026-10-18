import { deflateSync } from 'node:zlib'

/** Minimal deterministic PNG encoder used to prove high-resolution uploads. */

const CRC_TABLE = new Uint32Array(256)

for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  CRC_TABLE[index] = value >>> 0
}

function crc32(buffer: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function uint32(value: number): Buffer {
  const buffer = Buffer.alloc(4)
  buffer.writeUInt32BE(value >>> 0, 0)
  return buffer
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii')
  const payload = Buffer.concat([typeBuffer, data])
  return Buffer.concat([uint32(data.length), payload, uint32(crc32(payload))])
}

export interface PngFixtureOptions {
  readonly width: number
  readonly height: number
  readonly color?: readonly [number, number, number]
}

/** Build a valid 8-bit RGB PNG with a solid colour. */
export function createPngFixture(options: PngFixtureOptions): Uint8Array {
  const { width, height } = options
  const [red, green, blue] = options.color ?? [180, 120, 40]

  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // colour type: truecolour
  header[10] = 0
  header[11] = 0
  header[12] = 0

  const row = Buffer.alloc(1 + width * 3)
  row[0] = 0 // filter: none
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = red
    row[2 + x * 3] = green
    row[3 + x * 3] = blue
  }

  const raw = Buffer.alloc(row.length * height)
  for (let y = 0; y < height; y += 1) {
    row.copy(raw, y * row.length)
  }

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const png = Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])

  return new Uint8Array(png)
}

/** `count` distinct high-resolution images (3000×2000 by default). */
export function createHighResolutionImages(
  count: number,
  options: { width?: number; height?: number } = {},
): Uint8Array[] {
  const width = options.width ?? 3000
  const height = options.height ?? 2000

  return Array.from({ length: count }, (_, index) =>
    createPngFixture({
      width,
      height,
      color: [(index * 37 + 40) % 256, (index * 67 + 90) % 256, (index * 97 + 140) % 256],
    }),
  )
}
