'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import AdminNavbar from '@/components/AdminNavbar'
import AdminTariffForm from '@/components/AdminTariffForm'
import { Toaster } from 'react-hot-toast'

export default function AdminTariffPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    verify()
  }, [])

  async function verify() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        window.location.href = '/admin/login'
        return
      }

      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        window.location.href = '/admin/login'
        return
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0b0b]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#c9a14a] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b]">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1a1a1a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <AdminNavbar />
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#c9a14a]">Unified Tariff Console</p>
          <h1 className="font-playfair text-4xl text-white">Room, Meal & Tour Operator Pricing</h1>
          <p className="mt-3 max-w-2xl text-sm text-white/45">
            Set direct booking, OTA, and tour operator pricing from one place. LWWEB and OTA use date-wise base room pricing plus meal add-ons, while tour operator rates stay flat by meal plan.
          </p>
        </div>
        <AdminTariffForm />
      </div>
    </div>
  )
}
