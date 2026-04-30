'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Inquiry = {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  status: string
  admin_notes?: string | null
}

type Review = {
  id: string
  reviewer_name?: string | null
  rating: number
  title?: string | null
  comment: string
  is_approved: boolean
  room?: { name?: string | null } | null
}

type GalleryImage = {
  id: string
  title?: string | null
  description?: string | null
  image_url: string
  category?: string | null
  is_featured?: boolean | null
  display_order?: number | null
}

type GalleryForm = {
  title: string
  description: string
  image_url: string
  category: string
  is_featured: boolean
  display_order: number
}

type WifiSettingsForm = {
  ssid: string
  password: string
  security: 'WPA' | 'WEP' | 'nopass'
  hidden: boolean
}

const EMPTY_GALLERY_FORM: GalleryForm = {
  title: '',
  description: '',
  image_url: '',
  category: 'Nature',
  is_featured: false,
  display_order: 0,
}

const DEFAULT_WIFI_SETTINGS: WifiSettingsForm = {
  ssid: 'Leafwalk Resort',
  password: 'Password-123456',
  security: 'WPA',
  hidden: false,
}

function buildWifiQrPreviewUrl(settings: WifiSettingsForm) {
  const escaped = (value: string) => value.replace(/([\\;,:"])/g, '\\$1')
  const qrText = settings.security === 'nopass'
    ? `WIFI:T:${settings.security};S:${escaped(settings.ssid)};H:${settings.hidden ? 'true' : 'false'};;`
    : `WIFI:T:${settings.security};S:${escaped(settings.ssid)};P:${escaped(settings.password)};H:${settings.hidden ? 'true' : 'false'};;`

  return `https://quickchart.io/qr?size=220&text=${encodeURIComponent(qrText)}`
}

async function readJsonSafely(response: Response) {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 300) }
  }
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read selected image'))
    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] : value)
    }
    reader.readAsDataURL(file)
  })
}

export default function AdminContentPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([])
  const [inquiryDrafts, setInquiryDrafts] = useState<Record<string, { status: string; admin_notes: string }>>({})
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { title: string; comment: string; is_approved: boolean }>>({})
  const [galleryDrafts, setGalleryDrafts] = useState<Record<string, GalleryForm>>({})
  const [galleryForm, setGalleryForm] = useState<GalleryForm>(EMPTY_GALLERY_FORM)
  const [wifiForm, setWifiForm] = useState<WifiSettingsForm>(DEFAULT_WIFI_SETTINGS)
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [wifiMessage, setWifiMessage] = useState('')

  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user || !session.access_token) {
      router.push('/admin/login')
      return
    }

    const verifyRes = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!verifyRes.ok) {
      router.push('/admin/login')
      return
    }

    setToken(session.access_token)
    await loadAll(session.access_token)
    setLoading(false)
  }

  async function adminFetch(path: string, init?: RequestInit) {
    return fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    })
  }

  function seedDrafts(nextInquiries: Inquiry[], nextReviews: Review[], nextGallery: GalleryImage[]) {
    setInquiryDrafts(
      Object.fromEntries(
        nextInquiries.map((item) => [item.id, { status: item.status, admin_notes: item.admin_notes || '' }])
      )
    )
    setReviewDrafts(
      Object.fromEntries(
        nextReviews.map((item) => [item.id, { title: item.title || '', comment: item.comment, is_approved: item.is_approved }])
      )
    )
    setGalleryDrafts(
      Object.fromEntries(
        nextGallery.map((item) => [item.id, {
          title: item.title || '',
          description: item.description || '',
          image_url: item.image_url,
          category: item.category || 'Nature',
          is_featured: Boolean(item.is_featured),
          display_order: Number(item.display_order || 0),
        }])
      )
    )
  }

  async function loadAll(authToken: string = token) {
    const headers = { Authorization: `Bearer ${authToken}` }
    const [iqRes, rvRes, giRes, wifiRes] = await Promise.all([
      fetch('/api/admin/data?type=inquiries', { headers }),
      fetch('/api/admin/data?type=reviews', { headers }),
      fetch('/api/admin/data?type=gallery-images', { headers }),
      fetch('/api/admin/data?type=wifi-settings', { headers }),
    ])

    const [iqData, rvData, giData, wifiData] = await Promise.all([
      readJsonSafely(iqRes),
      readJsonSafely(rvRes),
      readJsonSafely(giRes),
      readJsonSafely(wifiRes),
    ])
    const nextInquiries = iqData.data || []
    const nextReviews = rvData.data || []
    const nextGallery = giData.data || []
    const nextWifi = wifiData?.data || DEFAULT_WIFI_SETTINGS
    setInquiries(nextInquiries)
    setReviews(nextReviews)
    setGalleryImages(nextGallery)
    setWifiForm({
      ssid: nextWifi.ssid || DEFAULT_WIFI_SETTINGS.ssid,
      password: nextWifi.password || DEFAULT_WIFI_SETTINGS.password,
      security: nextWifi.security || DEFAULT_WIFI_SETTINGS.security,
      hidden: Boolean(nextWifi.hidden),
    })
    seedDrafts(nextInquiries, nextReviews, nextGallery)
  }

  async function saveWifiSettings() {
    setSaving(true)
    setWifiMessage('')

    try {
      const response = await adminFetch('/api/admin/data?type=wifi-settings', {
        method: 'PATCH',
        body: JSON.stringify(wifiForm),
      })
      const data = await readJsonSafely(response)
      if (!response.ok) {
        throw new Error(data?.error || 'Could not save Wi-Fi settings')
      }
      setWifiMessage('Wi-Fi settings saved. New check-in mails will use the updated QR automatically.')
    } catch (error: any) {
      setWifiMessage(error?.message || 'Could not save Wi-Fi settings')
    } finally {
      setSaving(false)
    }
  }

  async function saveInquiry(id: string) {
    const draft = inquiryDrafts[id]
    if (!draft) return
    setSaving(true)
    await adminFetch(`/api/admin/data?type=inquiry&id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(draft),
    })
    await loadAll()
    setSaving(false)
  }

  async function saveReview(id: string) {
    const draft = reviewDrafts[id]
    if (!draft) return
    setSaving(true)
    await adminFetch(`/api/admin/data?type=review&id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(draft),
    })
    await loadAll()
    setSaving(false)
  }

  async function createGalleryImage() {
    if (!galleryForm.image_url.trim()) return
    setSaving(true)
    await adminFetch('/api/admin/data?type=gallery-image', {
      method: 'POST',
      body: JSON.stringify(galleryForm),
    })
    setGalleryForm(EMPTY_GALLERY_FORM)
    await loadAll()
    setSaving(false)
  }

  async function uploadGalleryImage(file: File | null, target: 'new' | string) {
    if (!file) return
    setUploadingTarget(target)
    setUploadError('')

    try {
      const contentBase64 = await readFileAsBase64(file)

      const response = await fetch('/api/admin/content-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: file.name,
          type: file.type,
          contentBase64,
        }),
      })
      const data = await readJsonSafely(response)
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Could not upload image')
      }

      if (target === 'new') {
        setGalleryForm((state) => ({ ...state, image_url: data.url }))
      } else {
        setGalleryDrafts((state) => ({
          ...state,
          [target]: {
            ...(state[target] || EMPTY_GALLERY_FORM),
            image_url: data.url,
          },
        }))
      }
    } catch (error: any) {
      setUploadError(error?.message || 'Could not upload image')
    } finally {
      setUploadingTarget(null)
    }
  }

  async function saveGalleryImage(id: string) {
    const draft = galleryDrafts[id]
    if (!draft) return
    setSaving(true)
    await adminFetch(`/api/admin/data?type=gallery-image&id=${id}`, {
      method: 'PATCH',
      body: JSON.stringify(draft),
    })
    await loadAll()
    setSaving(false)
  }

  async function deleteGalleryImage(id: string) {
    setSaving(true)
    await adminFetch(`/api/admin/data?type=gallery-image&id=${id}`, {
      method: 'DELETE',
    })
    await loadAll()
    setSaving(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b] text-white">Loading content tools...</div>
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white px-6 py-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-2">Admin</p>
            <h1 className="font-playfair text-4xl text-white">Content Desk</h1>
          </div>
          <button onClick={() => router.push('/admin/dashboard')} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm">
            Back to Dashboard
          </button>
        </div>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Guest Wi-Fi</h2>
          <p className="text-sm text-white/60 mb-5">
            Check-in related mails will use these live Wi-Fi details. Password change karte hi next mail me naya QR automatically chala jayega.
          </p>
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="grid md:grid-cols-2 gap-3">
              <input
                value={wifiForm.ssid}
                onChange={(e) => setWifiForm((state) => ({ ...state, ssid: e.target.value }))}
                placeholder="Wi-Fi name (SSID)"
                className="bg-[#111] border border-white/10 rounded-lg px-3 py-2"
              />
              <input
                value={wifiForm.password}
                onChange={(e) => setWifiForm((state) => ({ ...state, password: e.target.value }))}
                placeholder="Wi-Fi password"
                className="bg-[#111] border border-white/10 rounded-lg px-3 py-2"
              />
              <select
                value={wifiForm.security}
                onChange={(e) => setWifiForm((state) => ({ ...state, security: e.target.value as WifiSettingsForm['security'] }))}
                className="bg-[#111] border border-white/10 rounded-lg px-3 py-2"
              >
                <option value="WPA">WPA / WPA2</option>
                <option value="WEP">WEP</option>
                <option value="nopass">Open Network</option>
              </select>
              <label className="flex items-center gap-2 text-sm text-white/70 rounded-lg border border-white/10 bg-[#111] px-3 py-2">
                <input
                  type="checkbox"
                  checked={wifiForm.hidden}
                  onChange={(e) => setWifiForm((state) => ({ ...state, hidden: e.target.checked }))}
                />
                Hidden network
              </label>
              <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                <button onClick={saveWifiSettings} disabled={saving} className="px-4 py-2 rounded-lg bg-[#c9a14a] text-black font-semibold">
                  Save Wi-Fi Settings
                </button>
                {wifiMessage ? <p className="text-sm text-white/65">{wifiMessage}</p> : null}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm font-semibold text-white">QR Preview</p>
              <p className="text-xs text-white/45 mt-1">Guest check-in mails me isi live setup ka QR jayega.</p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white p-4">
                <img src={buildWifiQrPreviewUrl(wifiForm)} alt="Wi-Fi QR preview" className="mx-auto h-52 w-52 object-contain" />
              </div>
              <div className="mt-4 space-y-1 text-sm text-white/70">
                <p><span className="text-white/45">SSID:</span> {wifiForm.ssid || '-'}</p>
                <p><span className="text-white/45">Password:</span> {wifiForm.password || '-'}</p>
                <p><span className="text-white/45">Security:</span> {wifiForm.security}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Enquiries</h2>
          <div className="space-y-4">
            {inquiries.map((inquiry) => {
              const draft = inquiryDrafts[inquiry.id]
              return (
                <div key={inquiry.id} className="border border-white/10 rounded-xl p-4 bg-black/20">
                  <div className="flex justify-between gap-4 flex-wrap mb-3">
                    <div>
                      <p className="font-semibold">{inquiry.name}</p>
                      <p className="text-white/50 text-sm">{inquiry.email} | {inquiry.phone}</p>
                    </div>
                    <select
                      value={draft?.status || inquiry.status}
                      onChange={(e) => setInquiryDrafts((state) => ({ ...state, [inquiry.id]: { ...(state[inquiry.id] || { admin_notes: inquiry.admin_notes || '' }), status: e.target.value } }))}
                      className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm"
                      disabled={saving}
                    >
                      <option value="new">new</option>
                      <option value="in_progress">in_progress</option>
                      <option value="resolved">resolved</option>
                    </select>
                  </div>
                  <p className="text-[#c9a14a] text-sm mb-1">{inquiry.subject}</p>
                  <p className="text-white/70 text-sm whitespace-pre-wrap mb-3">{inquiry.message}</p>
                  <textarea
                    value={draft?.admin_notes || ''}
                    onChange={(e) => setInquiryDrafts((state) => ({ ...state, [inquiry.id]: { ...(state[inquiry.id] || { status: inquiry.status }), admin_notes: e.target.value } }))}
                    placeholder="Admin notes"
                    className="w-full min-h-[90px] bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => saveInquiry(inquiry.id)} disabled={saving} className="px-4 py-2 rounded-lg bg-[#c9a14a] text-black font-semibold text-sm">
                      Save Enquiry
                    </button>
                  </div>
                </div>
              )
            })}
            {!inquiries.length && <p className="text-white/40 text-sm">No enquiries yet.</p>}
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Reviews</h2>
          <div className="space-y-4">
            {reviews.map((review) => {
              const draft = reviewDrafts[review.id]
              return (
                <div key={review.id} className="border border-white/10 rounded-xl p-4 bg-black/20">
                  <div className="flex justify-between gap-4 flex-wrap mb-3">
                    <div>
                      <p className="font-semibold">{review.reviewer_name || 'Guest'} | {review.rating}/5</p>
                      <p className="text-white/50 text-sm">{review.room?.name || 'Room review'}</p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input
                        type="checkbox"
                        checked={draft?.is_approved ?? review.is_approved}
                        onChange={(e) => setReviewDrafts((state) => ({ ...state, [review.id]: { ...(state[review.id] || { title: review.title || '', comment: review.comment }), is_approved: e.target.checked } }))}
                      />
                      Approved
                    </label>
                  </div>
                  <input
                    value={draft?.title || ''}
                    onChange={(e) => setReviewDrafts((state) => ({ ...state, [review.id]: { ...(state[review.id] || { comment: review.comment, is_approved: review.is_approved }), title: e.target.value } }))}
                    placeholder="Review title"
                    className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm mb-3"
                  />
                  <textarea
                    value={draft?.comment || ''}
                    onChange={(e) => setReviewDrafts((state) => ({ ...state, [review.id]: { ...(state[review.id] || { title: review.title || '', is_approved: review.is_approved }), comment: e.target.value } }))}
                    className="w-full min-h-[100px] bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="mt-3 flex justify-end">
                    <button onClick={() => saveReview(review.id)} disabled={saving} className="px-4 py-2 rounded-lg bg-[#c9a14a] text-black font-semibold text-sm">
                      Save Review
                    </button>
                  </div>
                </div>
              )
            })}
            {!reviews.length && <p className="text-white/40 text-sm">No reviews yet.</p>}
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xl font-semibold mb-4">Gallery</h2>
          <div className="grid md:grid-cols-2 gap-3 mb-6">
            <input value={galleryForm.title} onChange={(e) => setGalleryForm((state) => ({ ...state, title: e.target.value }))} placeholder="Title" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2" />
            <input value={galleryForm.category} onChange={(e) => setGalleryForm((state) => ({ ...state, category: e.target.value }))} placeholder="Category" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2" />
            <input value={galleryForm.image_url} onChange={(e) => setGalleryForm((state) => ({ ...state, image_url: e.target.value }))} placeholder="Image URL" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 md:col-span-2" />
            <div className="md:col-span-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Attach image from system</p>
                  <p className="text-xs text-white/45">JPG, PNG, WEBP, GIF up to 8 MB. Uploaded URL will fill automatically.</p>
                </div>
                <label className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">
                  {uploadingTarget === 'new' ? 'Uploading...' : 'Choose Image'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={saving || uploadingTarget === 'new'}
                    onChange={(e) => uploadGalleryImage(e.target.files?.[0] || null, 'new')}
                  />
                </label>
              </div>
              {galleryForm.image_url ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-white/10">
                  <img src={galleryForm.image_url} alt="Gallery preview" className="h-40 w-full object-cover" />
                </div>
              ) : null}
            </div>
            {uploadError && <p className="md:col-span-2 text-sm text-red-300">{uploadError}</p>}
            <textarea value={galleryForm.description} onChange={(e) => setGalleryForm((state) => ({ ...state, description: e.target.value }))} placeholder="Description" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 md:col-span-2 min-h-[100px]" />
            <input type="number" value={galleryForm.display_order} onChange={(e) => setGalleryForm((state) => ({ ...state, display_order: Number(e.target.value || 0) }))} placeholder="Display order" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2" />
            <label className="flex items-center gap-2 text-sm text-white/70">
              <input type="checkbox" checked={galleryForm.is_featured} onChange={(e) => setGalleryForm((state) => ({ ...state, is_featured: e.target.checked }))} />
              Featured image
            </label>
          </div>
          <button onClick={createGalleryImage} disabled={saving} className="px-4 py-2 rounded-lg bg-[#c9a14a] text-black font-semibold mb-6">
            Add Gallery Image
          </button>

          <div className="space-y-4">
            {galleryImages.map((image) => {
              const draft = galleryDrafts[image.id]
              return (
                <div key={image.id} className="border border-white/10 rounded-xl p-4 bg-black/20">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input value={draft?.title || ''} onChange={(e) => setGalleryDrafts((state) => ({ ...state, [image.id]: { ...(state[image.id] || EMPTY_GALLERY_FORM), title: e.target.value } }))} placeholder="Title" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2" />
                    <input value={draft?.category || ''} onChange={(e) => setGalleryDrafts((state) => ({ ...state, [image.id]: { ...(state[image.id] || EMPTY_GALLERY_FORM), category: e.target.value } }))} placeholder="Category" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2" />
                    <input value={draft?.image_url || ''} onChange={(e) => setGalleryDrafts((state) => ({ ...state, [image.id]: { ...(state[image.id] || EMPTY_GALLERY_FORM), image_url: e.target.value } }))} placeholder="Image URL" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 md:col-span-2" />
                    <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Replace from system</p>
                        <p className="text-xs text-white/45">Upload image and update URL automatically.</p>
                      </div>
                      <label className="cursor-pointer rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">
                        {uploadingTarget === image.id ? 'Uploading...' : 'Choose Image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={saving || uploadingTarget === image.id}
                          onChange={(e) => uploadGalleryImage(e.target.files?.[0] || null, image.id)}
                        />
                      </label>
                    </div>
                    {(draft?.image_url || image.image_url) ? (
                      <div className="md:col-span-2 overflow-hidden rounded-lg border border-white/10">
                        <img src={draft?.image_url || image.image_url} alt={draft?.title || image.title || 'Gallery preview'} className="h-40 w-full object-cover" />
                      </div>
                    ) : null}
                    <textarea value={draft?.description || ''} onChange={(e) => setGalleryDrafts((state) => ({ ...state, [image.id]: { ...(state[image.id] || EMPTY_GALLERY_FORM), description: e.target.value } }))} placeholder="Description" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2 md:col-span-2 min-h-[90px]" />
                    <input type="number" value={draft?.display_order || 0} onChange={(e) => setGalleryDrafts((state) => ({ ...state, [image.id]: { ...(state[image.id] || EMPTY_GALLERY_FORM), display_order: Number(e.target.value || 0) } }))} placeholder="Display order" className="bg-[#111] border border-white/10 rounded-lg px-3 py-2" />
                    <label className="flex items-center gap-2 text-sm text-white/70">
                      <input type="checkbox" checked={draft?.is_featured || false} onChange={(e) => setGalleryDrafts((state) => ({ ...state, [image.id]: { ...(state[image.id] || EMPTY_GALLERY_FORM), is_featured: e.target.checked } }))} />
                      Featured image
                    </label>
                  </div>
                  <div className="mt-3 flex gap-3 justify-end">
                    <button onClick={() => saveGalleryImage(image.id)} disabled={saving} className="px-4 py-2 rounded-lg bg-[#c9a14a] text-black font-semibold text-sm">
                      Save Image
                    </button>
                    <button onClick={() => deleteGalleryImage(image.id)} disabled={saving} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 font-semibold text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
            {!galleryImages.length && <p className="text-white/40 text-sm">No gallery images yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
