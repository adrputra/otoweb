'use server'
import { staff } from '@/data'

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
