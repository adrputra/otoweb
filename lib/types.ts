export type Availability = 'available' | 'reserved' | 'sold'
export type Publication = 'draft' | 'published' | 'archived'

export interface VehicleImage {
  id: string
  url: string
  alt: string
  order: number
  isCover: boolean
  /** Smaller provider transformation used by grids and cards. */
  thumbnailUrl?: string
  provider?: string
  providerAssetId?: string | null
  width?: number | null
  height?: number | null
}

export interface Vehicle {
  id: string
  slug: string
  brand: string
  model: string
  variant: string
  year: number
  bodyType: string
  transmission: 'AT' | 'MT' | 'CVT'
  fuel: 'bensin' | 'diesel' | 'hybrid' | 'listrik'
  mileageKm: number
  color: string
  engineCc: number
  price: number
  originalPrice?: number
  taxExpiry: string
  plateRegion: string
  ownerCount: number
  documents: { stnk: boolean; bpkb: boolean }
  features: string[]
  description: string
  images: VehicleImage[]
  availability: Availability
  publication: Publication
  featured: boolean
  location: string
  createdAt: string
  updatedAt: string
}
export interface Showroom {
  id: string
  slug: string
  name: string
  tagline: string
  description: string
  logoUrl: string
  heroImageUrl: string
  colors: { primary: string; secondary: string }
  contact: { phone: string; whatsapp: string; email: string }
  address: {
    street: string
    city: string
    province: string
    postalCode: string
    mapUrl: string
    openingHours: string
  }
  social: { instagram?: string; tiktok?: string; facebook?: string }
  seo: { title: string; description: string }
  hero: { headline: string; subheadline: string; ctaLabel: string }
}
export type LeadSource = 'contact_form' | 'whatsapp' | 'phone' | 'manual'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'won' | 'lost'

export interface Lead {
  id: string
  name: string
  phone: string
  email: string
  vehicleId?: string
  vehicleLabel?: string
  source: LeadSource
  message: string
  status: LeadStatus
  createdAt: string
  updatedAt: string
}
export interface StaffMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'sales'
  active: boolean
}
export interface VehicleFilters {
  brand?: string
  model?: string
  minPrice?: number
  maxPrice?: number
  year?: number
  transmission?: Vehicle['transmission']
  fuel?: Vehicle['fuel']
  maxMileage?: number
  sort?: string
}
