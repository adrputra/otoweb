import { describe, expect, it } from 'vitest'

import { optimizedImageUrl, thumbnailImageUrl } from '@/lib/media/urls'

const cloudinary = 'https://res.cloudinary.com/demo/image/upload/v1700000000/otoweb/vehicles/a/b/c.jpg'

describe('optimizedImageUrl', () => {
  it('inserts a Cloudinary transformation before the public id', () => {
    expect(optimizedImageUrl(cloudinary, 480)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_480/v1700000000/otoweb/vehicles/a/b/c.jpg',
    )
  })

  it('updates the width of an existing Cloudinary transformation instead of nesting it', () => {
    const existing =
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_480/v1/otoweb/a.jpg'
    expect(optimizedImageUrl(existing, 1600)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_1600/v1/otoweb/a.jpg',
    )
  })

  it('adds responsive parameters to Unsplash URLs', () => {
    const url = optimizedImageUrl('https://images.unsplash.com/photo-123', 640)
    expect(url).toContain('auto=format')
    expect(url).toContain('fit=crop')
    expect(url).toContain('w=640')
    expect(url).toContain('q=82')
  })

  it('leaves R2 public URLs unchanged', () => {
    const url = 'https://media.example.com/otoweb/vehicles/tenant/vehicle/hash'
    expect(optimizedImageUrl(url, 480)).toBe(url)
  })

  it('leaves local and unknown URLs unchanged', () => {
    expect(optimizedImageUrl('/uploads/otoweb/a.png', 480)).toBe('/uploads/otoweb/a.png')
    expect(optimizedImageUrl('/placeholder.jpg', 480)).toBe('/placeholder.jpg')
    expect(optimizedImageUrl('https://example.test/a.jpg', 480)).toBe('https://example.test/a.jpg')
  })

  it('exposes a thumbnail alias', () => {
    expect(thumbnailImageUrl(cloudinary, 480)).toContain('w_480')
    expect(thumbnailImageUrl(cloudinary)).toContain('w_480')
  })
})
