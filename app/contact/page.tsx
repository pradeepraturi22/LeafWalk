'use client'
import { useState, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'

const PHONE_RE = /^[6-9]\d{9}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const CONTACT_CARDS = [
  { icon: '📍', title: 'Our Location', lines: ['Vill- Banas, Narad Chatti', 'Hanuman Chatti, Yamunotri Road', 'Uttarkashi, Uttarakhand — 249193'] },
  { icon: '📞', title: 'Call Us', lines: ['+91 9368080535', '+91 8630227541'], links: [{ href: 'tel:+919368080535', label: 'Call Now' }] },
  { icon: '💬', title: 'WhatsApp', lines: ['+91 8630227541', 'Available 8 AM – 10 PM'], links: [{ href: 'https://wa.me/918630227541?text=Hello%20LeafWalk%20Resort', label: 'Open WhatsApp' }] },
  { icon: '✉️', title: 'Email', lines: ['info@leafwalk.in'], links: [{ href: 'mailto:info@leafwalk.in', label: 'Send Email' }] },
]

export default function ContactPage() {
  const today    = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [form, setForm] = useState({ name: '', phone: '', email: '', checkin: today, checkout: tomorrow, rooms: '1', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Please enter your full name'
    if (!PHONE_RE.test(form.phone.replace(/\D/g, ''))) e.phone = 'Enter a valid 10-digit Indian mobile number'
    if (form.email && !EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address'
    if (!form.checkin) e.checkin = 'Check-in date required'
    if (!form.checkout) e.checkout = 'Check-out date required'
    if (form.checkin && form.checkout && new Date(form.checkout) <= new Date(form.checkin)) e.checkout = 'Check-out must be after check-in'
    return e
  }

  function touch(field: string) {
    setTouched(t => ({ ...t, [field]: true }))
    const errs = validate()
    setErrors(errs)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const allTouched = Object.fromEntries(Object.keys(form).map(k => [k, true]))
    setTouched(allTouched)
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) { toast.error('Please fix the errors before submitting'); return }

    setSubmitting(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      const res = await fetch('https://formspree.io/f/xbdyykyd', { method: 'POST', body: fd, headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error()
      setSuccess(true)
      setForm({ name: '', phone: '', email: '', checkin: today, checkout: tomorrow, rooms: '1', message: '' })
      setTouched({})
    } catch {
      toast.error('Failed to send. Please call us directly or try WhatsApp.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(false), 6000); return () => clearTimeout(t) }
  }, [success])

  const INP = (field: string) =>
    `w-full px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none ${errors[field] && touched[field] ? 'border-red-500' : 'border-white/15 hover:border-white/25 focus:border-[#c9a14a]'}`
  const BASE = { background: 'rgba(255,255,255,0.06)', color: '#ffffff' }

  return (
    <section className="min-h-screen py-20 px-4" style={{ background: '#0b0b0b' }}>
      <Toaster position="top-center" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.35em] font-semibold mb-3">Get In Touch</p>
          <h1 className="font-playfair text-5xl text-[#c9a14a] mb-4">Contact & Enquiries</h1>
          <p className="text-white/45 max-w-xl mx-auto">Plan your perfect mountain escape. Reach out for bookings, special packages, or any queries.</p>
        </div>

        {/* Contact cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {CONTACT_CARDS.map(c => (
            <div key={c.title} className="p-5 rounded-2xl border border-white/8 hover:border-[#c9a14a]/25 transition-all" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-3xl block mb-3">{c.icon}</span>
              <h3 className="text-white font-semibold mb-2 text-sm">{c.title}</h3>
              {c.lines.map(l => <p key={l} className="text-white/45 text-xs leading-relaxed">{l}</p>)}
              {c.links?.map(lk => (
                <a key={lk.href} href={lk.href} target={lk.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                  className="inline-block mt-3 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#c9a14a]/10 text-[#c9a14a] border border-[#c9a14a]/20 hover:bg-[#c9a14a]/20 transition-all">
                  {lk.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          {/* Enquiry form */}
          <div>
            <h2 className="font-playfair text-2xl text-[#c9a14a] mb-6">Send an Enquiry</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Full Name <span className="text-red-400">*</span></label>
                <input type="text" autoComplete="name" maxLength={100} placeholder="Your full name"
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onBlur={() => touch('name')}
                  className={INP('name')} style={BASE} />
                {errors.name && touched.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* Phone + Email */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Mobile Number <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none" style={{ color: 'rgba(255,255,255,0.45)' }}>+91</span>
                    <input type="tel" autoComplete="tel" maxLength={10} placeholder="10-digit number" inputMode="numeric"
                      value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} onBlur={() => touch('phone')}
                      className={INP('phone') + ' pl-12'} style={BASE} />
                  </div>
                  {errors.phone && touched.phone && <p className="text-red-400 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Email <span className="text-white/25 text-xs font-normal">(optional)</span></label>
                  <input type="email" autoComplete="email" maxLength={100} placeholder="your@email.com"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} onBlur={() => touch('email')}
                    className={INP('email')} style={BASE} />
                  {errors.email && touched.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
                </div>
              </div>

              {/* Dates + Rooms */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Check-in <span className="text-red-400">*</span></label>
                  <input type="date" min={today} value={form.checkin}
                    onChange={e => setForm(f => ({ ...f, checkin: e.target.value }))} onBlur={() => touch('checkin')}
                    className={INP('checkin')} style={{ ...BASE, colorScheme: 'dark' }} />
                  {errors.checkin && touched.checkin && <p className="text-red-400 text-xs mt-1">{errors.checkin}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Check-out <span className="text-red-400">*</span></label>
                  <input type="date" min={form.checkin || tomorrow} value={form.checkout}
                    onChange={e => setForm(f => ({ ...f, checkout: e.target.value }))} onBlur={() => touch('checkout')}
                    className={INP('checkout')} style={{ ...BASE, colorScheme: 'dark' }} />
                  {errors.checkout && touched.checkout && <p className="text-red-400 text-xs mt-1">{errors.checkout}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Rooms</label>
                  <select value={form.rooms} onChange={e => setForm(f => ({ ...f, rooms: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-white/15 text-sm focus:outline-none focus:border-[#c9a14a] transition-all"
                    style={BASE}>
                    {['1','2','3','4','5'].map(n => <option key={n} value={n} style={{ background: '#1a1a1a' }}>{n} Room{+n > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Message / Special Request</label>
                <textarea rows={4} maxLength={1000} placeholder="Tell us about your trip — group size, occasion, preferences..."
                  value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-white/15 text-sm resize-none focus:outline-none focus:border-[#c9a14a] transition-all hover:border-white/25"
                  style={BASE} />
                <p className="text-xs text-right mt-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{form.message.length}/1000</p>
              </div>

              <button type="submit" disabled={submitting}
                className="w-full py-4 rounded-xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #c9a14a, #e6c87a)', color: '#000' }}>
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Sending...
                  </span>
                ) : 'Send Enquiry'}
              </button>

              {success && (
                <div className="p-4 rounded-xl text-sm font-medium text-center" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}>
                  ✅ Thank you! Your enquiry has been sent. Our team will contact you within 2–4 hours.
                </div>
              )}
            </form>
          </div>

          {/* Right — How to reach + quick info */}
          <div className="space-y-6">
            <div>
              <h2 className="font-playfair text-2xl text-[#c9a14a] mb-5">How to Reach Us</h2>
              <div className="space-y-4">
                {[
                  { icon: '🚗', title: 'By Road', desc: '180 km from Rishikesh via Uttarkashi on NH-94. Taxi and buses available from Rishikesh, Dehradun, and Uttarkashi.' },
                  { icon: '🚆', title: 'By Train', desc: 'Nearest railway station: Rishikesh (180 km) or Haridwar (190 km). Hire a cab from the station.' },
                  { icon: '✈️', title: 'By Air', desc: 'Nearest airport: Jolly Grant Airport, Dehradun (200 km). Cabs available at the airport.' },
                  { icon: '🏨', title: 'Resort Pickup', desc: 'We arrange pickup from Uttarkashi town on request. Contact us in advance to book.' },
                ].map(item => (
                  <div key={item.title} className="flex gap-4 p-4 rounded-xl border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span className="text-2xl flex-shrink-0">{item.icon}</span>
                    <div>
                      <h4 className="text-white font-semibold text-sm mb-1">{item.title}</h4>
                      <p className="text-white/45 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[#c9a14a]/20" style={{ background: 'rgba(201,161,74,0.05)' }}>
              <h4 className="text-[#c9a14a] font-semibold mb-3 text-sm">Quick Facts</h4>
              <div className="space-y-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                <p>• Check-in: 3:00 PM · Check-out: 11:00 AM</p>
                <p>• Altitude: ~2,400 m above sea level</p>
                <p>• Best time to visit: April–June, October–November</p>
                <p>• Best winter experience: December–February</p>
                <p>• Nearest temple: Yamunotri Dham (45 min drive)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div>
          <h2 className="font-playfair text-2xl text-[#c9a14a] mb-5">Find Us on Map</h2>
          <div className="rounded-2xl overflow-hidden border border-white/8">
            <iframe
              src="https://www.google.com/maps?q=Hanuman+Chatti+Yamunotri+Uttarkashi+Uttarakhand&output=embed"
              className="w-full h-80"
              loading="lazy"
              title="LeafWalk Resort Location"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <p className="text-white/30 text-xs mt-2 text-center">Vill- Banas, Narad Chatti, Hanuman Chatti, Yamunotri Road, Uttarkashi — 249193</p>
        </div>
      </div>
    </section>
  )
}
