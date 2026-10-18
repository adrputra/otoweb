import { NextResponse } from 'next/server'

import { requireAdminApiContext } from '@/lib/admin/context'
import { uploadVehicleImage, reorderVehicleImages, setVehicleImageCover } from '@/lib/admin/vehicle-image-service'
import type { TenantActor } from '@/lib/admin/vehicle-service'
import { resolveMediaFolder, resolveMediaProvider } from '@/lib/media/provider'
import { vehicleImageActionSchema } from '@/lib/validation/vehicle-image'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

function actorFromContext(
  context: { tenant: { id: string }; isPlatformAdmin: boolean },
  userId: string,
): TenantActor {
  return {
    tenantId: context.tenant.id,
    userId,
    isPlatformAdmin: context.isPlatformAdmin,
  }
}

function failure(
  error: 'invalid' | 'not_found' | 'conflict' | 'provider',
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  const status = error === 'invalid' ? 400 : error === 'not_found' ? 404 : error === 'conflict' ? 409 : 502
  return NextResponse.json({ ok: false, error, message, fieldErrors }, { status })
}

export async function POST(request: Request, { params }: Params) {
  const auth = await requireAdminApiContext('manage_vehicles')
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.status === 401 ? 'unauthorized' : 'forbidden', message: auth.message },
      { status: auth.status },
    )
  }

  const { id } = await params
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')

  if (!(file instanceof File)) {
    return failure('invalid', 'Pilih berkas foto yang valid.', { file: ['Berkas foto wajib diunggah.'] })
  }

  const altValue = form?.get('alt')
  const alt = typeof altValue === 'string' ? altValue : undefined
  const bytes = new Uint8Array(await file.arrayBuffer())

  let provider
  try {
    provider = resolveMediaProvider()
  } catch (error) {
    return failure(
      'provider',
      error instanceof Error ? error.message : 'Penyimpanan media belum dikonfigurasi.',
    )
  }

  const result = await uploadVehicleImage(
    auth.db,
    actorFromContext(auth.context, auth.user.id),
    id,
    { bytes, filename: file.name, alt },
    provider,
    { folder: resolveMediaFolder() },
  )

  if (!result.ok) return failure(result.error, result.message, result.fieldErrors)

  return NextResponse.json({ ok: true, data: result.data }, { status: 201 })
}

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireAdminApiContext('manage_vehicles')
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.status === 401 ? 'unauthorized' : 'forbidden', message: auth.message },
      { status: auth.status },
    )
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = vehicleImageActionSchema.safeParse(body)

  if (!parsed.success) {
    return failure('invalid', 'Permintaan pengelolaan foto tidak valid.', {
      action: parsed.error.issues.map((issue) => issue.message),
    })
  }

  const actor = actorFromContext(auth.context, auth.user.id)
  const result =
    parsed.data.action === 'reorder'
      ? await reorderVehicleImages(auth.db, actor, id, parsed.data.imageIds)
      : await setVehicleImageCover(auth.db, actor, id, parsed.data.imageId)

  if (!result.ok) return failure(result.error, result.message, result.fieldErrors)

  return NextResponse.json({ ok: true, data: { images: result.data } })
}
