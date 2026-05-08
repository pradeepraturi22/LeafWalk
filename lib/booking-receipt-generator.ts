// lib/booking-receipt-generator.ts
// A4 single-page professional receipt — auto prints on open


import { formatDate } from '@/lib/utils'
import { getInvoicePartyMeta } from '@/lib/invoice-party'
import { calculateGST, calculateGSTFromSubtotal } from '@/lib/gst-bill-service'

const RESORT = {
  name:    'LeafWalk Resort',
  tagline: 'Stay in Lap of Nature',
  address: 'Vill- Banas, Narad Chatti, Hanuman Chatti',
  city:    'Yamunotri Road, Uttarkashi, Uttarakhand - 249193',
  phone:   '+91-9368080535 | +91-8630227541',
  email:   'info@leafwalk.in',
  website: 'www.leafwalk.in',
  gstin:   '05AADFL1234R1Z5',
  sacCode: '996311',
}


const LOGO_DATA_URL = 'data:image/jpeg;base64,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'

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only (EP)', CP: 'With Breakfast (CP)',
  MAP: 'Breakfast + Dinner (MAP)', AP: 'All Meals (AP)',
}

const BOOKING_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  confirmed:   { color: '#166534', bg: '#dcfce7', label: 'CONFIRMED' },
  hold:        { color: '#92400e', bg: '#fef3c7', label: 'ON HOLD' },
  checked_in:  { color: '#1e40af', bg: '#dbeafe', label: 'CHECKED IN' },
  checked_out: { color: '#6b21a8', bg: '#f3e8ff', label: 'CHECKED OUT' },
  pending:     { color: '#92400e', bg: '#fef3c7', label: 'PENDING' },
  cancelled:   { color: '#991b1b', bg: '#fee2e2', label: 'CANCELLED' },
}

const PAY_STATUS: Record<string, { color: string; bg: string; label: string }> = {
  fully_paid:   { color: '#166534', bg: '#dcfce7', label: '✓ Fully Paid' },
  payment_processing: { color: '#92400e', bg: '#fef3c7', label: 'Advance Paid' },
  advance_paid: { color: '#92400e', bg: '#fef3c7', label: '◑ Advance Paid' },
  pending:      { color: '#991b1b', bg: '#fee2e2', label: '○ Payment Pending' },
}

export function buildBookingReceiptHtml(
  booking: any,
  options: { includePrintTools?: boolean; documentMode?: 'receipt' | 'check_in_pass' } = {}
): string {
  const includePrintTools = options.includePrintTools !== false
  const isCheckInPass = options.documentMode === 'check_in_pass'
  const fmt = (d: string) => formatDate(d)
  const fmtLong = (d: string) => formatDate(d)
  const fmtPassDate = (d: string) => {
    const value = new Date(d)
    if (Number.isNaN(value.getTime())) return d || '—'
    const day = String(value.getDate()).padStart(2, '0')
    const month = value.toLocaleString('en-GB', { month: 'short' })
    const year = value.getFullYear()
    return `${day}-${month}-${year}`
  }
  const curr = (n: number) => '₹' + n.toLocaleString('en-IN')

  const checkIn   = isCheckInPass ? fmtPassDate(booking.check_in) : fmtLong(booking.check_in)
  const checkOut  = isCheckInPass ? fmtPassDate(booking.check_out) : fmtLong(booking.check_out)
  const issuedOn  = fmt(booking.created_at || new Date().toISOString())
  const mealLabel = MEAL_LABELS[booking.meal_plan] || booking.meal_plan || '—'
  const bSt  = BOOKING_STATUS[booking.booking_status] || BOOKING_STATUS.pending
  const pSt  = PAY_STATUS[booking.payment_status]     || PAY_STATUS.pending
  const passSt = String(booking.booking_status || '').toLowerCase() === 'hold' ? BOOKING_STATUS.hold : pSt
  const nights  = Number(booking.nights || 0)
  const total   = Number(booking.total_amount  || 0)
  const advance = Number(booking.advance_amount || 0)
  const balance = Number(booking.balance_amount || 0)
  const isFullyPaid = booking.payment_status === 'fully_paid'
  const showSacCode = isFullyPaid && !isCheckInPass
  const operator    = isCheckInPass ? null : booking.tour_operator || null
  const bookingNo   = booking.booking_number || (booking.id || '').slice(0, 8).toUpperCase()
  const invoiceNo   = booking.invoice_number || `INV-${bookingNo}`
  const docTitle    = isCheckInPass ? 'Check In Pass' : isFullyPaid ? 'GST Tax Invoice' : 'Booking Receipt'
  const storedSubtotal = Number(booking.subtotal || 0)
  const gstMath = total > 0
    ? calculateGST(total)
    : calculateGSTFromSubtotal(storedSubtotal)
  const taxable = gstMath.subtotal
  const cgst = gstMath.cgst
  const sgst = gstMath.sgst
  const roomItems   = booking.room_items || []
  const hasMulti    = roomItems.length > 1
  const invoiceParty = getInvoicePartyMeta(booking)

  /* ── room detail rows ─────────────────────────────────── */
  const roomRows = hasMulti
    ? roomItems.map((item: any) => `
        <tr>
          <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6">
            <div style="font-weight:600;color:#111;font-size:13px">${item.room?.name || '—'}</div>
            <div style="color:#6b7280;font-size:11px;margin-top:2px">
              ${item.rooms_booked} room × ${nights} nights · ${MEAL_LABELS[item.meal_plan] || item.meal_plan}
              · ${item.adults} Adult${item.adults > 1 ? 's' : ''}
              ${item.children_5_to_12 > 0 ? ` · ${item.children_5_to_12} Child (6-12)` : ''}
              ${item.extra_beds > 0 ? ` · ${item.extra_beds} Extra Bed` : ''}
            </div>
          </td>
          ${showSacCode ? `<td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111;font-size:12px;white-space:nowrap">${RESORT.sacCode}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111;font-size:13px;white-space:nowrap">
            ${curr(Number(item.line_total || 0))}
          </td>` : ''}
        </tr>`).join('')
    : `<tr>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6">
          <div style="font-weight:600;color:#111;font-size:13px">${booking.room?.name || '—'}</div>
          <div style="color:#6b7280;font-size:11px;margin-top:2px">
            ${booking.rooms_booked || 1} room × ${nights} nights · ${mealLabel}
            · ${booking.adults || 1} Adult${(booking.adults || 1) > 1 ? 's' : ''}
            ${Number(booking.children_5_to_12) > 0 ? ` · ${booking.children_5_to_12} Child (6-12)` : ''}
            ${Number(booking.extra_beds) > 0 ? ` · ${booking.extra_beds} Extra Bed` : ''}
          </div>
        </td>
        ${showSacCode ? `<td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111;font-size:12px;white-space:nowrap">${RESORT.sacCode}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#111;font-size:13px;white-space:nowrap">
          ${curr(total)}
        </td>` : ''}
      </tr>`

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${docTitle} - ${isCheckInPass ? bookingNo : isFullyPaid ? invoiceNo : bookingNo}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box }
  html, body { width:210mm; background:#e5e7eb }

  .page {
    width: 210mm;
    min-height: 297mm;
    background: #fff;
    margin: 0 auto;
    font-family: 'DM Sans', sans-serif;
    font-size: 12.5px;
    color: #374151;
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ── TOP BAND ── */
  .top-band {
    background: #0f1c0f;
    padding: 20px 32px 17px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
  }
  .brand-lockup {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  .logo-badge {
    width: 62px;
    height: 62px;
    border-radius: 999px;
    background: #fff;
    border: 2px solid rgba(201,161,74,0.78);
    box-shadow: 0 8px 24px rgba(0,0,0,0.22), inset 0 0 0 4px #fff;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
  }
  .logo-badge img {
    width: 50px;
    height: 50px;
    object-fit: contain;
    display: block;
  }
  .brand-copy { min-width: 0 }
  .resort-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 29px;
    font-weight: 700;
    color: #c9a14a;
    letter-spacing: 0.9px;
    line-height: 1;
    white-space: nowrap;
  }
  .resort-tag {
    color: #d6c084;
    font-size: 9.2px;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 8px;
    white-space: nowrap;
  }
  .resort-contact {
    text-align: right;
    font-size: 10px;
    color: #d1d5db;
    line-height: 1.65;
    max-width: 265px;
    flex: 0 0 auto;
  }
  .resort-contact .hi { color: #c9a14a }

  /* ── GOLD LINE ── */
  .gold-line {
    height: 3px;
    background: linear-gradient(90deg, #5a3c0a, #c9a14a, #e6c87a, #c9a14a, #5a3c0a);
  }

  /* ── RECEIPT TITLE BAR ── */
  .title-bar {
    background: #f9f9f7;
    padding: 13px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e5e7eb;
  }
  .title-bar .doc-type {
    font-family: 'Cormorant Garamond', serif;
    font-size: 23px;
    font-weight: 700;
    color: #111;
    letter-spacing: 0.5px;
  }
  .title-bar .doc-meta {
    text-align: right;
    font-size: 11px;
    color: #6b7280;
    line-height: 1.45;
    width: 300px;
    flex: 0 0 300px;
  }
  .title-bar .doc-meta strong { color: #111 }
  .meta-row {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr);
    gap: 8px;
    align-items: baseline;
    margin: 2px 0;
  }
  .meta-row span:first-child {
    color: #6b7280;
    white-space: nowrap;
  }
  .meta-row strong {
    color: #111;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  /* ── BADGES ── */
  .badges {
    padding: 10px 32px;
    display: flex;
    gap: 8px;
    background: #fff;
    border-bottom: 1px solid #f3f4f6;
    flex-wrap: wrap;
  }
  .badge {
    padding: 3px 12px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  /* ── MAIN BODY ── */
  .body {
    padding: 20px 32px 14px;
    flex: 1;
  }

  /* ── GUEST + DATES ROW ── */
  .top-row {
    display: flex;
    gap: 20px;
    margin-bottom: 18px;
    align-items: flex-start;
  }
  .guest-block { flex: 1 }
  .guest-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 700;
    color: #111;
    line-height: 1.1;
  }
  .guest-contact {
    color: #6b7280;
    font-size: 11px;
    margin-top: 5px;
    line-height: 1.7;
  }

  /* ── DATES BOX ── */
  .dates-box {
    display: flex;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: #fff;
  }
  .date-cell {
    padding: 10px 16px;
    text-align: center;
    min-width: 120px;
  }
  .date-cell + .date-cell { border-left: 1px solid #e5e7eb }
  .dc-label {
    font-size: 9px;
    color: #9ca3af;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 3px;
  }
  .dc-val {
    font-size: 12px;
    font-weight: 600;
    color: #111;
    line-height: 1.3;
  }
  .dc-note { font-size: 10px; color: #9ca3af; margin-top: 2px }
  .nights-cell {
    background: #0f1c0f;
    padding: 10px 14px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 72px;
  }
  .nights-num {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px;
    font-weight: 700;
    color: #c9a14a;
    line-height: 1;
  }
  .nights-lbl { font-size: 9px; color: #6b7c4a; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px }

  /* ── TABLE ── */
  .section-label {
    font-size: 9.5px;
    color: #9ca3af;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 6px;
    font-weight: 500;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  thead { background: #f9f9f7 }
  thead th {
    padding: 8px 12px;
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    letter-spacing: 1px;
    text-transform: uppercase;
    border-bottom: 1px solid #e5e7eb;
    text-align: left;
  }
  thead th:last-child { text-align: right }

  /* ── PAYMENT SUMMARY ── */
  .pay-box {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .pay-header {
    background: #f9f9f7;
    padding: 8px 14px;
    font-size: 10px;
    font-weight: 600;
    color: #6b7280;
    letter-spacing: 1px;
    text-transform: uppercase;
    border-bottom: 1px solid #e5e7eb;
  }
  .pay-body { padding: 0 }
  .pay-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 9px 14px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 12.5px;
  }
  .pay-row:last-child { border-bottom: none }
  .pay-row.total-row {
    background: #0f1c0f;
    padding: 11px 14px;
  }
  .pay-row.total-row .label { color: #9ca3af; font-weight: 500 }
  .pay-row.total-row .value {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 700;
    color: #c9a14a;
  }
  .pay-row.balance-row .label { color: #dc2626; font-weight: 600 }
  .pay-row.balance-row .value { color: #dc2626; font-weight: 700 }
  .pay-row.paid-row .value { color: #16a34a; font-weight: 600 }

  /* ── TWO COL ── */
  .two-col {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    align-items: flex-start;
    page-break-inside: avoid;
  }
  .two-col > * { flex: 1 }

  /* ── INFO BOX ── */
  .info-box {
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    overflow: hidden;
  }
  .welcome-box {
    border: 1px solid #e8dcc2;
    border-radius: 12px;
    background: linear-gradient(135deg, #faf7f1 0%, #fffdf8 100%);
    padding: 14px 16px;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .welcome-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 22px;
    font-weight: 700;
    color: #111;
    margin-bottom: 4px;
  }
  .welcome-copy {
    font-size: 11px;
    color: #6b7280;
    line-height: 1.7;
  }
  .ib-header {
    background: #f9f9f7;
    padding: 7px 12px;
    font-size: 9.5px;
    font-weight: 600;
    color: #6b7280;
    letter-spacing: 1px;
    text-transform: uppercase;
    border-bottom: 1px solid #e5e7eb;
  }
  .ib-body { padding: 10px 12px }
  .ib-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 11.5px }
  .ib-row .k { color: #6b7280 }
  .ib-row .v {
    font-weight: 500;
    color: #111;
    text-align: right;
    overflow-wrap: anywhere;
    word-break: break-word;
    max-width: 62%;
  }

  /* ── POLICIES ── */
  .policies {
    background: #f9f9f7;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 16px;
    page-break-inside: avoid;
  }
  .pol-title {
    font-size: 9.5px;
    font-weight: 600;
    color: #6b7280;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 7px;
  }
  .pol-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 18px;
  }
  .pol-item {
    font-size: 10px;
    color: #6b7280;
    padding-left: 12px;
    position: relative;
    line-height: 1.55;
  }
  .pol-item::before { content: '·'; position: absolute; left: 0; color: #c9a14a }

  /* ── FOOTER ── */
  .footer {
    border-top: 1px solid #e5e7eb;
    padding: 11px 32px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f9f9f7;
    margin-top: auto;
    gap: 20px;
  }
  .footer-left {
    font-size: 9.5px;
    color: #9ca3af;
    line-height: 1.55;
    min-width: 0;
  }
  .footer-right {
    text-align: right;
    font-size: 9.5px;
    color: #9ca3af;
    line-height: 1.55;
    flex: 0 0 auto;
  }
  .footer-brand {
    font-family: 'Cormorant Garamond', serif;
    font-size: 15px;
    font-weight: 700;
    color: #c9a14a;
    margin-bottom: 2px;
  }

  /* ── PRINT ── */
  @media print {
    .print-tools { display:none !important }
    html, body { background: #fff; width: auto }
    .page { width: 210mm; min-height: 297mm; margin: 0; padding: 0 }
    @page { size: A4; margin: 0 }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact }
  }
</style>
</head>
<body>
${includePrintTools ? `<div class="print-tools" style="position:fixed;right:18px;top:18px;z-index:9999;display:flex;gap:8px">
  <button onclick="window.print()" style="border:0;border-radius:999px;background:#c9a14a;color:#111;font-weight:700;padding:10px 16px;box-shadow:0 8px 24px rgba(0,0,0,.18);cursor:pointer">Print / Save PDF</button>
  <button onclick="window.close()" style="border:1px solid #ddd;border-radius:999px;background:#fff;color:#333;font-weight:600;padding:10px 14px;box-shadow:0 8px 24px rgba(0,0,0,.12);cursor:pointer">Close</button>
</div>` : ''}
<div class="page">

  <!-- Top band -->
  <div class="top-band">
    <div class="brand-lockup">
      <div class="logo-badge">
        <img src="${LOGO_DATA_URL}" alt="LeafWalk Resort">
      </div>
      <div class="brand-copy">
        <div class="resort-name">LeafWalk Resort</div>
        <div class="resort-tag">Stay in Lap of Nature · Uttarkashi, Uttarakhand</div>
      </div>
    </div>
    <div class="resort-contact">
      <div class="hi">${RESORT.phone}</div>
      <div>${RESORT.email}</div>
      <div>${RESORT.website}</div>
      ${!isCheckInPass && RESORT.gstin ? `<div>GSTIN: ${RESORT.gstin}</div>` : ''}
    </div>
  </div>
  <div class="gold-line"></div>

  <!-- Title bar -->
  <div class="title-bar">
    <div class="doc-type">${docTitle}</div>
    <div class="doc-meta">
      ${!isCheckInPass && isFullyPaid ? `<div class="meta-row"><span>Invoice No</span><strong>${invoiceNo}</strong></div>` : ''}
      <div class="meta-row"><span>Booking Ref</span><strong>${bookingNo}</strong></div>
      <div class="meta-row"><span>Issued</span><strong>${issuedOn}</strong></div>
      ${booking.booking_source ? `<div class="meta-row"><span>Source</span><strong>${booking.booking_source.replace('_',' ').toUpperCase()}</strong></div>` : ''}
    </div>
  </div>

  <!-- Badges -->
  <div class="badges">
    <span class="badge" style="background:${bSt.bg};color:${bSt.color}">${bSt.label}</span>
    ${isCheckInPass ? `<span class="badge" style="background:${passSt.bg};color:${passSt.color}">${passSt.label}</span>` : `<span class="badge" style="background:${pSt.bg};color:${pSt.color}">${pSt.label}</span>`}
    ${operator ? '<span class="badge" style="background:#ede9fe;color:#6d28d9">B2B · TOUR OPERATOR</span>' : ''}
  </div>

  <!-- Body -->
  <div class="body">

    <!-- Guest + Dates -->
    <div class="top-row">
      <div class="guest-block">
        <div class="guest-name">${invoiceParty.name || '—'}</div>
        <div class="guest-contact">
          ${booking.guest_phone ? `📞 ${booking.guest_phone}` : ''}
          ${booking.guest_email ? `<br>✉ ${booking.guest_email}` : ''}
          ${(() => {
            const parts = [
              booking.guest_address,
              booking.guest_district,
              booking.guest_state,
              booking.guest_country && booking.guest_country !== 'India' ? booking.guest_country : null,
            ].filter(Boolean)
            return parts.length ? `<br>📍 ${parts.join(', ')}` : ''
          })()}
          ${booking.guest_id_type && booking.guest_id_number ? `<br>🪪 ${booking.guest_id_type.replace(/_/g,' ')}: ${booking.guest_id_number}` : ''}
          ${!isCheckInPass && isFullyPaid && booking.gst_invoice_requested && invoiceParty.gstNumber ? `<br>GSTIN: ${invoiceParty.gstNumber}` : ''}
          ${!isCheckInPass && isFullyPaid && booking.gst_invoice_requested && invoiceParty.gstState ? `<br>GST State: ${invoiceParty.gstState}` : ''}
        </div>
        ${operator ? `
        <div style="margin-top:10px;padding:8px 10px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:8px;font-size:11px">
          <div style="font-size:9px;color:#7c3aed;letter-spacing:1px;text-transform:uppercase;margin-bottom:2px">Tour Operator</div>
          <strong style="color:#111">${operator.company_name}</strong>
          ${operator.contact_person ? ` · ${operator.contact_person}` : ''}
        </div>` : ''}
      </div>

      <!-- Dates -->
      <div>
        <div class="dates-box">
          <div class="date-cell">
            <div class="dc-label">Check-in</div>
            <div class="dc-val">${checkIn}</div>
            <div class="dc-note">After 3:00 PM</div>
          </div>
          <div class="nights-cell">
            <div class="nights-num">${nights}</div>
            <div class="nights-lbl">Nights</div>
          </div>
          <div class="date-cell">
            <div class="dc-label">Check-out</div>
            <div class="dc-val">${checkOut}</div>
            <div class="dc-note">Before 11:00 AM</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Room Details Table -->
    <div class="section-label">Room Details</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          ${showSacCode ? '<th style="text-align:right;width:70px">SAC</th><th style="text-align:right">Amount</th>' : ''}
        </tr>
      </thead>
      <tbody>${roomRows}</tbody>
    </table>

    <!-- Payment + Transaction -->
    ${isCheckInPass ? `
    <div class="welcome-box">
      <div class="welcome-title">Welcome to LeafWalk Resort</div>
      <div class="welcome-copy">
        Please share this pass at the front desk during arrival. We are ready to welcome you for a smooth check-in experience.
      </div>
    </div>` : ''}

    <div class="two-col">
      <!-- Payment summary / Check-in instructions -->
      ${isCheckInPass ? `
      <div>
        <div class="section-label">Arrival Instructions</div>
        <div class="info-box">
          <div class="ib-body">
            <div class="ib-row"><span class="k">Present At Front Desk</span><span class="v">${bookingNo}</span></div>
            <div class="ib-row"><span class="k">Check-in Time</span><span class="v">After 3:00 PM</span></div>
            <div class="ib-row"><span class="k">Check-out Time</span><span class="v">Before 11:00 AM</span></div>
            <div class="ib-row"><span class="k">ID Requirement</span><span class="v">Valid government ID required</span></div>
            ${operator?.company_name ? `<div class="ib-row"><span class="k">Travel Partner</span><span class="v">${operator.company_name}</span></div>` : ''}
            <div class="ib-row"><span class="k">Front Desk</span><span class="v">+91-8630227541</span></div>
            <div class="ib-row"><span class="k">Breakfast</span><span class="v">8:00 AM - 10:00 AM</span></div>
            <div class="ib-row"><span class="k">Kitchen Closes</span><span class="v">10:00 PM</span></div>
            <div class="ib-row"><span class="k">Resort Contact</span><span class="v">${RESORT.phone}</span></div>
          </div>
        </div>
      </div>` : `
      <div>
        <div class="section-label">${isFullyPaid ? 'GST Invoice Summary' : 'Payment Summary'}</div>
        <div class="pay-box">
          <div class="pay-body">
            ${isFullyPaid ? `
            <div class="pay-row">
              <span class="label">Taxable Amount</span>
              <span class="value">${curr(taxable)}</span>
            </div>
            <div class="pay-row">
              <span class="label">CGST @ 2.5%</span>
              <span class="value">${curr(cgst)}</span>
            </div>
            <div class="pay-row">
              <span class="label">SGST @ 2.5%</span>
              <span class="value">${curr(sgst)}</span>
            </div>` : ''}
            <div class="pay-row total-row">
              <span class="label">Total Amount</span>
              <span class="value">${curr(total)}</span>
            </div>
            ${advance > 0 && !isFullyPaid ? `
            <div class="pay-row paid-row">
              <span class="label">Advance Paid</span>
              <span class="value">${curr(advance)}</span>
            </div>` : ''}
            ${!isFullyPaid && balance > 0 ? `
            <div class="pay-row balance-row">
              <span class="label">Balance Due</span>
              <span class="value">${curr(balance)}</span>
            </div>` : isFullyPaid ? `
            <div class="pay-row" style="background:#f0fdf4">
              <span style="color:#166534;font-size:11.5px">✓ All payments received</span>
              <span style="color:#166534;font-weight:600">NIL</span>
            </div>` : ''}
          </div>
        </div>

        ${(booking.payment_method || booking.payment_ref || booking.transaction_number) ? `
        <div class="section-label" style="margin-top:12px">Payment Details</div>
        <div class="info-box">
          <div class="ib-body">
            ${booking.payment_method ? `<div class="ib-row"><span class="k">Mode</span><span class="v">${booking.payment_method.replace(/_/g,' ').toUpperCase()}</span></div>` : ''}
            ${(booking.payment_ref || booking.transaction_number) ? `<div class="ib-row"><span class="k">${booking.payment_method === 'upi' ? 'UPI UTR No.' : booking.payment_method === 'bank_transfer' ? 'UTR / Txn No.' : booking.payment_method === 'card' ? 'Transaction ID' : 'Ref No.'}</span><span class="v" style="font-family:monospace;font-size:11px">${booking.payment_ref || booking.transaction_number}</span></div>` : ''}
            ${booking.payment_date ? `<div class="ib-row"><span class="k">Payment Date</span><span class="v">${fmt(booking.payment_date)}</span></div>` : ''}
            ${booking.advance_paid_at ? `<div class="ib-row"><span class="k">Recorded</span><span class="v">${fmt(booking.advance_paid_at)}</span></div>` : ''}
          </div>
        </div>` : ''}
      </div>`}

      <!-- Booking Info -->
      <div>
        <div class="section-label">Booking Info</div>
        <div class="info-box">
          <div class="ib-body">
            ${!isCheckInPass && isFullyPaid ? `<div class="ib-row"><span class="k">Invoice No.</span><span class="v">${invoiceNo}</span></div>` : ''}
            ${!isCheckInPass && isFullyPaid && booking.gst_invoice_requested ? `<div class="ib-row"><span class="k">Invoice To</span><span class="v">${invoiceParty.name}</span></div>` : ''}
            ${!isCheckInPass && isFullyPaid && booking.gst_invoice_requested && invoiceParty.gstNumber ? `<div class="ib-row"><span class="k">GSTIN</span><span class="v">${invoiceParty.gstNumber}</span></div>` : ''}
            <div class="ib-row"><span class="k">Booking No.</span><span class="v">${bookingNo}</span></div>
            <div class="ib-row"><span class="k">Issued On</span><span class="v">${issuedOn}</span></div>
            ${booking.confirmed_at ? `<div class="ib-row"><span class="k">Confirmed</span><span class="v">${fmt(booking.confirmed_at)}</span></div>` : ''}
            ${booking.booking_source ? `<div class="ib-row"><span class="k">Source</span><span class="v">${booking.booking_source.replace(/_/g,' ').toUpperCase()}</span></div>` : ''}
            <div class="ib-row"><span class="k">Rooms</span><span class="v">${booking.rooms_booked || 1}</span></div>
            <div class="ib-row"><span class="k">Adults</span><span class="v">${booking.adults || 1}</span></div>
            ${Number(booking.children_5_to_12) > 0 ? `<div class="ib-row"><span class="k">Children (6–12)</span><span class="v">${booking.children_5_to_12}</span></div>` : ''}
            ${Number(booking.children_below_5) > 0 ? `<div class="ib-row"><span class="k">Children (0–5)</span><span class="v">${booking.children_below_5}</span></div>` : ''}
            ${Number(booking.extra_beds) > 0 ? `<div class="ib-row"><span class="k">Extra Beds</span><span class="v">${booking.extra_beds}</span></div>` : ''}
            ${booking.admin_notes ? `<div class="ib-row" style="flex-direction:column;gap:2px"><span class="k">Notes</span><span class="v" style="font-size:11px;color:#6b7280">${booking.admin_notes}</span></div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Policies -->
    <div class="policies">
      <div class="pol-title">Important Information</div>
        <div class="pol-grid">
          <div class="pol-item">Check-in after 3:00 PM · Check-out before 11:00 AM</div>
          <div class="pol-item">Valid government ID required at check-in</div>
          <div class="pol-item">Breakfast served 8–10 AM · Kitchen closes at 10 PM</div>
          <div class="pol-item">Lunch and dinner orders are served as per resort kitchen timings</div>
          <div class="pol-item">Cancellation charges as per reservation policy</div>
          ${!isCheckInPass && !isFullyPaid && balance > 0 ? `<div class="pol-item" style="color:#dc2626">Balance ${curr(balance)} due 7 days before check-in</div>` : '<div class="pol-item">No pets allowed in resort premises</div>'}
          <div class="pol-item">Front desk support: +91-8630227541</div>
          <div class="pol-item">Contact us 24×7: ${RESORT.phone}</div>
          <div class="pol-item">Outside food and alcohol are subject to resort policy</div>
          <div class="pol-item">${isCheckInPass ? 'Please keep this pass ready at arrival for a faster check-in' : 'Invoice generated against declared guest and stay details'}</div>
        </div>
      </div>

  </div><!-- /body -->

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <div class="footer-brand">LeafWalk Resort</div>
      <div>${RESORT.address}</div>
      <div>${RESORT.city}</div>
    </div>
    <div class="footer-right">
      <div>${RESORT.phone}</div>
      <div>${RESORT.email} · ${RESORT.website}</div>
      ${!isCheckInPass && RESORT.gstin ? `<div>GSTIN: ${RESORT.gstin}</div>` : ''}
      <div style="margin-top:4px;color:#d1d5db;font-size:9px">This is a computer generated ${isCheckInPass ? 'check-in pass' : 'receipt'}</div>
    </div>
  </div>
  <div class="gold-line"></div>

</div><!-- /page -->

<script>
window.onload = function() {
  document.title = '${isCheckInPass ? 'Check-In-Pass' : isFullyPaid ? 'GST-Invoice' : 'Receipt'}-${isCheckInPass ? bookingNo : isFullyPaid ? invoiceNo : bookingNo}';
}
<\/script>
</body>
</html>`

  if (isCheckInPass) {
    html = html.replace('<div class="pol-item">Invoice generated against declared guest and stay details</div>', '')
  }

  return html
}

export function generateBookingReceipt(booking: any): void {
  const html = buildBookingReceiptHtml(booking)
  const win = window.open('', '_blank', 'width=900,height=800,toolbar=0,menubar=0,scrollbars=1')
  if (!win) { alert('Pop-up blocked! Allow pop-ups for this site and try again.'); return }
  win.document.write(html)
  win.document.close()
}

export function generateCheckInPass(booking: any): void {
  const html = buildBookingReceiptHtml(booking, { documentMode: 'check_in_pass' })
  const win = window.open('', '_blank', 'width=900,height=800,toolbar=0,menubar=0,scrollbars=1')
  if (!win) { alert('Pop-up blocked! Allow pop-ups for this site and try again.'); return }
  win.document.write(html)
  win.document.close()
}
