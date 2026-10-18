import { NextResponse } from 'next/server'

import { requireAdminApiContext } from '@/lib/admin/context'
import { deleteVehicleImage } from '@/lib/admin/vehicle-image-service'
import type { TenantActor } from '@/lib/admin/vehicle-service'
import { resolveMediaProviderOrNull } from '@/lib/media/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string; imageId: string }> }

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

export async function DELETE(_request: Request, { params }: Params) {
  const auth = await requireAdminApiContext('manage_vehicles')
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.status === 401 ? 'unauthorized' : 'forbidden', message: auth.message },
      { status: auth.status },
    )
  }

  const { id, imageId } = await params

  let provider = null
  try {
    provider = resolveMediaProviderOrNull()
  } catch {
    provider = null
  }

  const result = await deleteVehicleImage(
    auth.db,
    actorFromContext(auth.context, auth.user.id),
    id,
    imageId,
    provider,
  )

  if (!result.ok) {
    const status =
      result.error === 'invalid'
        ? 400
        : result.error === 'not_found'
          ? 404
          : result.error === 'conflict'
            ? 409
            : 502
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        message: result.message,
        fieldErrors: result.fieldErrors,
      },
      { status },
    )
  }

  return NextResponse.json({ ok: true, data: result.data })
}
