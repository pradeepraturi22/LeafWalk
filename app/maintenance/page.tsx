'use client'
// app/maintenance/page.tsx
// CSS injected via useEffect only on client — avoids SSR hydration mismatch

import { useEffect, useState } from 'react'

const LEAVES = [
  { top: '8%',  left: '6%',  size: 28, delay: 0,   dur: 18 },
  { top: '15%', left: '88%', size: 20, delay: 2.5, dur: 22 },
  { top: '72%', left: '4%',  size: 24, delay: 1.2, dur: 20 },
  { top: '80%', left: '91%', size: 18, delay: 3.8, dur: 25 },
  { top: '45%', left: '92%', size: 14, delay: 0.8, dur: 15 },
  { top: '55%', left: '2%',  size: 16, delay: 4.1, dur: 19 },
  { top: '30%', left: '3%',  size: 12, delay: 6.0, dur: 28 },
  { top: '90%', left: '50%', size: 10, delay: 2.0, dur: 23 },
]

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500&display=swap');
@keyframes floatLeaf {
  0%   { transform: translateY(0px) rotate(0deg) scale(1); opacity: 0.12; }
  25%  { transform: translateY(-18px) rotate(8deg) scale(1.04); opacity: 0.18; }
  50%  { transform: translateY(-8px) rotate(-5deg) scale(0.97); opacity: 0.14; }
  75%  { transform: translateY(-22px) rotate(12deg) scale(1.02); opacity: 0.20; }
  100% { transform: translateY(0px) rotate(0deg) scale(1); opacity: 0.12; }
}
@keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes ping { 0% { transform: scale(0.95); opacity: 0.8; } 70% { transform: scale(1.12); opacity: 0; } 100% { transform: scale(0.95); opacity: 0; } }
@keyframes progressFill { 0% { width: 0%; } 40% { width: 62%; } 70% { width: 78%; } 90% { width: 88%; } 100% { width: 94%; } }
@keyframes dotPulse { 0%,80%,100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInUp   { from { opacity: 0; transform: translateY(16px);  } to { opacity: 1; transform: translateY(0); } }
.mnt-leaf { position: fixed; pointer-events: none; animation: floatLeaf linear infinite; z-index: 0; filter: blur(0.4px); }
.mnt-gold-line { width: 1px; height: 64px; background: linear-gradient(to bottom, transparent, #c9a14a80, transparent); margin: 0 auto 2.5rem; animation: fadeInDown 1.2s ease 0.3s forwards; opacity: 0; }
.mnt-ring { position: absolute; inset: -8px; border-radius: 50%; border: 1px solid #c9a14a40; animation: ping 2.4s ease-out infinite; }
.mnt-progress { height: 100%; background: linear-gradient(90deg, #c9a14a, #e8c97a, #c9a14a); background-size: 200% 100%; border-radius: 99px; animation: progressFill 8s ease-out forwards, shimmer 2s linear infinite; }
.mnt-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #c9a14a; margin: 0 3px; }
.mnt-dot:nth-child(1) { animation: dotPulse 1.4s ease-in-out infinite 0s; }
.mnt-dot:nth-child(2) { animation: dotPulse 1.4s ease-in-out infinite 0.2s; }
.mnt-dot:nth-child(3) { animation: dotPulse 1.4s ease-in-out infinite 0.4s; }
.mnt-fi1 { animation: fadeInDown 1s ease 0.5s forwards; opacity: 0; }
.mnt-fi2 { animation: fadeInUp  1s ease 0.8s forwards; opacity: 0; }
.mnt-fi3 { animation: fadeInUp  1s ease 1.1s forwards; opacity: 0; }
.mnt-fi4 { animation: fadeInUp  1s ease 1.4s forwards; opacity: 0; }
.mnt-fi5 { animation: fadeInUp  1s ease 1.7s forwards; opacity: 0; }
.mnt-corner { position: fixed; width: 60px; height: 60px; opacity: 0.25; pointer-events: none; }
.mnt-corner-tl { top: 24px;    left: 24px;  border-top: 1px solid #c9a14a; border-left:   1px solid #c9a14a; }
.mnt-corner-tr { top: 24px;    right: 24px; border-top: 1px solid #c9a14a; border-right:  1px solid #c9a14a; }
.mnt-corner-bl { bottom: 24px; left: 24px;  border-bottom: 1px solid #c9a14a; border-left: 1px solid #c9a14a; }
.mnt-corner-br { bottom: 24px; right: 24px; border-bottom: 1px solid #c9a14a; border-right: 1px solid #c9a14a; }
.mnt-link { color: #c9a14a90; text-decoration: none; transition: color 0.2s; }
.mnt-link:hover { color: #c9a14a; }
@media (max-width: 480px) { .mnt-corner { display: none; } }
`

export default function MaintenancePage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Inject CSS client-side only — no SSR = no hydration mismatch
    if (!document.getElementById('mnt-styles')) {
      const el = document.createElement('style')
      el.id = 'mnt-styles'
      el.textContent = CSS
      document.head.appendChild(el)
    }
    setMounted(true)
    return () => { document.getElementById('mnt-styles')?.remove() }
  }, [])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', position: 'relative',
      background: 'radial-gradient(ellipse 80% 60% at 50% 110%, #1a2e1280 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 20% 0%, #0f1f0a50 0%, transparent 55%), #0a0d08',
      padding: '2rem', fontFamily: "'Jost', sans-serif", overflowX: 'hidden',
    }}>
      {/* Corner brackets */}
      <div className="mnt-corner mnt-corner-tl" />
      <div className="mnt-corner mnt-corner-tr" />
      <div className="mnt-corner mnt-corner-bl" />
      <div className="mnt-corner mnt-corner-br" />

      {/* Noise overlay */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.04,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px',
      }} />

      {/* Floating leaves — client only to avoid hydration issues */}
      {mounted && LEAVES.map((l, i) => (
        <svg key={i} className="mnt-leaf"
          style={{ top: l.top, left: l.left, width: l.size, height: l.size, animationDuration: `${l.dur}s`, animationDelay: `${l.delay}s` }}
          viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6 2 2 8 2 14c0 3.3 1.6 6 4 7.5C7.5 20 10 18 12 15c2 3 4.5 5 6 6.5 2.4-1.5 4-4.2 4-7.5C22 8 18 2 12 2z" fill="#4a7c3f" />
        </svg>
      ))}

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 500, width: '100%' }}>

        <div className="mnt-gold-line" />

        {/* Logo */}
        <div className="mnt-fi1" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div className="mnt-ring" />
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #1a2e12, #0f1a0a)', border: '1px solid #c9a14a30', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C6 2 2 8 2 14c0 3.3 1.6 6 4 7.5C7.5 20 10 18 12 15c2 3 4.5 5 6 6.5 2.4-1.5 4-4.2 4-7.5C22 8 18 2 12 2z" fill="#c9a14a" opacity="0.9"/>
                <circle cx="12" cy="14" r="1.5" fill="#0a0d08" />
                <line x1="12" y1="2" x2="12" y2="15.5" stroke="#0a0d08" strokeWidth="1" />
              </svg>
            </div>
          </div>
        </div>

        {/* Brand name */}
        <div className="mnt-fi2" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', fontWeight: 600, letterSpacing: '0.02em', color: '#f0ece4', lineHeight: 1.1 }}>LeafWalk Resort</div>
          <div style={{ fontSize: '0.7rem', fontWeight: 400, letterSpacing: '0.35em', color: '#c9a14a', textTransform: 'uppercase', marginTop: '0.5rem' }}>Yamunotri · Uttarakhand</div>
        </div>

        <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, #c9a14a50, transparent)', margin: '2rem auto 1.8rem' }} />

        {/* Heading + subtext */}
        <div className="mnt-fi3">
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)', fontWeight: 400, fontStyle: 'italic', color: '#e8e2d8', textAlign: 'center', lineHeight: 1.3, marginBottom: '1rem' }}>
            We're preparing something special
          </div>
          <p style={{ fontSize: '0.875rem', fontWeight: 300, color: '#ffffff55', textAlign: 'center', letterSpacing: '0.04em', maxWidth: 380, lineHeight: 1.7, margin: '0 auto 2rem' }}>
            Our website is being refreshed with a new experience. We'll be back shortly — meantime, reach us directly for bookings.
          </p>
        </div>

        {/* Progress */}
        <div className="mnt-fi4" style={{ marginBottom: '2rem' }}>
          <div style={{ width: 240, height: 1, background: '#ffffff10', borderRadius: 99, overflow: 'hidden', margin: '0 auto' }}>
            <div className="mnt-progress" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.8rem' }}>
            <span className="mnt-dot" /><span className="mnt-dot" /><span className="mnt-dot" />
          </div>
        </div>

        <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, #c9a14a50, transparent)', margin: '0 auto 1.5rem' }} />

        {/* Contact */}
        <div className="mnt-fi5">
          {[
            { icon: '📞', label: '+91 93682 80535',              href: 'tel:+919368280535' },
            { icon: '✉️', label: 'info@leafwalk.in',              href: 'mailto:info@leafwalk.in' },
            { icon: '💬', label: 'WhatsApp for instant booking',  href: 'https://wa.me/918630227541' },
          ].map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', color: '#ffffff35', fontSize: '0.8rem', fontWeight: 300, letterSpacing: '0.05em', marginBottom: '0.6rem' }}>
              <span>{c.icon}</span>
              <a className="mnt-link" href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{c.label}</a>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#ffffff20', textTransform: 'uppercase' }}>
            © {new Date().getFullYear()} LeafWalk Resort · All rights reserved
          </span>
        </div>

      </div>
    </div>
  )
}