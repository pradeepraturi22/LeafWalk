'use client'

import React from 'react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import AdminNavbar from '@/components/AdminNavbar'
import toast, { Toaster } from 'react-hot-toast'
import { formatCurrency, formatDate } from '@/lib/utils'

interface TourOperator {
  id: string
  company_name: string
  contact_person: string
  email: string
  phone: string
  pan_number?: string
  gst_number?: string
  address: string
  city: string
  state: string
  commission_rate: number
  status: 'active' | 'inactive'
  total_bookings: number
  total_revenue: number
  created_at: string
}

export default function TourOperatorsPage() {
  const router = useRouter()
  const [operators, setOperators] = useState<TourOperator[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    pan_number: '',
    gst_number: '',
    address: '',
    city: '',
    state: '',
    commission_rate: 10,
    status: 'active' as 'active' | 'inactive'
  })

  useEffect(() => {
    checkAuth()
    loadOperators()
  }, [])

  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { window.location.href = '/admin/login'; return }
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      if (!res.ok) { window.location.href = '/admin/login'; return }
    } catch { window.location.href = '/admin/login' }
  }

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function loadOperators() {
    try {
      const res = await fetch('/api/admin/data?type=operators', { headers: { 'Authorization': `Bearer ${await getToken()}` } })
      const { data, error } = await res.json()
      if (error) throw new Error(error)

      const operatorsWithStats = data?.map((op: any) => ({
        ...op,
        total_bookings: op.bookings?.[0]?.count || 0,
        total_revenue: op.bookings?.reduce((sum: number, b: any) => sum + (b.total_amount || 0), 0) || 0
      })) || []

      setOperators(operatorsWithStats)
    } catch (error) {
      console.error('Error loading operators:', error)
      toast.error('Failed to load tour operators')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'commission_rate' ? parseFloat(value) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/data?type=operator&id=${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },
          body: JSON.stringify(formData)
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        toast.success('Tour operator updated successfully')
      } else {
        const res = await fetch('/api/admin/data?type=operator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },getToken()}` },
          body: JSON.stringify(formData)
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.error)
        toast.success('Tour operator registered successfully')
      }
      resetForm()
      loadOperators()
    } catch (error: any) {
      toast.error(error.message || 'Failed to save tour operator')
    }
  }

  const handleEdit = (operator: TourOperator) => {
    setFormData({
      company_name: operator.company_name,
      contact_person: operator.contact_person,
      email: operator.email,
      phone: operator.phone,
      pan_number: operator.pan_number || '',
      gst_number: operator.gst_number || '',
      address: operator.address,
      city: operator.city,
      state: operator.state,
      commission_rate: operator.commission_rate,
      status: operator.status
    })
    setEditingId(operator.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tour operator?')) return
    try {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await getToken()}` },it getToken()}` } })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast.success('Tour operator deleted')
      loadOperators()
    } catch (error) {
      toast.error('Failed to delete tour operator')
    }
  }

  const resetForm = () => {
    setFormData({
      company_name: '', contact_person: '', email: '', phone: '',
      pan_number: '', gst_number: '', address: '', city: '', state: '',
      commission_rate: 10, status: 'active'
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#c9a14a]"></div></div>

  return (
    <>
      <AdminNavbar />
      <Toaster position="top-center" />
      <div className="min-h-screen bg-[#0b0b0b] py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-4xl font-playfair text-[#c9a14a] mb-2">Tour Operators & Travel Agents</h1>
              <p className="text-white/70">Manage partnerships and track business performance</p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black px-6 py-3 rounded-full font-semibold hover:opacity-90">
              {showForm ? 'Cancel' : '+ Add New Operator'}
            </button>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
              <p className="text-white/50 text-sm mb-1">Total Operators</p>
              <p className="text-3xl font-bold text-white">{operators.length}</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
              <p className="text-white/50 text-sm mb-1">Active</p>
              <p className="text-3xl font-bold text-[#c9a14a]">{operators.filter(o => o.status === 'active').length}</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
              <p className="text-white/50 text-sm mb-1">Total Bookings</p>
              <p className="text-3xl font-bold text-white">{operators.reduce((sum, o) => sum + o.total_bookings, 0)}</p>
            </div>
            <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10">
              <p className="text-white/50 text-sm mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-[#c9a14a]">{formatCurrency(operators.reduce((sum, o) => sum + o.total_revenue, 0))}</p>
            </div>
          </div>

          {showForm && (
            <div className="bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10 mb-8">
              <h2 className="text-2xl font-playfair text-white mb-6">{editingId ? 'Edit' : 'Register New'} Tour Operator</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Company Name *</label>
                    <input type="text" name="company_name" value={formData.company_name} onChange={handleInputChange} required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Contact Person *</label>
                    <input type="text" name="contact_person" value={formData.contact_person} onChange={handleInputChange} required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Email *</label>
                    <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Phone *</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">PAN Number</label>
                    <input type="text" name="pan_number" value={formData.pan_number} onChange={handleInputChange} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">GST Number</label>
                    <input type="text" name="gst_number" value={formData.gst_number} onChange={handleInputChange} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">City *</label>
                    <input type="text" name="city" value={formData.city} onChange={handleInputChange} required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">State *</label>
                    <input type="text" name="state" value={formData.state} onChange={handleInputChange} required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Commission Rate (%) *</label>
                    <input type="number" name="commission_rate" value={formData.commission_rate} onChange={handleInputChange} min="0" max="100" step="0.5" required className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Status *</label>
                    <select name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-2">Address *</label>
                  <textarea name="address" value={formData.address} onChange={handleInputChange} required rows={3} className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-[#c9a14a]" />
                </div>
                <div className="flex gap-4">
                  <button type="submit" className="bg-gradient-to-r from-[#c9a14a] to-[#e6c87a] text-black px-8 py-3 rounded-full font-semibold hover:opacity-90">
                    {editingId ? 'Update' : 'Register'} Operator
                  </button>
                  <button type="button" onClick={resetForm} className="bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full font-semibold transition-all">Cancel</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Company</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Contact</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Commission</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Bookings</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Revenue</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-white/70">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((operator) => (
                    <tr key={operator.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-6 py-4">
                        <p className="text-white font-medium">{operator.company_name}</p>
                        <p className="text-white/50 text-sm">{operator.city}, {operator.state}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white text-sm">{operator.contact_person}</p>
                        <p className="text-white/50 text-xs">{operator.phone}</p>
                        <p className="text-white/50 text-xs">{operator.email}</p>
                      </td>
                      <td className="px-6 py-4 text-white">{operator.commission_rate}%</td>
                      <td className="px-6 py-4 text-white">{operator.total_bookings}</td>
                      <td className="px-6 py-4 text-[#c9a14a] font-semibold">{formatCurrency(operator.total_revenue)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${operator.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {operator.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(operator)} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30">Edit</button>
                          <button onClick={() => handleDelete(operator.id)} className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {operators.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-white/50">No tour operators registered yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}