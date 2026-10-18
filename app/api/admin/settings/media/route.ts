import { NextResponse } from 'next/server'

import { requireAdminApiContext } from '@/lib/admin/context'
import {
  isShowroomMediaKind,
  uploadShowroomMedia,
  type ShowroomMediaError,
} from '@/lib/admin/showroom-media-service'
import { resolveMediaProvider } from '@/lib/media/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function failure(error: ShowroomMediaError, message: string, fieldErrors?: Record<string, string[]>) {
  return NextResponse.json(
    { ok: false, error, message, fieldErrors },
    { status: error === 'invalid' ? 400 : 502 },
  )
}

export async function POST(request: Request) {
  const auth = await requireAdminApiContext('manage_settings')
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: auth.status === 401 ? 'unauthorized' : 'forbidden',
        message: auth.message,
      },
      { status: auth.status },
    )
  }

  const form = await request.formData().catch(() => null)
  if (!form) return failure('invalid', 'Permintaan unggahan tidak valid.')

  const file = form.get('file')
  const kind = form.get('kind')

  if (!isShowroomMediaKind(kind)) {
    return failure('invalid', 'Jenis media tidak valid.', {
      kind: ['Pilih logo atau gambar hero.'],
    })
  }

  if (!(file instanceof File)) {
    return failure('invalid', 'Pilih berkas gambar yang valid.', {
      file: ['Berkas gambar wajib diunggah.'],
    })
  }

  let provider
  try {
    provider = resolveMediaProvider()
  } catch (error) {
    return failure(
      'provider',
      error instanceof Error ? error.message : 'Penyimpanan media belum dikonfigurasi.',
    )
  }

  const result = await uploadShowroomMedia(
    {
      tenantId: auth.context.tenant.id,
      userId: auth.user.id,
      isPlatformAdmin: auth.context.isPlatformAdmin,
    },
    kind,
    {
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
    },
    provider,
  )

  if (!result.ok) return failure(result.error, result.message, result.fieldErrors)

  return NextResponse.json({ ok: true, data: result.data }, { status: 201 })
}
