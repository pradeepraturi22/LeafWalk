import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabaseServer'
import { isLocalTestMode } from '@/lib/runtime-mode'
import { logError } from '@/lib/logger'

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const BUCKET_NAME = process.env.CONTENT_UPLOAD_BUCKET || 'gallery-images'

type UploadInput = {
  name: string
  type: string
  size: number
  bytes: Buffer
}

function getJwtSubjectForLocalFallback(token: string) {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const decoded = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    const parsed = JSON.parse(decoded)
    return typeof parsed.sub === 'string' ? parsed.sub : null
  } catch {
    return null
  }
}

async function requireAdmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!token) return false

  let userId: string | null = null
  try {
    const { data: { user }, error } = await getSupabaseAdmin().auth.getUser(token)
    if (error || !user) return false
    userId = user.id
  } catch (error) {
    if (!isLocalTestMode()) return false
    userId = getJwtSubjectForLocalFallback(token)
    logError('LOCAL TEST MODE content upload auth.getUser failed; using local JWT subject fallback', error)
  }

  if (!userId) return false
  const { data } = await getSupabaseAdmin().from('users').select('role').eq('id', userId).single() as any
  return Boolean(data && ['admin', 'manager'].includes(data.role))
}

function safeFileName(name: string) {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

  return normalized || 'gallery-image'
}

function isMissingBucketError(error: any) {
  const message = String(error?.message || error?.error || '').toLowerCase()
  return message.includes('bucket') && (message.includes('not found') || message.includes('does not exist'))
}

function hasValidImageSignature(input: UploadInput) {
  const bytes = input.bytes
  if (input.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (input.type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (input.type === 'image/gif') return bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a'
  if (input.type === 'image/webp') return bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  return false
}

async function ensureUploadBucket() {
  const storage = getSupabaseAdmin().storage as any
  const { error: getError } = await storage.getBucket(BUCKET_NAME)
  if (!getError) return
  if (!isMissingBucketError(getError)) throw getError

  const { error: createError } = await storage.createBucket(BUCKET_NAME, {
    public: true,
    fileSizeLimit: MAX_UPLOAD_BYTES,
    allowedMimeTypes: Array.from(ALLOWED_IMAGE_TYPES),
  })
  if (createError && !String(createError.message || '').toLowerCase().includes('already exists')) {
    throw createError
  }
}

async function readUploadInput(request: NextRequest): Promise<UploadInput | null> {
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof (file as any).arrayBuffer !== 'function' || typeof (file as any).type !== 'string') {
      return null
    }

    const uploadFile = file as File
    return {
      name: uploadFile.name,
      type: uploadFile.type,
      size: uploadFile.size,
      bytes: Buffer.from(await uploadFile.arrayBuffer()),
    }
  }

  if (contentType.includes('application/json')) {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name : ''
    const type = typeof body?.type === 'string' ? body.type : ''
    const contentBase64 = typeof body?.contentBase64 === 'string' ? body.contentBase64 : ''
    if (!name || !type || !contentBase64) return null

    const bytes = Buffer.from(contentBase64, 'base64')
    return {
      name,
      type,
      size: bytes.length,
      bytes,
    }
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    if (!(await requireAdmin(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const upload = await readUploadInput(request)
    if (!upload) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    if (!ALLOWED_IMAGE_TYPES.has(upload.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WEBP, or GIF images are allowed' }, { status: 400 })
    }

    if (upload.size <= 0 || upload.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image must be smaller than 8 MB' }, { status: 400 })
    }

    if (!hasValidImageSignature(upload)) {
      return NextResponse.json({ error: 'Selected file is not a valid image' }, { status: 400 })
    }

    const extension = safeFileName(upload.name).split('.').pop() || upload.type.split('/')[1] || 'jpg'
    const path = `gallery/${new Date().getFullYear()}/${Date.now()}-${randomUUID()}.${extension}`

    const supabase = getSupabaseAdmin()
    await ensureUploadBucket()

    let { error } = await supabase.storage.from(BUCKET_NAME).upload(path, upload.bytes, {
      contentType: upload.type,
      upsert: false,
    })

    if (isMissingBucketError(error)) {
      await ensureUploadBucket()
      const retry = await supabase.storage.from(BUCKET_NAME).upload(path, upload.bytes, {
        contentType: upload.type,
        upsert: false,
      })
      error = retry.error
    }

    if (error) {
      logError('Admin content storage upload failed', {
        bucket: BUCKET_NAME,
        path,
        message: error.message,
      })
      return NextResponse.json({
        error: error.message || 'Could not upload image',
        bucket: BUCKET_NAME,
      }, { status: 500 })
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)

    return NextResponse.json({
      success: true,
      bucket: BUCKET_NAME,
      path,
      url: data.publicUrl,
    })
  } catch (error: any) {
    logError('Admin content upload failed', error)
    return NextResponse.json({
      error: error?.message || 'Could not upload image',
      bucket: BUCKET_NAME,
    }, { status: 500 })
  }
}
