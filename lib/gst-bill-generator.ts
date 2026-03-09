// lib/gst-bill-generator.ts - HTML Print-based GST Invoice

const RESORT = {
  name: 'LeafWalk Resort',
  gstin: '05AADFL1234R1Z5', // Replace with actual
  pan: 'AADFL1234R',
  address: 'Vill- Banas, Narad Chatti, Hanuman Chatti',
  city: 'Yamunotri Road, Uttarkashi',
  state: 'Uttarakhand - 249193',
  phone: '+91-9368080535, +91-8630227541',
  email: 'info@leafwalk.in',
  website: 'www.leafwalk.in',
  sacCode: '996311',
}

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only (EP)', CP: 'Room + Breakfast (CP)',
  MAP: 'Room + Breakfast + Dinner (MAP)', AP: 'All Meals Included (AP)',
}

function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '')
  }
  const n = Math.round(amount)
  return n === 0 ? 'Zero' : convert(n)
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function generateGSTBill(booking: any): void {
  const checkIn = new Date(booking.check_in).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const checkOut = new Date(booking.check_out).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const billDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const mealLabel = MEAL_LABELS[booking.meal_plan] || booking.meal_plan || '—'

  const isIntraState = !booking.guest_state || booking.booking_source === 'walk_in' ||
    (booking.guest_state || '').toLowerCase().includes('uttarakhand')

  const operator = booking.tour_operator || null
  const nights = Number(booking.nights || 0)
  const invoiceNo = booking.booking_number || ('LW-INV-' + (booking.id || '').slice(0, 6).toUpperCase())

  // Line items
  const items: { desc: string; rate: number; qty: number; nights: number; amount: number }[] = []
  const roomRate = Number(booking.rate_per_room_per_night || 0)
  const roomQty = Number(booking.rooms_booked || 1)
  if (roomRate > 0) items.push({ desc: `${booking.room?.name || 'Room'} — ${mealLabel}`, rate: roomRate, qty: roomQty, nights, amount: roomRate * roomQty * nights })
  if (Number(booking.extra_beds) > 0 && Number(booking.extra_bed_rate_per_night) > 0) {
    const r = Number(booking.extra_bed_rate_per_night), q = Number(booking.extra_beds)
    items.push({ desc: `Extra Bed — ${mealLabel}`, rate: r, qty: q, nights, amount: r * q * nights })
  }
  if (Number(booking.children_5_to_12) > 0 && Number(booking.child_rate_per_night) > 0) {
    const r = Number(booking.child_rate_per_night), q = Number(booking.children_5_to_12)
    items.push({ desc: `Child (6-12 yrs) — ${mealLabel}`, rate: r, qty: q, nights, amount: r * q * nights })
  }

  const subtotal = Number(booking.subtotal || 0)
  const cgst = Number(booking.cgst || 0)
  const sgst = Number(booking.sgst || 0)
  const igst = cgst + sgst
  const total = Number(booking.total_amount || 0)
  const advance = Number(booking.advance_amount || 0)
  const rawBalance = Number(booking.balance_amount || 0)
  // Balance due sirf tab show karo jab actually pending ho
  const isFullyPaid = booking.payment_status === 'fully_paid'
  const balance = isFullyPaid ? 0 : rawBalance

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>LeafWalk Invoice ${invoiceNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,Helvetica,sans-serif;background:#f0f0f0;color:#1a1a1a;font-size:13px}
  .page{width:210mm;min-height:297mm;margin:10px auto;background:#fff;box-shadow:0 4px 30px rgba(0,0,0,0.15);position:relative;overflow:hidden}

  /* Header */
  .hdr{background:linear-gradient(135deg,#0a0a0a 0%,#151208 50%,#1e1a0a 100%);padding:24px 32px 20px;display:flex;align-items:center;gap:18px;position:relative;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hdr::before{content:'';position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(201,161,74,.12) 0%,transparent 70%);border-radius:50%}
  .logo-wrap{width:58px;height:58px;border:2px solid rgba(201,161,74,.7);border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(201,161,74,.08);flex-shrink:0}
  .logo-emoji{font-size:24px}
  .rinfo{flex:1}
  .rname{font-family:'Playfair Display','Georgia',serif;font-size:24px;font-weight:700;color:#c9a14a;letter-spacing:2px;line-height:1}
  .rtag{color:#8b6914;font-size:9px;letter-spacing:3px;text-transform:uppercase;margin-top:3px}
  .rcontact{color:#777;font-size:10px;margin-top:7px;line-height:1.8}
  .rcontact .hl{color:#c9a14a;font-weight:500}
  .inv-badge{background:rgba(201,161,74,.12);border:1px solid rgba(201,161,74,.35);border-radius:8px;padding:12px 16px;text-align:center;flex-shrink:0;min-width:130px}
  .inv-badge-lbl{color:#8b6914;font-size:8px;letter-spacing:2px;text-transform:uppercase;font-weight:600}
  .inv-badge-no{color:#fff;font-size:13px;font-weight:700;margin-top:4px;font-family:'Playfair Display',serif}
  .inv-badge-dt{color:#666;font-size:10px;margin-top:3px}

  /* Gold bar */
  .gbar{height:3px;background:linear-gradient(90deg,#6b4f10,#c9a14a,#e6c87a,#c9a14a,#6b4f10)}

  /* Meta row */
  .meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #ebebeb}
  .meta-cell{padding:13px 32px;border-right:1px solid #ebebeb}
  .meta-cell:last-child{border-right:none}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .ml{font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:#aaa;font-weight:600;margin-bottom:2px}
  .mv{font-size:12.5px;color:#1a1a1a;font-weight:600}

  /* Party */
  .party{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #ebebeb}
  .party-cell{padding:14px 32px;border-right:1px solid #ebebeb}
  .party-cell:last-child{border-right:none}
  .ph{font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:#c9a14a;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #f5ecd5}
  .pn{font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px}
  .pd{color:#555;font-size:11.5px;line-height:1.75}
  .pgst{margin-top:7px;padding:5px 10px;background:#fffbf0;border:1px solid #f0e0a0;border-radius:4px;font-size:10.5px;color:#7a5a08;font-weight:500}

  /* Stay bar */
  .sbar{background:#fafafa;border-bottom:1px solid #ebebeb;padding:11px 32px;display:flex;gap:0;align-items:stretch}
  .si{flex:1;text-align:center;padding:0 12px;border-right:1px solid #e5e5e5}
  .si:last-child{border-right:none}
  .sil{font-size:8px;color:#aaa;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
  .siv{font-size:12.5px;color:#1a1a1a;font-weight:600}

  /* Table */
  .tbl-wrap{padding:18px 32px 10px}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#0a0a0a;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  thead th{padding:9px 10px;color:#c9a14a;font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:600;text-align:left}
  thead th.right{text-align:right}
  thead th.center{text-align:center}
  tbody tr{border-bottom:1px solid #f2f2f2}
  tbody tr:last-child{border-bottom:2px solid #e0e0e0}
  tbody td{padding:10px 10px;color:#333;font-size:12px;vertical-align:top}
  td.right{text-align:right;font-weight:500}
  td.center{text-align:center}
  .idesc{font-weight:600;color:#1a1a1a}
  .isub{font-size:10px;color:#999;margin-top:2px}

  /* Totals */
  .totals-wrap{padding:8px 32px 18px;display:flex;gap:18px;align-items:flex-start}
  .awords{flex:1;background:#fffcf0;border:1px solid #f0e0a0;border-radius:8px;padding:13px 15px}
  .awl{font-size:8.5px;color:#8b6914;letter-spacing:1px;text-transform:uppercase;font-weight:600;margin-bottom:4px}
  .awt{font-size:12px;color:#5a4010;font-style:italic;line-height:1.6}
  .ttbl{width:210px;flex-shrink:0}
  .ttbl td{padding:5px 0;font-size:12px;color:#444}
  .ttbl td.amt{text-align:right;font-weight:500}
  .ttbl tr.trow td{font-size:14px;font-weight:700;color:#c9a14a;padding-top:9px;border-top:2px solid #c9a14a}
  .ttbl tr.brow td{color:#c0392b;font-weight:600}

  /* Footer */
  .ftr{margin:0 32px;border-top:1px solid #ebebeb;padding:14px 0 16px;display:flex;gap:18px;align-items:flex-end}
  .terms{flex:1}
  .tml{font-size:8.5px;color:#aaa;letter-spacing:1px;text-transform:uppercase;font-weight:600;margin-bottom:6px}
  .terms ol{padding-left:14px;color:#777;font-size:10.5px;line-height:1.9}
  .sig{text-align:center;min-width:130px}
  .sig-co{font-size:11px;font-weight:700;color:#1a1a1a;margin-bottom:22px;font-family:'Playfair Display',serif}
  .sig-line{width:110px;border-top:1px solid #555;margin:0 auto 5px;padding-top:4px}
  .sig-lbl{font-size:10px;color:#666}

  /* Tag */
  .tag-paid{display:inline-block;background:#27ae60;color:#fff;font-size:8.5px;padding:2px 8px;border-radius:3px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-left:6px;vertical-align:middle}
  .tag-partial{display:inline-block;background:#e67e22;color:#fff;font-size:8.5px;padding:2px 8px;border-radius:3px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-left:6px;vertical-align:middle}

  /* Watermark */
  .wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:90px;color:rgba(201,161,74,0.035);font-family:'Playfair Display',serif;font-weight:700;pointer-events:none;white-space:nowrap;z-index:0}

  @media print{
    body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{box-shadow:none;width:100%;margin:0;min-height:auto}
    @page{margin:8mm 10mm;size:A4}
    .wm{display:none}
  }
</style>
</head>
<body>
<div class="page">
<div class="wm">LeafWalk Resort</div>

<!-- HEADER -->
<div class="hdr">
  <div class="logo-wrap"><span class="logo-emoji">🌿</span></div>
  <div class="rinfo">
    <div class="rname">LEAFWALK RESORT</div>
    <div class="rtag">Stay in Lap of Nature</div>
    <div class="rcontact">
      ${RESORT.address}, ${RESORT.city}, ${RESORT.state}<br>
      📞 ${RESORT.phone} &nbsp;|&nbsp; ✉ ${RESORT.email} &nbsp;|&nbsp; 🌐 ${RESORT.website}<br>
      <span class="hl">GSTIN: ${RESORT.gstin}</span> &nbsp;|&nbsp; PAN: ${RESORT.pan} &nbsp;|&nbsp; SAC: ${RESORT.sacCode}
    </div>
  </div>
  <div class="inv-badge">
    <div class="inv-badge-lbl">Tax Invoice</div>
    <div class="inv-badge-no">${invoiceNo}</div>
    <div class="inv-badge-dt">${billDate}</div>
  </div>
</div>
<div class="gbar"></div>

<!-- META -->
<div class="meta">
  <div class="meta-cell">
    <div class="meta-grid">
      <div><div class="ml">Invoice No</div><div class="mv">${invoiceNo}</div></div>
      <div><div class="ml">Date</div><div class="mv">${billDate}</div></div>
      <div><div class="ml">Payment Mode</div><div class="mv">${(booking.payment_method || 'Cash').toUpperCase().replace('_',' ')}</div></div>
      <div><div class="ml">Tax Type</div><div class="mv" style="font-size:11px">${isIntraState ? 'CGST + SGST' : 'IGST'}</div></div>
    </div>
  </div>
  <div class="meta-cell">
    <div class="meta-grid">
      <div><div class="ml">Booking Ref</div><div class="mv">${booking.booking_number || '—'}</div></div>
      <div><div class="ml">Source</div><div class="mv" style="font-size:11px">${(booking.booking_source || '').replace('_',' ').toUpperCase()}</div></div>
      <div>
        <div class="ml">Status</div>
        <div class="mv">
          ${booking.payment_status === 'fully_paid'
            ? '<span class="tag-paid">Fully Paid</span>'
            : booking.payment_status === 'advance_paid'
            ? '<span class="tag-partial">Advance Paid</span>'
            : (booking.payment_status || '').replace('_',' ')}
        </div>
      </div>
      ${operator ? `<div><div class="ml">Commission</div><div class="mv" style="color:#c9a14a">${operator.commission_rate || 0}%</div></div>` : ''}
    </div>
  </div>
</div>

<!-- PARTY -->
<div class="party">
  <div class="party-cell">
    <div class="ph">Bill To — Guest Details</div>
    <div class="pn">${booking.guest_name}</div>
    <div class="pd">
      ${booking.guest_phone ? '📞 ' + booking.guest_phone + '<br>' : ''}
      ${booking.guest_email ? '✉ ' + booking.guest_email + '<br>' : ''}
      ${booking.guest_id_type ? '🪪 ' + booking.guest_id_type.replace('_',' ').toUpperCase() + ': ' + (booking.guest_id_number || '—') : ''}
    </div>
  </div>
  <div class="party-cell">
    ${operator ? `
    <div class="ph">Tour Operator Details</div>
    <div class="pn">${operator.company_name}</div>
    <div class="pd">
      ${operator.contact_person ? 'Attn: ' + operator.contact_person + '<br>' : ''}
      ${operator.address ? operator.address + (operator.city ? ', ' + operator.city : '') + (operator.state ? ', ' + operator.state : '') + '<br>' : ''}
      ${operator.phone ? '📞 ' + operator.phone + '<br>' : ''}
      ${operator.email ? '✉ ' + operator.email : ''}
    </div>
    ${operator.gst_number ? `<div class="pgst">GSTIN: ${operator.gst_number}${operator.pan_number ? ' &nbsp;|&nbsp; PAN: ' + operator.pan_number : ''}</div>` : ''}
    ` : `
    <div class="ph">Stay Information</div>
    <div class="pd" style="margin-top:6px">
      <strong>Room:</strong> ${booking.room?.name || '—'}<br>
      <strong>Meal Plan:</strong> ${mealLabel}<br>
      <strong>Guests:</strong> ${booking.adults || 1} Adult${Number(booking.adults || 1) > 1 ? 's' : ''}
      ${Number(booking.children_below_5) > 0 ? ', ' + booking.children_below_5 + ' Child (0-5, complimentary)' : ''}
      ${Number(booking.children_5_to_12) > 0 ? ', ' + booking.children_5_to_12 + ' Child (6-12)' : ''}
      ${Number(booking.extra_beds) > 0 ? ', ' + booking.extra_beds + ' Extra Bed' : ''}
    </div>
    `}
  </div>
</div>

<!-- STAY BAR -->
<div class="sbar">
  <div class="si"><div class="sil">Check-in</div><div class="siv">${checkIn}</div></div>
  <div class="si"><div class="sil">Check-out</div><div class="siv">${checkOut}</div></div>
  <div class="si"><div class="sil">Nights</div><div class="siv">${nights}</div></div>
  <div class="si"><div class="sil">Rooms</div><div class="siv">${booking.rooms_booked || 1}</div></div>
  <div class="si"><div class="sil">Room Type</div><div class="siv">${booking.room?.name || '—'}</div></div>
  <div class="si"><div class="sil">Meal Plan</div><div class="siv">${booking.meal_plan || '—'}</div></div>
</div>

<!-- TABLE -->
<div class="tbl-wrap">
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th>Description of Services</th>
        <th class="right" style="width:85px">Rate/Night</th>
        <th class="center" style="width:45px">Qty</th>
        <th class="center" style="width:50px">Nights</th>
        <th class="right" style="width:90px">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, i) => `
      <tr>
        <td style="color:#bbb;font-size:11px">${i + 1}</td>
        <td>
          <div class="idesc">${item.desc}</div>
          <div class="isub">SAC: ${RESORT.sacCode} &nbsp;·&nbsp; Hotel Accommodation Services &nbsp;·&nbsp; GST: 18%</div>
        </td>
        <td class="right">₹${fmt(item.rate)}</td>
        <td class="center">${item.qty}</td>
        <td class="center">${item.nights}</td>
        <td class="right">₹${fmt(item.amount)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<!-- TOTALS -->
<div class="totals-wrap">
  <div class="awords">
    <div class="awl">Amount in Words</div>
    <div class="awt">
      <strong>${numberToWords(Math.round(total))} Rupees Only</strong>
      ${advance > 0 ? `<br><span style="font-size:11px;color:#888;">Advance: ${numberToWords(Math.round(advance))} Rupees</span>` : ''}
      ${(!isFullyPaid && balance > 0) ? `<br><span style="color:#c0392b;">Balance Due: ${numberToWords(Math.round(balance))} Rupees</span>` : ''}
    </div>
  </div>
  <table class="ttbl">
    <tr><td>Taxable Amount</td><td class="amt">₹${fmt(subtotal)}</td></tr>
    ${isIntraState
      ? `<tr><td>CGST @ 9%</td><td class="amt">₹${fmt(cgst)}</td></tr><tr><td>SGST @ 9%</td><td class="amt">₹${fmt(sgst)}</td></tr>`
      : `<tr><td>IGST @ 18%</td><td class="amt">₹${fmt(igst)}</td></tr>`}
    <tr class="trow"><td>Total Amount</td><td class="amt">₹${fmt(total)}</td></tr>
    ${advance > 0 ? `<tr><td style="color:#666">Advance Received</td><td class="amt">₹${fmt(advance)}</td></tr>` : ''}
    ${(!isFullyPaid && balance > 0) ? `<tr class="brow"><td>Balance Due</td><td class="amt">₹${fmt(balance)}</td></tr>` : (isFullyPaid ? `<tr><td style="color:#27ae60;font-weight:600">✓ Fully Settled</td><td class="amt" style="color:#27ae60">₹0.00</td></tr>` : '')}
  </table>
</div>

<!-- FOOTER -->
<div class="ftr">
  <div class="terms">
    <div class="tml">Terms & Conditions</div>
    <ol>
      <li>This is a system generated invoice — valid without physical signature.</li>
      <li>Subject to Uttarkashi jurisdiction only.</li>
      <li>Check-in: after 3:00 PM &nbsp;|&nbsp; Check-out: before 11:00 AM</li>
      <li>Cancellation charges applicable as per reservation policy.</li>
      <li>Tax: ${isIntraState ? 'CGST 9% + SGST 9% (Intra-State — Uttarakhand)' : 'IGST 18% (Inter-State)'} &nbsp;|&nbsp; SAC: ${RESORT.sacCode}</li>
    </ol>
  </div>
  <div class="sig">
    <div class="sig-co">For LeafWalk Resort</div>
    <div class="sig-line"></div>
    <div class="sig-lbl">Authorized Signatory</div>
  </div>
</div>
<div class="gbar" style="margin-top:10px"></div>
</div>

<script>
window.onload = function() {
  document.title = 'LeafWalk-Invoice-${invoiceNo}';
  // Wait for fonts to load before printing
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() {
      setTimeout(function(){ window.print(); }, 400);
    });
  } else {
    setTimeout(function(){ window.print(); }, 1200);
  }
}
<\/script>
</body></html>`

  const win = window.open('', '_blank', 'width=960,height=800,toolbar=0,menubar=0')
  if (!win) { alert('Pop-up blocked! Please allow pop-ups for this site and try again.'); return }
  win.document.write(html)
  win.document.close()
}