export type Availability = 'available' | 'reserved' | 'sold'
export type Publication = 'draft' | 'published' | 'archived'
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
  images: { id: string; url: string; alt: string; order: number; isCover: boolean }[]
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
  address: { street: string; city: string; mapUrl: string; openingHours: string }
  social: { instagram?: string; tiktok?: string; facebook?: string }
  seo: { title: string; description: string }
  hero: { headline: string; subheadline: string; ctaLabel: string }
}
export interface Lead {
  id: string
  name: string
  phone: string
  vehicleId?: string
  source: 'whatsapp' | 'form' | 'phone'
  message: string
  status: 'new' | 'contacted' | 'closed'
  createdAt: string
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
