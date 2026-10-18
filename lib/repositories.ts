import { showroom, vehicles, leads, staff } from '@/data'
import type { VehicleFilters } from '@/lib/types'
export async function getShowroom() {
  return showroom
}
export async function listVehicles(filters: VehicleFilters = {}) {
  let out = vehicles.filter((v) => v.publication === 'published')
  if (filters.brand) out = out.filter((v) => v.brand === filters.brand)
  if (filters.model) out = out.filter((v) => v.model === filters.model)
  if (filters.minPrice) out = out.filter((v) => v.price >= filters.minPrice!)
  if (filters.maxPrice) out = out.filter((v) => v.price <= filters.maxPrice!)
  if (filters.year) out = out.filter((v) => v.year === filters.year)
  if (filters.transmission) out = out.filter((v) => v.transmission === filters.transmission)
  if (filters.fuel) out = out.filter((v) => v.fuel === filters.fuel)
  if (filters.maxMileage) out = out.filter((v) => v.mileageKm <= filters.maxMileage!)
  const sort = filters.sort || 'terbaru'
  return out.sort((a, b) =>
    sort === 'harga-terendah'
      ? a.price - b.price
      : sort === 'harga-tertinggi'
        ? b.price - a.price
        : sort === 'tahun-terbaru'
          ? b.year - a.year
          : sort === 'km-terendah'
            ? a.mileageKm - b.mileageKm
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}
export async function getVehicleBySlug(slug: string) {
  return vehicles.find((v) => v.slug === slug)
}
export async function getRelatedVehicles(vehicleId: string) {
  const v = vehicles.find((x) => x.id === vehicleId)
  return vehicles
    .filter(
      (x) => x.id !== vehicleId && x.publication === 'published' && x.bodyType === v?.bodyType,
    )
    .slice(0, 3)
}
export async function listLeads() {
  return leads
}
export async function listStaff() {
  return staff
}
