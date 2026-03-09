// lib/booking-receipt-generator.ts

const RESORT = {
  name: 'LeafWalk Resort',
  tagline: 'Stay in Lap of Nature',
  address: 'Vill- Banas, Narad Chatti, Hanuman Chatti',
  city: 'Yamunotri Road, Uttarkashi, Uttarakhand - 249193',
  phone: '+91-9368080535 | +91-8630227541',
  email: 'info@leafwalk.in',
  website: 'www.leafwalk.in',
  gstin: '05AADFL1234R1Z5',
}

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only', CP: 'With Breakfast',
  MAP: 'Breakfast + Dinner', AP: 'All Meals Included',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  confirmed:   { bg: '#1a3a5c', text: '#60a5fa', label: 'CONFIRMED' },
  hold:        { bg: '#3a2a00', text: '#f59e0b', label: 'ON HOLD' },
  checked_in:  { bg: '#0f3320', text: '#34d399', label: 'CHECKED IN' },
  checked_out: { bg: '#2a1a4a', text: '#a78bfa', label: 'CHECKED OUT' },
  pending:     { bg: '#3a3a00', text: '#facc15', label: 'PENDING' },
}

const PAY_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  fully_paid:   { bg: '#0f3320', text: '#34d399', label: '✓ FULLY PAID' },
  advance_paid: { bg: '#3a2800', text: '#fb923c', label: '◑ ADVANCE PAID' },
  pending:      { bg: '#3a0000', text: '#f87171', label: '○ PAYMENT PENDING' },
}

export function generateBookingReceipt(booking: any): void {
  const checkIn  = new Date(booking.check_in).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })
  const createdAt = new Date(booking.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const mealLabel = MEAL_LABELS[booking.meal_plan] || booking.meal_plan || '—'
  const bStatus = STATUS_COLORS[booking.booking_status] || STATUS_COLORS.pending
  const pStatus = PAY_STATUS[booking.payment_status] || PAY_STATUS.pending
  const nights = Number(booking.nights || 0)
  const total = Number(booking.total_amount || 0)
  const advance = Number(booking.advance_amount || 0)
  const balance = Number(booking.balance_amount || 0)
  const isFullyPaid = booking.payment_status === 'fully_paid'
  const operator = booking.tour_operator || null
  const bookingNo = booking.booking_number || booking.id?.slice(0,8).toUpperCase()

  // Room items for multi-room
  const roomItems = booking.room_items || []
  const hasMultiRoom = roomItems.length > 1

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Booking Receipt - ${bookingNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@300;400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;background:#0f0f0f;color:#e5e5e5;font-size:13px;min-height:100vh;display:flex;justify-content:center;padding:20px}
  .card{width:420px;background:#1a1a1a;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);border:1px solid #2a2a2a}

  /* Header */
  .hdr{background:linear-gradient(135deg,#0a0a0a,#1a1207,#1e1a0a);padding:24px;position:relative;overflow:hidden}
  .hdr::before{content:'';position:absolute;top:-50px;right:-50px;width:180px;height:180px;background:radial-gradient(circle,rgba(201,161,74,.15),transparent 70%);border-radius:50%}
  .hdr-inner{display:flex;align-items:center;gap:14px;position:relative;z-index:1}
  .logo{width:48px;height:48px;border:1.5px solid rgba(201,161,74,.6);border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(201,161,74,.08);font-size:20px;flex-shrink:0}
  .rname{font-family:'Playfair Display',serif;font-size:20px;font-weight:700;color:#c9a14a;letter-spacing:1.5px}
  .rtag{color:#8b6914;font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;margin-top:2px}
  .rcontact{color:#555;font-size:10px;margin-top:4px;line-height:1.7}
  .rcontact .hl{color:#c9a14a}

  .gbar{height:2px;background:linear-gradient(90deg,#5a3c0a,#c9a14a,#e6c87a,#c9a14a,#5a3c0a)}

  /* Receipt label */
  .receipt-label{background:#111;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #2a2a2a}
  .rl-title{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase;font-weight:600}
  .rl-no{font-family:'Playfair Display',serif;font-size:14px;color:#c9a14a;font-weight:700}

  /* Status badges */
  .badges{display:flex;gap:8px;padding:12px 24px;background:#111;border-bottom:1px solid #2a2a2a;flex-wrap:wrap}
  .badge{padding:4px 12px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:1px}

  /* Body */
  .body{padding:20px 24px}

  /* Guest */
  .guest-name{font-family:'Playfair Display',serif;font-size:22px;color:#fff;font-weight:700;margin-bottom:2px}
  .guest-sub{color:#666;font-size:11px}

  /* Divider */
  .div{height:1px;background:#252525;margin:16px 0}

  /* Stay dates */
  .dates{display:flex;gap:0;margin:0 -24px;background:#111;border-top:1px solid #252525;border-bottom:1px solid #252525}
  .date-cell{flex:1;padding:14px 16px;text-align:center;border-right:1px solid #252525}
  .date-cell:last-child{border-right:none}
  .date-lbl{font-size:8px;color:#555;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px}
  .date-val{font-size:12px;color:#e5e5e5;font-weight:600;line-height:1.3}
  .date-night{font-size:22px;font-weight:700;color:#c9a14a;font-family:'Playfair Display',serif}

  /* Info grid */
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
  .info-box{background:#111;border-radius:10px;padding:12px;border:1px solid #252525}
  .ib-lbl{font-size:8.5px;color:#555;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
  .ib-val{font-size:12.5px;color:#e5e5e5;font-weight:600}
  .ib-sub{font-size:10px;color:#666;margin-top:2px}

  /* Room items */
  .room-item{background:#111;border-radius:10px;padding:12px;border:1px solid #252525;margin-top:10px}
  .ri-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .ri-name{font-size:13px;font-weight:600;color:#e5e5e5}
  .ri-total{font-size:13px;font-weight:700;color:#c9a14a}
  .ri-detail{font-size:11px;color:#555;line-height:1.7}

  /* Payment */
  .payment{background:#0d1a0d;border:1px solid #1a3a1a;border-radius:12px;padding:16px;margin-top:16px}
  .payment.partial{background:#1a1200;border-color:#3a2a00}
  .payment.pending-pay{background:#1a0000;border-color:#3a0000}
  .pay-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0}
  .pay-lbl{font-size:11.5px;color:#888}
  .pay-val{font-size:11.5px;color:#e5e5e5;font-weight:500}
  .pay-total{font-size:16px;font-weight:700;color:#c9a14a}
  .pay-total-lbl{font-size:12px;font-weight:600;color:#888}
  .pay-div{height:1px;background:#2a2a2a;margin:8px 0}
  .balance-row .pay-lbl{color:#f87171}
  .balance-row .pay-val{color:#f87171;font-weight:700}

  /* Transaction */
  .txn{background:#111;border:1px solid #252525;border-radius:10px;padding:12px;margin-top:10px}
  .txn-lbl{font-size:8.5px;color:#555;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
  .txn-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .txn-item .tl{font-size:9px;color:#444}
  .txn-item .tv{font-size:11.5px;color:#aaa;font-weight:500;margin-top:1px}

  /* Footer */
  .footer{margin-top:20px;padding-top:16px;border-top:1px solid #252525}
  .footer-resort{text-align:center}
  .fr-name{font-family:'Playfair Display',serif;color:#c9a14a;font-size:14px;font-weight:700;margin-bottom:4px}
  .fr-detail{color:#444;font-size:10px;line-height:1.8}
  .fr-detail .hl{color:#666}

  /* Policies */
  .policies{margin-top:14px;background:#111;border-radius:10px;padding:12px;border:1px solid #1a1a1a}
  .pol-title{font-size:8.5px;color:#444;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
  .pol-item{font-size:10.5px;color:#444;line-height:1.8;padding-left:12px;position:relative}
  .pol-item::before{content:'·';position:absolute;left:0;color:#555}

  /* Operator */
  .op-box{background:#111;border:1px solid #252525;border-radius:10px;padding:12px;margin-top:12px}
  .op-lbl{font-size:8.5px;color:#555;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
  .op-name{font-size:13px;font-weight:600;color:#e5e5e5}
  .op-detail{font-size:10.5px;color:#555;margin-top:2px}

  .bottom-bar{height:3px;background:linear-gradient(90deg,#5a3c0a,#c9a14a,#e6c87a,#c9a14a,#5a3c0a);margin-top:20px}

  @media print{
    body{background:#fff;padding:0}
    .card{width:100%;box-shadow:none;border-radius:0;background:#fff;color:#000}
    .hdr{background:#0a0a0a !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    * {-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{margin:0;size:A5}
  }
</style>
</head>
<body>
<div class="card">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-inner">
      <div class="logo">🌿</div>
      <div>
        <div class="rname">LEAFWALK RESORT</div>
        <div class="rtag">Stay in Lap of Nature</div>
        <div class="rcontact">
          <span class="hl">${RESORT.phone}</span><br>
          ${RESORT.email} · ${RESORT.website}
        </div>
      </div>
    </div>
  </div>
  <div class="gbar"></div>

  <!-- Receipt label -->
  <div class="receipt-label">
    <span class="rl-title">Booking Receipt</span>
    <span class="rl-no">${bookingNo}</span>
  </div>

  <!-- Status badges -->
  <div class="badges">
    <span class="badge" style="background:${bStatus.bg};color:${bStatus.text}">${bStatus.label}</span>
    <span class="badge" style="background:${pStatus.bg};color:${pStatus.text}">${pStatus.label}</span>
    ${operator ? '<span class="badge" style="background:#1a1a3a;color:#818cf8">B2B · TOUR OPERATOR</span>' : ''}
    <span class="badge" style="background:#1a1a1a;color:#555">Issued: ${createdAt}</span>
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Guest -->
    <div class="guest-name">${booking.guest_name}</div>
    <div class="guest-sub">
      ${booking.guest_phone ? '📞 ' + booking.guest_phone : ''}
      ${booking.guest_email ? ' · ✉ ' + booking.guest_email : ''}
    </div>

    <!-- Dates -->
    <div class="dates" style="margin-top:16px">
      <div class="date-cell">
        <div class="date-lbl">Check-in</div>
        <div class="date-val">${checkIn}</div>
        <div style="font-size:10px;color:#555;margin-top:2px">After 3:00 PM</div>
      </div>
      <div class="date-cell" style="flex:0.6">
        <div class="date-lbl">Nights</div>
        <div class="date-night">${nights}</div>
      </div>
      <div class="date-cell">
        <div class="date-lbl">Check-out</div>
        <div class="date-val">${checkOut}</div>
        <div style="font-size:10px;color:#555;margin-top:2px">Before 11:00 AM</div>
      </div>
    </div>

    <!-- Room info -->
    ${hasMultiRoom ? `
    <div style="margin-top:14px">
      <div style="font-size:9px;color:#555;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">Room Details</div>
      ${roomItems.map((item: any) => `
      <div class="room-item">
        <div class="ri-header">
          <span class="ri-name">${item.room?.name || '—'}</span>
          <span class="ri-total">₹${Number(item.line_total || 0).toLocaleString()}</span>
        </div>
        <div class="ri-detail">
          ${item.rooms_booked} room × ${nights} nights · ${MEAL_LABELS[item.meal_plan] || item.meal_plan}<br>
          ${item.adults} Adult${item.adults > 1 ? 's' : ''}
          ${item.children_below_5 > 0 ? ` · ${item.children_below_5} Child (0-5)` : ''}
          ${item.children_5_to_12 > 0 ? ` · ${item.children_5_to_12} Child (6-12)` : ''}
          ${item.extra_beds > 0 ? ` · ${item.extra_beds} Extra Bed` : ''}
        </div>
      </div>`).join('')}
    </div>
    ` : `
    <div class="info-grid" style="margin-top:14px">
      <div class="info-box">
        <div class="ib-lbl">Room</div>
        <div class="ib-val">${booking.room?.name || '—'}</div>
        <div class="ib-sub">${booking.rooms_booked || 1} room${(booking.rooms_booked || 1) > 1 ? 's' : ''}</div>
      </div>
      <div class="info-box">
        <div class="ib-lbl">Meal Plan</div>
        <div class="ib-val">${booking.meal_plan || '—'}</div>
        <div class="ib-sub">${mealLabel}</div>
      </div>
      <div class="info-box">
        <div class="ib-lbl">Guests</div>
        <div class="ib-val">${booking.adults || 1} Adult${(booking.adults || 1) > 1 ? 's' : ''}</div>
        <div class="ib-sub">
          ${Number(booking.children_below_5) > 0 ? booking.children_below_5 + ' child (0-5)' : ''}
          ${Number(booking.children_5_to_12) > 0 ? ' · ' + booking.children_5_to_12 + ' child (6-12)' : ''}
          ${Number(booking.extra_beds) > 0 ? ' · ' + booking.extra_beds + ' extra bed' : ''}
          ${!Number(booking.children_below_5) && !Number(booking.children_5_to_12) && !Number(booking.extra_beds) ? 'No children / extra beds' : ''}
        </div>
      </div>
      <div class="info-box">
        <div class="ib-lbl">Booking Source</div>
        <div class="ib-val">${(booking.booking_source || '').replace('_', ' ').toUpperCase()}</div>
      </div>
    </div>
    `}

    <!-- Tour Operator -->
    ${operator ? `
    <div class="op-box">
      <div class="op-lbl">Tour Operator</div>
      <div class="op-name">${operator.company_name}</div>
      <div class="op-detail">${operator.contact_person}${operator.phone ? ' · ' + operator.phone : ''}</div>
    </div>
    ` : ''}

    <!-- Payment -->
    <div class="payment ${booking.payment_status === 'advance_paid' ? 'partial' : booking.payment_status === 'pending' ? 'pending-pay' : ''}" style="margin-top:16px">
      <div class="pay-row">
        <span class="pay-total-lbl">Total Amount</span>
        <span class="pay-total">₹${total.toLocaleString()}</span>
      </div>
      <div class="pay-div"></div>
      ${advance > 0 ? `
      <div class="pay-row">
        <span class="pay-lbl">Advance Paid</span>
        <span class="pay-val" style="color:#34d399">₹${advance.toLocaleString()}</span>
      </div>` : ''}
      ${!isFullyPaid && balance > 0 ? `
      <div class="pay-row balance-row">
        <span class="pay-lbl">Balance Due</span>
        <span class="pay-val">₹${balance.toLocaleString()}</span>
      </div>
      <div style="font-size:10px;color:#f87171;margin-top:4px">⚠ Please pay balance before 7 days of check-in</div>
      ` : isFullyPaid ? `
      <div style="font-size:11px;color:#34d399;margin-top:4px">✓ All payments received. Nothing due.</div>
      ` : ''}
    </div>

    <!-- Transaction details -->
    ${(booking.payment_method || booking.transaction_number || booking.payment_date) ? `
    <div class="txn">
      <div class="txn-lbl">Payment Details</div>
      <div class="txn-grid">
        ${booking.payment_method ? `<div class="txn-item"><div class="tl">Mode</div><div class="tv">${booking.payment_method.replace('_',' ').toUpperCase()}</div></div>` : ''}
        ${booking.payment_date ? `<div class="txn-item"><div class="tl">Payment Date</div><div class="tv">${new Date(booking.payment_date).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div></div>` : ''}
        ${booking.transaction_number ? `<div class="txn-item"><div class="tl">Transaction No.</div><div class="tv">${booking.transaction_number}</div></div>` : ''}
        ${booking.advance_paid_at ? `<div class="txn-item"><div class="tl">Recorded At</div><div class="tv">${new Date(booking.advance_paid_at).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div></div>` : ''}
      </div>
    </div>` : ''}

    <!-- Policies -->
    <div class="policies">
      <div class="pol-title">Important Information</div>
      <div class="pol-item">Check-in: after 3:00 PM · Check-out: before 11:00 AM</div>
      <div class="pol-item">Valid government ID required at check-in</div>
      ${!isFullyPaid ? `<div class="pol-item" style="color:#f87171">Balance ₹${balance.toLocaleString()} due before 7 days of check-in</div>` : ''}
      <div class="pol-item">Cancellation charges apply as per reservation policy</div>
      <div class="pol-item">Breakfast served 8–10 AM · Kitchen closes 10 PM</div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-resort">
        <div class="fr-name">LeafWalk Resort</div>
        <div class="fr-detail">
          ${RESORT.address}, ${RESORT.city}<br>
          <span class="hl">${RESORT.phone}</span><br>
          ${RESORT.email} · ${RESORT.website}
        </div>
      </div>
    </div>

  </div>
  <div class="bottom-bar"></div>
</div>

<script>
window.onload = function() {
  document.title = 'Receipt-${bookingNo}';
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() { setTimeout(function(){ window.print(); }, 400) })
  } else {
    setTimeout(function(){ window.print(); }, 1200)
  }
}
<\/script>
</body></html>`

  const win = window.open('', '_blank', 'width=520,height=800,toolbar=0,menubar=0')
  if (!win) { alert('Pop-up blocked! Please allow pop-ups and try again.'); return }
  win.document.write(html)
  win.document.close()
}
