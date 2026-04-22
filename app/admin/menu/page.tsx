'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import AdminNavbar from '@/components/AdminNavbar'
import { supabase } from '@/lib/supabaseClient'

type MenuSettings = {
  show_prices_on_website: boolean
  show_non_veg: boolean
  menu_note: string
}

type MenuCategory = {
  id: string
  name: string
  slug: string
  description: string
  websiteHeading: string
  sortOrder: number
  isActive: boolean
  itemCount?: number
  items?: MenuItem[]
}

type MenuItem = {
  id: string
  name: string
  categoryId: string
  unit: string
  price: number
  discountPrice: number | null
  isActive: boolean
  showOnWebsite: boolean
  description: string
  itemCode: string
  sortOrder: number
}

const UNIT_OPTIONS = ['Bowl', 'Plate', 'Portion', 'Piece', 'Cup', 'Glass', 'Bottle']

const EMPTY_ITEM: Omit<MenuItem, 'id'> = {
  name: '',
  categoryId: '',
  unit: 'Plate',
  price: 0,
  discountPrice: null,
  isActive: true,
  showOnWebsite: true,
  description: '',
  itemCode: '',
  sortOrder: 0,
}

export default function AdminMenuPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<MenuSettings>({ show_prices_on_website: false, show_non_veg: false, menu_note: '' })
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [categoryItems, setCategoryItems] = useState<MenuItem[]>([])
  const [itemForm, setItemForm] = useState<Omit<MenuItem, 'id'>>(EMPTY_ITEM)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategorySlug, setNewCategorySlug] = useState('')
  const [newItemMode, setNewItemMode] = useState(false)
  const [menuUrl, setMenuUrl] = useState('')

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMenuUrl(`${window.location.origin}/menu`)
    }
  }, [])

  useEffect(() => {
    if (!selectedCategoryId || !token) return
    loadCategory(selectedCategoryId)
  }, [selectedCategoryId, token])

  useEffect(() => {
    if (newItemMode) {
      setItemForm({
        ...EMPTY_ITEM,
        categoryId: selectedCategoryId,
      })
      setSelectedItemId('')
      return
    }

    const selectedItem = categoryItems.find((item) => item.id === selectedItemId)
    if (!selectedItem) {
      setItemForm({
        ...EMPTY_ITEM,
        categoryId: selectedCategoryId,
      })
      return
    }

    setItemForm({
      name: selectedItem.name,
      categoryId: selectedItem.categoryId,
      unit: selectedItem.unit || 'Plate',
      price: selectedItem.price,
      discountPrice: selectedItem.discountPrice,
      isActive: selectedItem.isActive,
      showOnWebsite: selectedItem.showOnWebsite,
      description: selectedItem.description || '',
      itemCode: selectedItem.itemCode || '',
      sortOrder: selectedItem.sortOrder || 0,
    })
  }, [selectedItemId, categoryItems, selectedCategoryId, newItemMode])

  async function init() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      router.push('/admin/login')
      return
    }

    const verify = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!verify.ok) {
      router.push('/admin/login')
      return
    }

    setToken(session.access_token)
    await loadCategories(session.access_token)
    setLoading(false)
  }

  async function adminFetch(url: string, init?: RequestInit) {
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    })
  }

  async function loadCategories(authToken = token) {
    const res = await fetch('/api/admin/menu', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to load menu categories')
      return
    }

    setSettings({
      show_prices_on_website: Boolean(json.settings?.show_prices_on_website),
      show_non_veg: Boolean(json.settings?.show_non_veg),
      menu_note: json.settings?.menu_note || '',
    })
    setCategories(json.categories || [])
    const firstCategory = json.categories?.[0]?.id || ''
    setSelectedCategoryId((current) => current || firstCategory)
  }

  async function loadCategory(categoryId: string) {
    setSwitching(true)
    setSelectedItemId('')
    setItemSearch('')
    setNewItemMode(false)
    try {
      const res = await adminFetch(`/api/admin/menu?categoryId=${categoryId}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.error || 'Failed to load category items')
        return
      }
      const category = json.category as MenuCategory
      setCategoryItems(category.items || [])
    } finally {
      setSwitching(false)
    }
  }

  const filteredItems = useMemo(() => {
    const query = itemSearch.trim().toLowerCase()
    if (!query) return categoryItems
    return categoryItems.filter((item) => item.name.toLowerCase().includes(query))
  }, [categoryItems, itemSearch])

  async function saveSettings() {
    setSaving(true)
    const res = await adminFetch('/api/admin/menu', {
      method: 'POST',
      body: JSON.stringify({ entity: 'settings', ...settings }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to save settings')
      return
    }
    toast.success(json.message || 'Menu settings updated')
  }

  async function createCategory() {
    if (!newCategoryName.trim()) {
      toast.error('Category name is required')
      return
    }
    setSaving(true)
    const res = await adminFetch('/api/admin/menu', {
      method: 'POST',
      body: JSON.stringify({
        entity: 'category',
        name: newCategoryName.trim(),
        slug: newCategorySlug.trim() || newCategoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to create category')
      return
    }
    toast.success('Category created')
    setNewCategoryName('')
    setNewCategorySlug('')
    await loadCategories()
    if (json.category?.id) setSelectedCategoryId(json.category.id)
  }

  async function renameSelectedCategory(name: string) {
    const category = categories.find((entry) => entry.id === selectedCategoryId)
    if (!category) return
    setSaving(true)
    const res = await adminFetch('/api/admin/menu', {
      method: 'PATCH',
      body: JSON.stringify({
        entity: 'category',
        id: category.id,
        name,
        slug: category.slug,
        description: category.description,
        website_heading: category.websiteHeading,
        sort_order: category.sortOrder,
        is_active: category.isActive,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to rename category')
      return
    }
    toast.success('Category updated')
    loadCategories()
  }

  async function deleteSelectedCategory() {
    const category = categories.find((entry) => entry.id === selectedCategoryId)
    if (!category) return
    if (!confirm(`Delete category "${category.name}"? This works only if no items exist inside it.`)) return
    setSaving(true)
    const res = await adminFetch(`/api/admin/menu?entity=category&id=${category.id}`, { method: 'DELETE' })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to delete category')
      return
    }
    toast.success('Category deleted')
    setSelectedCategoryId('')
    setSelectedItemId('')
    setCategoryItems([])
    await loadCategories()
  }

  async function saveItem() {
    if (!selectedCategoryId && !newItemMode) {
      toast.error('Please select a category')
      return
    }
    if (!itemForm.name.trim()) {
      toast.error('Item name is required')
      return
    }
    if (itemForm.price === null || itemForm.price === undefined || Number.isNaN(Number(itemForm.price))) {
      toast.error('Price must be a valid number')
      return
    }

    setSaving(true)
    const payload = {
      entity: 'item',
      categoryId: selectedCategoryId,
      name: itemForm.name.trim(),
      unit: itemForm.unit,
      price: Number(itemForm.price),
      discountPrice: itemForm.discountPrice === null || itemForm.discountPrice === undefined || itemForm.discountPrice === ('' as any)
        ? null
        : Number(itemForm.discountPrice),
      isActive: itemForm.isActive,
      showOnWebsite: itemForm.showOnWebsite,
      description: itemForm.description,
      itemCode: itemForm.itemCode,
      sortOrder: Number(itemForm.sortOrder || 0),
    }

    const res = await adminFetch('/api/admin/menu', {
      method: newItemMode ? 'POST' : 'PATCH',
      body: JSON.stringify(newItemMode ? payload : { ...payload, id: selectedItemId }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to save item')
      return
    }
    toast.success(json.message || 'Item saved')
    await loadCategory(selectedCategoryId)
    if (json.item?.id) {
      setSelectedItemId(json.item.id)
      setNewItemMode(false)
    }
  }

  async function deleteSelectedItem() {
    if (!selectedItemId) return
    if (!confirm('Delete this menu item? This cannot be undone.')) return
    setSaving(true)
    const res = await adminFetch(`/api/admin/menu?entity=item&id=${selectedItemId}`, { method: 'DELETE' })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to delete item')
      return
    }
    toast.success('Item deleted')
    setSelectedItemId('')
    await loadCategory(selectedCategoryId)
  }

  const selectedCategory = categories.find((entry) => entry.id === selectedCategoryId) || null
  const showEditor = newItemMode || Boolean(selectedItemId)

  if (loading) {
    return <div className="min-h-screen bg-[#0b0b0b] text-white flex items-center justify-center">Loading menu manager...</div>
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <Toaster position="top-center" />
      <AdminNavbar />
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <div>
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-2">Restaurant</p>
          <h1 className="font-playfair text-4xl text-white">Menu Manager</h1>
          <p className="mt-2 text-sm text-white/45">Category-first menu editor with lazy loading, website visibility control, and future-ready restaurant catalog structure.</p>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Website Visibility</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white">Show prices on website</p>
                <p className="text-xs text-white/45">When enabled, active items marked for website display will show their price publicly.</p>
              </div>
              <input type="checkbox" checked={settings.show_prices_on_website} onChange={(e) => setSettings((prev) => ({ ...prev, show_prices_on_website: e.target.checked }))} />
            </label>
            <label className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white">Show non-veg items</p>
                <p className="text-xs text-white/45">Keep disabled for current pure veg website display.</p>
              </div>
              <input type="checkbox" checked={settings.show_non_veg} onChange={(e) => setSettings((prev) => ({ ...prev, show_non_veg: e.target.checked }))} />
            </label>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">Menu Note</label>
              <textarea value={settings.menu_note} onChange={(e) => setSettings((prev) => ({ ...prev, menu_note: e.target.value }))} className="mt-2 min-h-[100px] w-full rounded-xl border border-white/10 bg-[#111] px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <button onClick={saveSettings} disabled={saving} className="mt-4 rounded-xl bg-[#c9a14a] px-5 py-3 text-sm font-semibold text-black disabled:opacity-60">
            Save Menu Settings
          </button>
          {menuUrl && (
            <div className="mt-6 grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="rounded-2xl border border-white/10 bg-white p-4 text-center">
                <img
                  src={`https://quickchart.io/qr?text=${encodeURIComponent(menuUrl)}&size=180`}
                  alt="Menu QR Code"
                  className="mx-auto h-[180px] w-[180px]"
                />
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-black/65">Customer QR</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Public Menu Link</p>
                <a href={menuUrl} target="_blank" className="mt-2 block break-all text-sm text-[#c9a14a] underline">
                  {menuUrl}
                </a>
                <p className="mt-3 text-xs text-white/45">Print this QR near tables or reception so customers can open the public menu directly on mobile.</p>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Category Management</h2>
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Create category name" className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
                <input value={newCategorySlug} onChange={(e) => setNewCategorySlug(e.target.value)} placeholder="Optional slug" className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
              </div>
              <button onClick={createCategory} disabled={saving} className="w-full rounded-xl bg-[#c9a14a] px-4 py-3 text-sm font-semibold text-black disabled:opacity-60">
                Create Category
              </button>

              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Select Category</label>
                <select
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm text-white"
                >
                  <option value="">Select Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name} ({category.itemCount || 0})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCategory && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
                  <input
                    value={selectedCategory.name}
                    onChange={(e) => setCategories((prev) => prev.map((entry) => entry.id === selectedCategory.id ? { ...entry, name: e.target.value } : entry))}
                    className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm"
                  />
                  <button
                    onClick={() => renameSelectedCategory(selectedCategory.name)}
                    disabled={saving || !selectedCategory.name.trim()}
                    className="w-full rounded-xl border border-[#c9a14a]/30 bg-[#c9a14a]/10 px-4 py-3 text-sm font-semibold text-[#e8c979] disabled:opacity-60"
                  >
                    Rename Category
                  </button>
                  <button
                    onClick={deleteSelectedCategory}
                    disabled={saving}
                    className="w-full rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 disabled:opacity-60"
                  >
                    Delete Category
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Item Editor</h2>
                <p className="mt-1 text-sm text-white/45">Choose a category, then select one item to edit. Only one form stays open at a time.</p>
              </div>
              {selectedCategoryId && (
                <button
                  onClick={() => {
                    setNewItemMode(true)
                    setSelectedItemId('')
                  }}
                  className="rounded-xl bg-[#c9a14a] px-4 py-3 text-sm font-semibold text-black"
                >
                  Add New Item
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Select Item</label>
                <select
                  value={selectedItemId}
                  onChange={(e) => {
                    setNewItemMode(false)
                    setSelectedItemId(e.target.value)
                  }}
                  disabled={!selectedCategoryId || switching}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm text-white disabled:opacity-50"
                >
                  <option value="">{switching ? 'Loading items...' : 'Select Item'}</option>
                  {filteredItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Search Item</label>
                <input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search inside selected category"
                  disabled={!selectedCategoryId || switching}
                  className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm text-white placeholder:text-white/25 disabled:opacity-50"
                />
              </div>
            </div>

            {switching && (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/55">
                Loading category items...
              </div>
            )}

            {!switching && !showEditor && (
              <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-black/20 p-8 text-center text-sm text-white/45">
                Please select an item to edit
              </div>
            )}

            {!switching && showEditor && (
              <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Item Name</label>
                    <input value={itemForm.name} onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Unit</label>
                    <select value={itemForm.unit} onChange={(e) => setItemForm((prev) => ({ ...prev, unit: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm text-white">
                      {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Price</label>
                    <input type="number" value={itemForm.price} onChange={(e) => setItemForm((prev) => ({ ...prev, price: Number(e.target.value || 0) }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Discount Price</label>
                    <input type="number" value={itemForm.discountPrice ?? ''} onChange={(e) => setItemForm((prev) => ({ ...prev, discountPrice: e.target.value === '' ? null : Number(e.target.value) }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm">
                    <input type="checkbox" checked={itemForm.isActive} onChange={(e) => setItemForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                    Active
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-sm">
                    <input type="checkbox" checked={itemForm.showOnWebsite} onChange={(e) => setItemForm((prev) => ({ ...prev, showOnWebsite: e.target.checked }))} />
                    Show on Website
                  </label>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Item Code</label>
                    <input value={itemForm.itemCode} onChange={(e) => setItemForm((prev) => ({ ...prev, itemCode: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Sort Order</label>
                    <input type="number" value={itemForm.sortOrder} onChange={(e) => setItemForm((prev) => ({ ...prev, sortOrder: Number(e.target.value || 0) }))} className="w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-white/40">Description</label>
                  <textarea value={itemForm.description} onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))} className="min-h-[120px] w-full rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={saveItem} disabled={saving} className="rounded-xl bg-[#c9a14a] px-5 py-3 text-sm font-semibold text-black disabled:opacity-60">
                    Save
                  </button>
                  {!newItemMode && (
                    <button onClick={deleteSelectedItem} disabled={saving || !selectedItemId} className="rounded-xl border border-red-500/25 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-300 disabled:opacity-60">
                      Delete Item
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
