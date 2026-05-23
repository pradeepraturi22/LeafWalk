import { formatDate } from '@/lib/utils'
import { calculateGST, calculateGSTFromSubtotal } from '@/lib/gst-bill-service'
import { getInvoicePartyMeta } from '@/lib/invoice-party'
import { getIndiaStateCodeByName } from '@/lib/india-state-codes'
import { COMPANY_DETAILS } from '@/lib/constants'

const RESORT = {
  name: COMPANY_DETAILS.name || 'LeafWalk Resort',
  gstin: COMPANY_DETAILS.gstin || '05BFOPR6010R1ZU',
  pan: COMPANY_DETAILS.pan || 'AADFL1234R',
  address: COMPANY_DETAILS.address || 'Vill- Banas, Narad Chatti, Hanuman Chatti',
  city: COMPANY_DETAILS.city || 'Yamunotri Road, Uttarkashi',
  state: COMPANY_DETAILS.state || 'Uttarakhand',
  pincode: COMPANY_DETAILS.pincode || '249193',
  phone: COMPANY_DETAILS.phone || '+91-8630227541',
  email: COMPANY_DETAILS.email || 'info@leafwalk.in',
  website: COMPANY_DETAILS.website || 'www.leafwalk.in',
  sacCode: COMPANY_DETAILS.sacCode || '996311',
}

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only (EP)',
  CP: 'Room + Breakfast (CP)',
  MAP: 'Room + Breakfast + Dinner (MAP)',
  AP: 'All Meals Included (AP)',
}

export type GstInvoiceLineItem = {
  desc: string
  rate: number
  qty: number
  nights: number
  amount: number
}

export type GstInvoiceDocumentData = {
  checkIn: string
  checkOut: string
  billDate: string
  mealLabel: string
  operator: any
  invoiceParty: ReturnType<typeof getInvoicePartyMeta>
  invoiceNo: string
  isIntraState: boolean
  items: GstInvoiceLineItem[]
  total: number
  subtotal: number
  cgst: number
  sgst: number
  igst: number
  advance: number
  balance: number
  isFullyPaid: boolean
  discountBeforeTax: number
  bankLines: string[]
  source: string
  paymentMode: string
  roomName: string
  nights: number
  rooms: number
  sacCode: string
}

function numberToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  function convert(n: number): string {
    if (n < 20) return ones[n]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '')
    if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${convert(n % 100)}` : ''}`
    if (n < 100000) return `${convert(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${convert(n % 1000)}` : ''}`
    if (n < 10000000) return `${convert(Math.floor(n / 100000))} Lakh${n % 100000 ? ` ${convert(n % 100000)}` : ''}`
    return `${convert(Math.floor(n / 10000000))} Crore${n % 10000000 ? ` ${convert(n % 10000000)}` : ''}`
  }
  const n = Math.round(amount)
  return n === 0 ? 'Zero' : convert(n)
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isUttarakhandState(value?: string | null) {
  return String(value || '').trim().toLowerCase().includes('uttarakhand')
}

function deriveStateCode(gstNumber?: string | null) {
  const normalized = String(gstNumber || '').trim()
  const match = normalized.match(/^(\d{2})/)
  return match ? match[1] : null
}

function isBillToIntraState(
  billTo: { stateCode?: string | null; gstState?: string | null },
  sellerStateCode: string
) {
  const buyerStateCode = String(billTo.stateCode || '').trim()
  if (buyerStateCode) return buyerStateCode === sellerStateCode
  if (billTo.gstState) return isUttarakhandState(billTo.gstState)
  return true
}

export function buildGSTInvoiceData(booking: any): GstInvoiceDocumentData {
  const checkIn = formatDate(booking.check_in)
  const checkOut = formatDate(booking.check_out)
  const billDate = formatDate(new Date())
  const mealLabel = MEAL_LABELS[booking.meal_plan] || booking.meal_plan || '-'
  const operator = booking.tour_operator || null
  const invoiceParty = getInvoicePartyMeta(booking)
  const nights = Number(booking.nights || 0)
  const invoiceNo = booking.invoice_number || booking.booking_number || `INV-${(booking.id || '').slice(0, 8).toUpperCase()}`

  const operatorInvoiceParty = booking.booking_source === 'tour_operator' && operator
    ? {
        ...invoiceParty,
        name: String(operator.company_name || operator.contact_person || invoiceParty.name || '').trim() || invoiceParty.name,
        email: String(operator.email || '').trim() || invoiceParty.email,
        phone: String(operator.phone || '').trim() || invoiceParty.phone,
        address: [operator.address, operator.city, operator.state].filter(Boolean).join(', ') || invoiceParty.address,
        gstNumber: String(operator.gst_number || '').trim() || invoiceParty.gstNumber,
        gstState: String(operator.state || '').trim() || invoiceParty.gstState,
        stateCode:
          getIndiaStateCodeByName(String(operator.state || '').trim()) ||
          deriveStateCode(String(operator.gst_number || '').trim()) ||
          invoiceParty.stateCode,
        panNumber: String(operator.pan_number || '').trim() || invoiceParty.panNumber || null,
      }
    : invoiceParty

  const sellerStateCode = String(RESORT.gstin || '').slice(0, 2) || '05'
  const isIntraState = isBillToIntraState(operatorInvoiceParty, sellerStateCode)

  const items: GstInvoiceLineItem[] = []
  const roomRate = Number(booking.rate_per_room_per_night || 0)
  const roomQty = Number(booking.rooms_booked || 1)
  if (roomRate > 0) items.push({ desc: `${booking.room?.name || 'Room'} - ${mealLabel}`, rate: roomRate, qty: roomQty, nights, amount: roomRate * roomQty * nights })
  if (Number(booking.extra_beds) > 0 && Number(booking.extra_bed_rate_per_night) > 0) {
    const r = Number(booking.extra_bed_rate_per_night)
    const q = Number(booking.extra_beds)
    items.push({ desc: `Extra Bed - ${mealLabel}`, rate: r, qty: q, nights, amount: r * q * nights })
  }
  if (Number(booking.children_5_to_12) > 0 && Number(booking.child_rate_per_night) > 0) {
    const r = Number(booking.child_rate_per_night)
    const q = Number(booking.children_5_to_12)
    items.push({ desc: `Child (6-12 yrs) - ${mealLabel}`, rate: r, qty: q, nights, amount: r * q * nights })
  }

  const total = Number(booking.total_amount || 0)
  const storedSubtotal = Number(booking.subtotal || 0)
  const gstMath = total > 0 ? calculateGST(total) : calculateGSTFromSubtotal(storedSubtotal)
  const subtotal = gstMath.subtotal
  const cgst = gstMath.cgst
  const sgst = gstMath.sgst
  const igst = cgst + sgst
  const storedDiscount = Number(booking.discount_amount || 0)
  const advance = Number(booking.advance_amount || 0)
  const rawBalance = Number(booking.balance_amount || 0)
  const isFullyPaid = booking.payment_status === 'fully_paid'
  const balance = isFullyPaid ? 0 : rawBalance

  const grossLineAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const derivedDiscount = grossLineAmount > subtotal ? Math.round((grossLineAmount - subtotal) * 100) / 100 : 0
  const discountBeforeTax = storedDiscount > 0 ? storedDiscount : derivedDiscount

  if (items.length === 0 && subtotal > 0) {
    const fallbackQty = Math.max(1, roomQty)
    const fallbackNights = Math.max(1, nights)
    const fallbackAmount = subtotal
    const fallbackRate = fallbackAmount / (fallbackQty * fallbackNights)
    items.push({
      desc: `${booking.room?.name || 'Room'} - ${mealLabel}`,
      rate: Number.isFinite(fallbackRate) ? fallbackRate : fallbackAmount,
      qty: fallbackQty,
      nights: fallbackNights,
      amount: fallbackAmount,
    })
  }

  const bankLines = [
    COMPANY_DETAILS.bankAccountName ? `Account Name: ${COMPANY_DETAILS.bankAccountName}` : '',
    COMPANY_DETAILS.bankName ? `Bank Name: ${COMPANY_DETAILS.bankName}` : '',
    COMPANY_DETAILS.accountNumber ? `Account No.: ${COMPANY_DETAILS.accountNumber}` : '',
    COMPANY_DETAILS.ifsc ? `IFSC Code: ${COMPANY_DETAILS.ifsc}` : '',
    COMPANY_DETAILS.branch ? `Branch: ${COMPANY_DETAILS.branch}` : '',
  ].filter(Boolean)

  return {
    checkIn,
    checkOut,
    billDate,
    mealLabel,
    operator,
    invoiceParty: operatorInvoiceParty,
    invoiceNo,
    isIntraState,
    items,
    total,
    subtotal,
    cgst,
    sgst,
    igst,
    advance,
    balance,
    isFullyPaid,
    discountBeforeTax,
    bankLines,
    source: String(booking.booking_source || '').replace(/_/g, ' ').toUpperCase(),
    paymentMode: String(booking.payment_method || 'Cash').toUpperCase().replace(/_/g, ' '),
    roomName: booking.room?.name || '-',
    nights,
    rooms: Number(booking.rooms_booked || 1),
    sacCode: RESORT.sacCode,
  }
}

export function buildGSTBillHtml(booking: any): string {
  const invoice = buildGSTInvoiceData(booking)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>LeafWalk Invoice ${invoice.invoiceNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,Helvetica,sans-serif;background:#f2f2f2;color:#1a1a1a;font-size:13px}
  .page{width:210mm;min-height:297mm;margin:10px auto;background:#fff;box-shadow:0 4px 30px rgba(0,0,0,.15);position:relative;overflow:hidden}
  .hdr{background:linear-gradient(135deg,#0a0a0a 0%,#151208 50%,#1e1a0a 100%);padding:24px 32px 20px;display:flex;align-items:center;gap:18px;position:relative;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .hdr::before{content:'';position:absolute;top:-60px;right:-60px;width:220px;height:220px;background:radial-gradient(circle,rgba(201,161,74,.12) 0%,transparent 70%);border-radius:50%}
  .logo-wrap{width:58px;height:58px;border:2px solid rgba(201,161,74,.7);border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(201,161,74,.08);flex-shrink:0}
  .logo-emoji{font-size:24px}
  .rinfo{flex:1}
  .rname{font-family:'Playfair Display','Georgia',serif;font-size:24px;font-weight:700;color:#c9a14a;letter-spacing:2px;line-height:1}
  .rtag{color:#8b6914;font-size:9px;letter-spacing:3px;text-transform:uppercase;margin-top:3px}
  .rcontact{color:#777;font-size:10px;margin-top:7px;line-height:1.8}
  .rcontact .hl{color:#c9a14a;font-weight:500}
  .inv-badge{background:rgba(201,161,74,.12);border:1px solid rgba(201,161,74,.35);border-radius:12px;padding:12px 16px;text-align:center;flex-shrink:0;min-width:140px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.04)}
  .inv-badge-lbl{color:#8b6914;font-size:8px;letter-spacing:2px;text-transform:uppercase;font-weight:600}
  .inv-badge-no{color:#fff;font-size:13px;font-weight:700;margin-top:4px;font-family:'Playfair Display',serif}
  .inv-badge-dt{color:#666;font-size:10px;margin-top:3px}
  .gbar{height:3px;background:linear-gradient(90deg,#6b4f10,#c9a14a,#e6c87a,#c9a14a,#6b4f10)}
  .meta{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #ebebeb;background:linear-gradient(180deg,#fff 0%,#fcfbf7 100%)}
  .meta-cell{padding:13px 32px;border-right:1px solid #ebebeb}
  .meta-cell:last-child{border-right:none}
  .meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .ml{font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:#aaa;font-weight:600;margin-bottom:2px}
  .mv{font-size:12.5px;color:#1a1a1a;font-weight:600}
  .party{display:grid;grid-template-columns:1.12fr .88fr;border-bottom:1px solid #ebebeb}
  .party-cell{padding:14px 32px;border-right:1px solid #ebebeb}
  .party-cell:last-child{border-right:none}
  .ph{font-size:8.5px;letter-spacing:1.5px;text-transform:uppercase;color:#c9a14a;font-weight:700;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #f5ecd5}
  .pn{font-size:15px;font-weight:700;color:#1a1a1a;margin-bottom:4px;line-height:1.35}
  .pd{color:#555;font-size:11.5px;line-height:1.75}
  .sbar{background:linear-gradient(180deg,#fcfcfc 0%,#f7f5ef 100%);border-bottom:1px solid #ebebeb;padding:11px 32px;display:flex;gap:0;align-items:stretch}
  .si{flex:1;text-align:center;padding:0 12px;border-right:1px solid #e5e5e5}
  .si:last-child{border-right:none}
  .sil{font-size:8px;color:#aaa;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px}
  .siv{font-size:12.5px;color:#1a1a1a;font-weight:600}
  .tbl-wrap{padding:18px 32px 10px}
  .section-cap{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
  .section-cap-title{font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#8b6914;font-weight:700}
  .section-cap-sub{font-size:10px;color:#8b8b8b}
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
  .totals-wrap{padding:8px 32px 18px;display:flex;gap:18px;align-items:flex-start}
  .awords{flex:1;background:linear-gradient(180deg,#fffdf6 0%,#fff8e6 100%);border:1px solid #f0e0a0;border-radius:12px;padding:14px 16px;box-shadow:0 8px 22px rgba(201,161,74,.08)}
  .awl{font-size:8.5px;color:#8b6914;letter-spacing:1.2px;text-transform:uppercase;font-weight:700;margin-bottom:6px}
  .awt{font-size:12px;color:#5a4010;font-style:italic;line-height:1.7}
  .words-col{flex:1;display:flex;flex-direction:column;gap:10px}
  .ttbl{width:235px;flex-shrink:0;background:#fff;border:1px solid #f0ece2;border-radius:12px;padding:10px 14px}
  .ttbl td{padding:5px 0;font-size:12px;color:#444}
  .ttbl td.amt{text-align:right;font-weight:500}
  .ttbl tr.trow td{font-size:14px;font-weight:700;color:#c9a14a;padding-top:9px;border-top:2px solid #c9a14a}
  .ttbl tr.brow td{color:#c0392b;font-weight:600}
  .ftr{margin:0 32px;border-top:1px solid #ebebeb;padding:16px 0 18px;display:flex;gap:18px;align-items:flex-start}
  .decl{flex:1}
  .bank{width:280px;flex-shrink:0;background:#fffcf4;border:1px solid #f0e0a0;border-radius:8px;padding:12px 14px}
  .block-title{font-size:8.5px;color:#aaa;letter-spacing:1px;text-transform:uppercase;font-weight:600;margin-bottom:6px}
  .block-body{font-size:10.5px;color:#666;line-height:1.7}
  .sig{text-align:right;font-size:10px;color:#444;margin-top:20px}
  .sys-note{margin:8px 32px 18px;text-align:center;font-size:10px;color:#8a8a8a;letter-spacing:.4px}
  .tag-paid{display:inline-block;background:#27ae60;color:#fff;font-size:8.5px;padding:2px 8px;border-radius:3px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-left:6px;vertical-align:middle}
  .tag-partial{display:inline-block;background:#e67e22;color:#fff;font-size:8.5px;padding:2px 8px;border-radius:3px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-left:6px;vertical-align:middle}
  .wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:90px;color:rgba(201,161,74,.035);font-family:'Playfair Display',serif;font-weight:700;pointer-events:none;white-space:nowrap;z-index:0}
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

<div class="hdr">
  <div class="logo-wrap"><span class="logo-emoji">LW</span></div>
  <div class="rinfo">
    <div class="rname">LEAFWALK RESORT</div>
    <div class="rtag">Stay in Lap of Nature</div>
    <div class="rcontact">
      ${RESORT.address}, ${RESORT.city}, ${RESORT.state}${RESORT.pincode ? ` - ${RESORT.pincode}` : ''}<br>
      Phone: ${RESORT.phone} &nbsp;|&nbsp; Email: ${RESORT.email} &nbsp;|&nbsp; Web: ${RESORT.website}<br>
      <span class="hl">GSTIN: ${RESORT.gstin}</span> &nbsp;|&nbsp; SAC: ${RESORT.sacCode}
    </div>
  </div>
  <div class="inv-badge">
    <div class="inv-badge-lbl">Tax Invoice</div>
    <div class="inv-badge-no">${invoice.invoiceNo}</div>
    <div class="inv-badge-dt">${invoice.billDate}</div>
  </div>
</div>
<div class="gbar"></div>

<div class="meta">
  <div class="meta-cell">
    <div class="meta-grid">
      <div><div class="ml">Invoice No</div><div class="mv">${invoice.invoiceNo}</div></div>
      <div><div class="ml">Date</div><div class="mv">${invoice.billDate}</div></div>
      <div><div class="ml">Payment Mode</div><div class="mv">${invoice.paymentMode}</div></div>
      <div><div class="ml">Tax Type</div><div class="mv" style="font-size:11px">${invoice.isIntraState ? 'CGST + SGST' : 'IGST'}</div></div>
    </div>
  </div>
  <div class="meta-cell">
    <div class="meta-grid">
      <div><div class="ml">Booking Ref</div><div class="mv">${booking.booking_number || '-'}</div></div>
      <div><div class="ml">Source</div><div class="mv" style="font-size:11px">${invoice.source}</div></div>
      <div>
        <div class="ml">Status</div>
        <div class="mv">
          ${booking.payment_status === 'fully_paid'
            ? '<span class="tag-paid">Fully Paid</span>'
            : ['advance_paid', 'payment_processing'].includes(booking.payment_status)
              ? '<span class="tag-partial">Advance Paid</span>'
              : String(booking.payment_status || '').replace(/_/g, ' ')}
        </div>
      </div>
      ${invoice.operator ? `<div><div class="ml">Partner</div><div class="mv" style="font-size:11px">${invoice.operator.company_name || 'Travel Partner'}</div></div>` : ''}
    </div>
  </div>
</div>

<div class="party">
  <div class="party-cell">
    <div class="ph">Bill To</div>
    <div class="pn">${invoice.invoiceParty.name}</div>
    <div class="pd">
      ${invoice.invoiceParty.phone ? `Phone: ${invoice.invoiceParty.phone}<br>` : ''}
      ${invoice.invoiceParty.email ? `Email: ${invoice.invoiceParty.email}<br>` : ''}
      ${invoice.invoiceParty.address ? `Address: ${invoice.invoiceParty.address}<br>` : ''}
      ${invoice.invoiceParty.gstNumber ? `GSTIN: ${invoice.invoiceParty.gstNumber}<br>` : ''}
      ${invoice.invoiceParty.gstState ? `State: ${invoice.invoiceParty.gstState}${invoice.invoiceParty.stateCode ? ` (${invoice.invoiceParty.stateCode})` : ''}` : ''}
    </div>
  </div>
  <div class="party-cell">
    <div class="ph">Stay Information</div>
    <div class="pd" style="margin-top:6px">
      <strong>Room:</strong> ${invoice.roomName}<br>
      <strong>Meal Plan:</strong> ${invoice.mealLabel}<br>
      <strong>Stay:</strong> ${invoice.nights} Night${invoice.nights === 1 ? '' : 's'} · ${invoice.rooms} Room${invoice.rooms === 1 ? '' : 's'}
    </div>
  </div>
</div>

<div class="sbar">
  <div class="si"><div class="sil">Check-in</div><div class="siv">${invoice.checkIn}</div></div>
  <div class="si"><div class="sil">Check-out</div><div class="siv">${invoice.checkOut}</div></div>
  <div class="si"><div class="sil">Nights</div><div class="siv">${invoice.nights}</div></div>
  <div class="si"><div class="sil">Rooms</div><div class="siv">${invoice.rooms}</div></div>
  <div class="si"><div class="sil">Room Type</div><div class="siv">${invoice.roomName}</div></div>
  <div class="si"><div class="sil">Meal Plan</div><div class="siv">${booking.meal_plan || '-'}</div></div>
</div>

<div class="tbl-wrap">
  <div class="section-cap">
    <div class="section-cap-title">Invoice Line Items</div>
    <div class="section-cap-sub">${invoice.items.length} item${invoice.items.length === 1 ? '' : 's'} · ${invoice.nights} night${invoice.nights === 1 ? '' : 's'} stay</div>
  </div>
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
      ${invoice.items.map((item, i) => `
      <tr>
        <td style="color:#bbb;font-size:11px">${i + 1}</td>
        <td>
          <div class="idesc">${item.desc}</div>
          <div class="isub">SAC: ${invoice.sacCode} · Hotel Accommodation Services · GST: 5%</div>
        </td>
        <td class="right">Rs.${fmt(item.rate)}</td>
        <td class="center">${item.qty}</td>
        <td class="center">${item.nights}</td>
        <td class="right">Rs.${fmt(item.amount)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>

<div class="totals-wrap">
  <div class="words-col">
    <div class="awords">
      <div class="awl">Amount in Words</div>
      <div class="awt">
        <strong>${numberToWords(Math.round(invoice.total))} Only</strong>
        ${invoice.advance > 0 ? `<br><span style="font-size:11px;color:#888;">Advance: ${numberToWords(Math.round(invoice.advance))} Only</span>` : ''}
        ${(!invoice.isFullyPaid && invoice.balance > 0) ? `<br><span style="color:#c0392b;">Balance Due: ${numberToWords(Math.round(invoice.balance))} Only</span>` : ''}
      </div>
    </div>
  </div>
  <table class="ttbl">
    ${invoice.discountBeforeTax > 0 ? `<tr><td>Gross Service Value</td><td class="amt">Rs.${fmt(invoice.subtotal + invoice.discountBeforeTax)}</td></tr>` : ''}
    ${invoice.discountBeforeTax > 0 ? `<tr><td>Less: Discount (Before Tax)</td><td class="amt">Rs.${fmt(invoice.discountBeforeTax)}</td></tr>` : ''}
    <tr><td>Taxable Amount</td><td class="amt">Rs.${fmt(invoice.subtotal)}</td></tr>
    ${invoice.isIntraState
      ? `<tr><td>CGST @ 2.5%</td><td class="amt">Rs.${fmt(invoice.cgst)}</td></tr><tr><td>SGST @ 2.5%</td><td class="amt">Rs.${fmt(invoice.sgst)}</td></tr>`
      : `<tr><td>IGST @ 5%</td><td class="amt">Rs.${fmt(invoice.igst)}</td></tr>`}
    <tr class="trow"><td>Total Amount</td><td class="amt">Rs.${fmt(invoice.total)}</td></tr>
    ${(!invoice.isFullyPaid && invoice.balance > 0) ? `<tr class="brow"><td>Balance Due</td><td class="amt">Rs.${fmt(invoice.balance)}</td></tr>` : ''}
  </table>
</div>

<div class="ftr">
  <div class="decl">
    <div class="block-title">Declaration</div>
    <div class="block-body">
      We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.
    </div>
  </div>
  <div class="bank">
    <div class="block-title">LeafWalk Bank Details</div>
    <div class="block-body">
      ${invoice.bankLines.length ? invoice.bankLines.join('<br>') : 'Available on request'}
    </div>
    <div class="sig">
      for ${RESORT.name.toUpperCase()}<br><br><br>
      Authorised Signatory
    </div>
  </div>
</div>
<div class="sys-note">This is a system generated invoice.</div>
<div class="gbar" style="margin-top:10px"></div>
</div>

<script>
window.onload = function() {
  document.title = 'LeafWalk-Invoice-${invoice.invoiceNo}';
}
</script>
</body></html>`
}

export function generateGSTBill(booking: any): void {
  const html = buildGSTBillHtml(booking)
  const win = window.open('', '_blank', 'width=960,height=800,toolbar=0,menubar=0')
  if (!win) {
    alert('Pop-up blocked! Please allow pop-ups for this site and try again.')
    return
  }
  win.document.write(html)
  win.document.close()
}
