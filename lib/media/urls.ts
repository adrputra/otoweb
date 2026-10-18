/**
 * Provider-aware responsive image URLs.
 *
 * The stored URL always remains the original. These helpers derive a delivery
 * URL with the provider's own transformation parameters so thumbnails are
 * optimized without storing duplicate variants.
 */

const CLOUDINARY_MARKER = '/image/upload/'
const TRANSFORMATION_FLAGS = /(?:^|,)(f_auto|q_auto|c_limit|w_\d+)/

function optimizedCloudinaryUrl(url: string, width: number): string {
  const markerIndex = url.indexOf(CLOUDINARY_MARKER)
  if (markerIndex < 0) return url

  const head = url.slice(0, markerIndex + CLOUDINARY_MARKER.length)
  const tail = url.slice(markerIndex + CLOUDINARY_MARKER.length)
  const segments = tail.split('/')
  const first = segments[0] ?? ''

  if (TRANSFORMATION_FLAGS.test(first)) {
    const updated = first.replace(/w_\d+/g, `w_${width}`)
    return `${head}${[updated, ...segments.slice(1)].join('/')}`
  }

  return `${head}f_auto,q_auto,c_limit,w_${width}/${tail}`
}

function optimizedUnsplashUrl(url: string, width: number): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('auto', 'format')
    parsed.searchParams.set('fit', 'crop')
    parsed.searchParams.set('w', String(width))
    parsed.searchParams.set('q', '82')
    return parsed.toString()
  } catch {
    return url
  }
}

/** Return an optimized URL for the asset's provider, or the original URL. */
export function optimizedImageUrl(url: string, width: number): string {
  if (!url) return url

  const safeWidth = Number.isFinite(width) ? Math.max(1, Math.round(width)) : 1

  if (url.includes('res.cloudinary.com') && url.includes(CLOUDINARY_MARKER)) {
    return optimizedCloudinaryUrl(url, safeWidth)
  }

  if (url.includes('images.unsplash.com')) {
    return optimizedUnsplashUrl(url, safeWidth)
  }

  return url
}

/** Admin grid thumbnail (small) or public card thumbnail. */
export function thumbnailImageUrl(url: string, width = 480): string {
  return optimizedImageUrl(url, width)
}
