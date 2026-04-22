'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast, { Toaster } from 'react-hot-toast'
import AdminNavbar from '@/components/AdminNavbar'
import { supabase } from '@/lib/supabaseClient'
import { formatDateTime } from '@/lib/utils'

type Category = {
  id: string
  name: string
  itemCount?: number
}

type MenuItem = {
  id: string
  name: string
  categoryId: string
  unit: string
  price: number
  isActive: boolean
  showOnWebsite: boolean
}

type BillLine = {
  itemId: string
  name: string
  unit: string
  price: number
  quantity: number
  total: number
}

type CreatedBill = {
  id: string
  customer_name: string
  mobile: string | null
  table_no: string | null
  subtotal: number
  gst: number
  grand_total: number
  created_at: string
  items: BillLine[]
}

export default function AdminBillingPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [items, setItems] = useState<MenuItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [mobile, setMobile] = useState('')
  const [tableNo, setTableNo] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [lines, setLines] = useState<BillLine[]>([])
  const [latestBill, setLatestBill] = useState<CreatedBill | null>(null)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!selectedCategoryId || !token) return
    void loadItems(selectedCategoryId)
  }, [selectedCategoryId, token])

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
    const res = await fetch('/api/admin/menu', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const json = await res.json()
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to load menu categories')
      return
    }
    setCategories(json.categories || [])
    setSelectedCategoryId(json.categories?.[0]?.id || '')
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

  async function loadItems(categoryId: string) {
    setSwitching(true)
    setSelectedItemId('')
    const res = await adminFetch(`/api/admin/menu?categoryId=${categoryId}`)
    const json = await res.json()
    setSwitching(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to load menu items')
      return
    }
    setItems((json.category?.items || []).filter((item: MenuItem) => item.isActive))
  }

  const selectedItem = items.find((item) => item.id === selectedItemId) || null

  function addLine() {
    if (!selectedItem) {
      toast.error('Select an item first')
      return
    }
    if (quantity <= 0) {
      toast.error('Quantity must be at least 1')
      return
    }

    setLines((prev) => {
      const existing = prev.find((line) => line.itemId === selectedItem.id)
      if (existing) {
        return prev.map((line) => line.itemId === selectedItem.id
          ? { ...line, quantity: line.quantity + quantity, total: (line.quantity + quantity) * line.price }
          : line)
      }
      return [...prev, {
        itemId: selectedItem.id,
        name: selectedItem.name,
        unit: selectedItem.unit,
        price: selectedItem.price,
        quantity,
        total: selectedItem.price * quantity,
      }]
    })
    setQuantity(1)
  }

  const subtotal = useMemo(() => lines.reduce((sum, line) => sum + line.total, 0), [lines])
  const gst = useMemo(() => Number(((subtotal * 5) / 100).toFixed(2)), [subtotal])
  const grandTotal = useMemo(() => Number((subtotal + gst).toFixed(2)), [subtotal, gst])

  async function createBill() {
    if (!customerName.trim()) {
      toast.error('Customer name is required')
      return
    }
    if (!lines.length) {
      toast.error('Add at least one item to the bill')
      return
    }

    setSaving(true)
    const res = await adminFetch('/api/admin/billing', {
      method: 'POST',
      body: JSON.stringify({
        customerName: customerName.trim(),
        mobile: mobile.trim(),
        tableNo: tableNo.trim(),
        items: lines,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok || !json.success) {
      toast.error(json.error || 'Failed to create bill')
      return
    }

    toast.success('Bill created successfully')
    setLatestBill(json.bill)
    setCustomerName('')
    setMobile('')
    setTableNo('')
    setLines([])
    setSelectedItemId('')
  }

  function printBill() {
    if (!latestBill) return
    const billHtml = `
      <html>
        <head>
          <title>LeafWalk Restaurant Bill</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
            .right { text-align: right; }
            .total { margin-top: 16px; width: 320px; margin-left: auto; }
            .total div { display:flex; justify-content:space-between; padding: 6px 0; }
            .grand { font-weight: bold; font-size: 18px; }
          </style>
        </head>
        <body>
          <h1>LeafWalk Resort Restaurant</h1>
          <p>Date & Time: ${formatDateTime(latestBill.created_at)}</p>
          <p>Customer: ${latestBill.customer_name}</p>
          <p>Mobile: ${latestBill.mobile || '-'}</p>
          <p>Table No: ${latestBill.table_no || '-'}</p>
          <table>
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
            </thead>
            <tbody>
              ${latestBill.items.map((item) => `<tr><td>${item.name}</td><td>${item.quantity}</td><td class="right">${item.price.toFixed(2)}</td><td class="right">${item.total.toFixed(2)}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="total">
            <div><span>Subtotal</span><span>${latestBill.subtotal.toFixed(2)}</span></div>
            <div><span>GST (5%)</span><span>${latestBill.gst.toFixed(2)}</span></div>
            <div class="grand"><span>Grand Total</span><span>${latestBill.grand_total.toFixed(2)}</span></div>
          </div>
          <script>window.print()</script>
        </body>
      </html>
    `
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.open()
    win.document.write(billHtml)
    win.document.close()
  }

  if (loading) {
    return <div className="min-h-screen bg-[#0b0b0b] text-white flex items-center justify-center">Loading billing...</div>
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white">
      <Toaster position="top-center" />
      <AdminNavbar />
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        <div>
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-2">Restaurant</p>
          <h1 className="font-playfair text-4xl text-white">Billing Console</h1>
          <p className="mt-2 text-sm text-white/45">Create food bills, add guest details, calculate GST automatically, and print a clean restaurant bill.</p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold mb-4">Create New Bill</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer Name" className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile Number" className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
              <input value={tableNo} onChange={(e) => setTableNo(e.target.value)} placeholder="Table No (Optional)" className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm" />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm">
                <option value="">Select Category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)} disabled={!selectedCategoryId || switching} className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm disabled:opacity-50">
                <option value="">{switching ? 'Loading items...' : 'Select Item'}</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value || 1))} className="rounded-xl border border-white/10 bg-[#111] px-3 py-3 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              <button onClick={addLine} className="rounded-xl bg-[#c9a14a] px-4 py-3 text-sm font-semibold text-black">Add Item</button>
            </div>

            {selectedItem && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
                Selected: <span className="font-semibold text-white">{selectedItem.name}</span> · {selectedItem.unit} · Rs. {selectedItem.price}
              </div>
            )}

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-white/5 text-white/45">
                    <tr>
                      <th className="px-4 py-3 text-left">Item</th>
                      <th className="px-4 py-3 text-left">Qty</th>
                      <th className="px-4 py-3 text-left">Price</th>
                      <th className="px-4 py-3 text-left">Total</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => (
                      <tr key={line.itemId} className="border-t border-white/10">
                        <td className="px-4 py-3">{line.name}</td>
                        <td className="px-4 py-3">{line.quantity}</td>
                        <td className="px-4 py-3">Rs. {line.price}</td>
                        <td className="px-4 py-3">Rs. {line.total}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => setLines((prev) => prev.filter((entry) => entry.itemId !== line.itemId))} className="rounded-lg bg-red-500/15 px-3 py-1 text-red-300">
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!lines.length && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-white/35">No items added yet</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-xl font-semibold mb-4">Bill Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-white/55">Subtotal</span><span>Rs. {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-white/55">GST (5%)</span><span>Rs. {gst.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold"><span>Grand Total</span><span className="text-[#c9a14a]">Rs. {grandTotal.toFixed(2)}</span></div>
            </div>
            <button onClick={createBill} disabled={saving || !lines.length} className="mt-6 w-full rounded-xl bg-[#c9a14a] px-4 py-3 text-sm font-semibold text-black disabled:opacity-60">
              {saving ? 'Creating Bill...' : 'Create Bill'}
            </button>

            {latestBill && (
              <div className="mt-6 rounded-2xl border border-green-500/20 bg-green-500/10 p-5">
                <p className="font-semibold text-green-300">Latest bill created</p>
                <p className="mt-2 text-sm text-white">Bill ID: {latestBill.id}</p>
                <p className="text-sm text-white/65">Customer: {latestBill.customer_name}</p>
                <p className="text-sm text-white/65">Created: {formatDateTime(latestBill.created_at)}</p>
                <button onClick={printBill} className="mt-4 rounded-xl border border-green-400/25 bg-green-500/15 px-4 py-3 text-sm font-semibold text-green-200">
                  Print Bill
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
