import { notFound } from 'next/navigation'
import { vehicles } from '@/data'
import { VehicleForm } from '@/components/vehicle-form'
export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const vehicle = vehicles.find(item => item.id === id); if (!vehicle) notFound(); return <VehicleForm vehicle={vehicle} /> }
