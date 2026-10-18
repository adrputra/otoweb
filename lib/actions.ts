'use server'
import { leads, staff } from '@/data'

export async function updateLead(id: string, status: (typeof leads)[number]['status']) {
  const lead = leads.find((item) => item.id === id)
  if (lead) lead.status = status
  return lead
}

export async function inviteStaff(email: string, role: (typeof staff)[number]['role']) {
  const member = {
    id: `staff-${Date.now()}`,
    name: email.split('@')[0],
    email,
    role,
    active: true,
  }
  staff.push(member)
  return member
}
