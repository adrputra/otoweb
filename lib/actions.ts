'use server'
import { vehicles, leads, staff } from '@/data'
export async function updateVehicle(id: string, patch: Partial<(typeof vehicles)[number]>) {
  const vehicle = vehicles.find((v) => v.id === id)
  if (vehicle) Object.assign(vehicle, patch)
  return vehicle
}
export async function duplicateVehicle(id: string) {
  const vehicle = vehicles.find((v) => v.id === id)
  if (!vehicle) return
  const copy = {
    ...vehicle,
    id: `${vehicle.id}-copy`,
    slug: `${vehicle.slug}-copy`,
    publication: 'draft' as const,
    createdAt: new Date().toISOString().slice(0, 10),
  }
  vehicles.unshift(copy)
  return copy
}
export async function deleteVehicle(id: string) {
  const i = vehicles.findIndex((v) => v.id === id)
  if (i >= 0) vehicles.splice(i, 1)
  return true
}
export async function updateLead(id: string, status: (typeof leads)[number]['status']) {
  const lead = leads.find((l) => l.id === id)
  if (lead) lead.status = status
  return lead
}
export async function inviteStaff(email: string, role: (typeof staff)[number]['role']) {
  const member = { id: `staff-${Date.now()}`, name: email.split('@')[0], email, role, active: true }
  staff.push(member)
  return member
}
