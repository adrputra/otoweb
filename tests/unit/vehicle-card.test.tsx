import type { ReactNode } from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { VehicleCard } from '@/components/showroom'
import type { Vehicle } from '@/lib/types'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // The mock intentionally uses a plain img to avoid loading Next's image
    // runtime in jsdom.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const vehicle: Vehicle = {
  id: 'car-1',
  slug: 'toyota-fortuner-2021',
  brand: 'Toyota',
  model: 'Fortuner',
  variant: 'VRZ',
  year: 2021,
  bodyType: 'SUV',
  transmission: 'AT',
  fuel: 'diesel',
  mileageKm: 45_000,
  color: 'Putih',
  engineCc: 2_400,
  price: 150_000_000,
  taxExpiry: '2027-01-01',
  plateRegion: 'B',
  ownerCount: 1,
  documents: { stnk: true, bpkb: true },
  features: ['ABS', 'Airbags'],
  description: 'Unit terawat dengan riwayat servis lengkap.',
  images: [
    {
      id: 'img-1',
      url: '/vehicle.jpg',
      alt: 'Toyota Fortuner VRZ',
      order: 0,
      isCover: true,
    },
  ],
  availability: 'available',
  publication: 'published',
  featured: true,
  location: 'Jakarta',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('VehicleCard', () => {
  it('renders the vehicle identity, price, status, and detail link', () => {
    render(<VehicleCard vehicle={vehicle} />)

    expect(screen.getByText('Toyota')).toBeInTheDocument()
    expect(screen.getByText(/Fortuner/)).toBeInTheDocument()
    expect(screen.getByText('Tersedia')).toBeInTheDocument()
    expect(screen.getByText(/150\.000\.000/)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/cars/toyota-fortuner-2021')
  })
})
