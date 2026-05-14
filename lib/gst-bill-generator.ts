import { COMPANY_DETAILS } from '@/lib/constants'
import { calculateGST, calculateGSTFromSubtotal } from '@/lib/gst-bill-service'
import { getInvoicePartyMeta } from '@/lib/invoice-party'
import { formatDate } from '@/lib/utils'

const MEAL_LABELS: Record<string, string> = {
  EP: 'Room Only (EP)',
  CP: 'Room + Breakfast (CP)',
  MAP: 'Room + Breakfast + Dinner (MAP)',
  AP: 'All Meals Included (AP)',
}

function fmt(n: number) {
  return Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
  const rounded = Math.round(amount)
  return rounded === 0 ? 'Zero' : convert(rounded)
}

function normalizeOperator(booking: any) {
  return Array.isArray(booking?.tour_operator) ? booking.tour_operator[0] : booking?.tour_operator
}

function sellerStateCode() {
  const gstin = String(COMPANY_DETAILS.gstin || '').trim()
  return gstin.length >= 2 ? gstin.slice(0, 2) : ''
}

function buildInvoiceRows(booking: any, mealLabel: string, nights: number) {
  const rows: Array<{ desc: string; sac: string; qty: number; rate: number; unit: string; amount: number }> = []

  const roomRate = Number(booking.rate_per_room_per_night || 0)
  const rooms = Number(booking.rooms_booked || 1)
  if (roomRate > 0) {
    rows.push({
      desc: `${booking.room?.name || 'Room'} - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode,
      qty: rooms * Math.max(nights, 1),
      rate: roomRate,
      unit: 'Night',
      amount: roomRate * rooms * Math.max(nights, 1),
    })
  }

  if (Number(booking.extra_beds) > 0 && Number(booking.extra_bed_rate_per_night) > 0) {
    const qty = Number(booking.extra_beds) * Math.max(nights, 1)
    const rate = Number(booking.extra_bed_rate_per_night)
    rows.push({
      desc: `Extra Bed - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode,
      qty,
      rate,
      unit: 'Night',
      amount: qty * rate,
    })
  }

  if (Number(booking.children_5_to_12) > 0 && Number(booking.child_rate_per_night) > 0) {
    const qty = Number(booking.children_5_to_12) * Math.max(nights, 1)
    const rate = Number(booking.child_rate_per_night)
    rows.push({
      desc: `Child (6-12 yrs) - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode,
      qty,
      rate,
      unit: 'Night',
      amount: qty * rate,
    })
  }

  if (!rows.length) {
    const total = Number(booking.total_amount || 0)
    rows.push({
      desc: `${booking.room?.name || 'Accommodation'} - ${mealLabel}`,
      sac: COMPANY_DETAILS.sacCode,
      qty: 1,
      rate: total,
      unit: 'Service',
      amount: total,
    })
  }

  return rows
}

export function buildGSTBillHtml(booking: any): string {
  const operator = normalizeOperator(booking)
  const invoiceParty = getInvoicePartyMeta(booking)
  const nights = Number(booking.nights || 0)
  const mealLabel = MEAL_LABELS[booking.meal_plan] || booking.meal_plan || '-'
  const invoiceNo = booking.invoice_number || booking.booking_number || `INV-${String(booking.id || '').slice(0, 8).toUpperCase()}`
  const invoiceDate = formatDate(new Date())
  const bookingDate = formatDate(booking.created_at || new Date())
  const checkIn = formatDate(booking.check_in)
  const checkOut = formatDate(booking.check_out)
  const total = Number(booking.total_amount || 0)
  const storedSubtotal = Number(booking.subtotal || 0)
  const gstMath = total > 0 ? calculateGST(total) : calculateGSTFromSubtotal(storedSubtotal)
  const subtotal = gstMath.subtotal
  const cgst = gstMath.cgst
  const sgst = gstMath.sgst
  const gstTotal = cgst + sgst
  const items = buildInvoiceRows(booking, mealLabel, nights)
  const buyerStateCode = invoiceParty.stateCode || ''
  const sellerCode = sellerStateCode()
  const isIntraState = !buyerStateCode || !sellerCode || buyerStateCode === sellerCode
  const taxLabel = isIntraState ? 'CGST @ 2.5%' : 'IGST @ 5%'
  const taxValue = isIntraState ? gstTotal : gstTotal
  const amountWords = numberToWords(total)
  const taxWords = numberToWords(gstTotal)
  const bankLines = [
    COMPANY_DETAILS.bankAccountName ? `A/c Name : ${COMPANY_DETAILS.bankAccountName}` : '',
    COMPANY_DETAILS.bankName ? `Bank Name : ${COMPANY_DETAILS.bankName}` : '',
    COMPANY_DETAILS.accountNumber ? `A/c No. : ${COMPANY_DETAILS.accountNumber}` : '',
    COMPANY_DETAILS.ifsc ? `IFSC Code : ${COMPANY_DETAILS.ifsc}` : '',
    COMPANY_DETAILS.branch ? `Branch : ${COMPANY_DETAILS.branch}` : '',
  ].filter(Boolean)

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Tax Invoice ${invoiceNo}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#f3f3f3;font-family:Arial,Helvetica,sans-serif;color:#111}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:10mm 8mm 8mm}
  .center{text-align:center}
  .title{font-weight:700;font-size:16px;margin-bottom:6px}
  .top-grid{display:grid;grid-template-columns:1fr 58mm;gap:8px;align-items:start}
  .small{font-size:11px;line-height:1.3}
  .tiny{font-size:9px;line-height:1.25}
  .label{font-weight:700}
  .qr-box{border:1px solid #000;height:54mm;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:4px}
  .qr-title{font-size:10px;font-weight:700;margin-bottom:4px}
  .qr-note{font-size:10px;color:#444;text-align:center;padding:0 6px}
  .box-grid{display:grid;grid-template-columns:1fr 74mm;gap:0;margin-top:6px;border:1px solid #000}
  .cell{border-right:1px solid #000;min-height:56mm;padding:4px 5px}
  .cell:last-child{border-right:none}
  .buyer-block{margin-top:10px}
  .section-head{font-size:10px;font-weight:700;margin-bottom:2px}
  .meta-table{width:100%;border-collapse:collapse}
  .meta-table td{border-bottom:1px solid #000;border-left:1px solid #000;padding:3px 4px;font-size:10px;vertical-align:top}
  .meta-table tr:first-child td{border-top:none}
  .meta-table td:first-child{width:52%;border-left:none}
  .items{width:100%;border-collapse:collapse;margin-top:0;border:1px solid #000;border-top:none}
  .items th,.items td{border:1px solid #000;padding:3px 4px;font-size:10px;vertical-align:top}
  .items th{font-weight:700}
  .right{text-align:right}
  .left{text-align:left}
  .centered{text-align:center}
  .desc{min-height:88mm}
  .spacer{height:78mm}
  .totals-line td{font-weight:700}
  .words-box,.tax-box{border:1px solid #000;border-top:none;padding:3px 4px;font-size:10px}
  .summary{display:grid;grid-template-columns:1fr 66mm;gap:0}
  .tax-summary{width:100%;border-collapse:collapse}
  .tax-summary td,.tax-summary th{border:1px solid #000;padding:3px 4px;font-size:10px}
  .bottom-grid{display:grid;grid-template-columns:1fr 78mm;gap:10px;margin-top:6px}
  .declaration{font-size:10px;line-height:1.35}
  .signature{font-size:10px;display:flex;flex-direction:column;justify-content:space-between;min-height:44mm}
  .signature .sign-line{text-align:right;margin-top:20mm}
  .footer{text-align:center;font-size:9px;margin-top:6px}
  .muted{color:#444}
  @page{size:A4;margin:0}
</style>
</head>
<body>
  <div class="page">
    <div class="center title">Tax Invoice</div>

    <div class="top-grid">
      <div class="small">
        ${operator?.irn ? `<div><span class="label">IRN</span> : ${operator.irn}</div>` : ''}
        ${operator?.ack_no ? `<div><span class="label">Ack No.</span> : ${operator.ack_no}</div>` : ''}
        ${operator?.ack_date ? `<div><span class="label">Ack Date</span> : ${operator.ack_date}</div>` : ''}
      </div>
      <div class="qr-box">
        <div class="qr-title">e-Invoice</div>
        <div class="qr-note">QR / IRN details available nahi hain, isliye yahan blank rakha gaya hai.</div>
      </div>
    </div>

    <div class="box-grid">
      <div class="cell small">
        <div class="section-head">COMPANY DETAILS</div>
        <div class="label">${COMPANY_DETAILS.name.toUpperCase()}</div>
        <div>${COMPANY_DETAILS.address}</div>
        <div>${COMPANY_DETAILS.city}, ${COMPANY_DETAILS.state}${COMPANY_DETAILS.pincode ? ` - ${COMPANY_DETAILS.pincode}` : ''}</div>
        ${COMPANY_DETAILS.phone ? `<div>M.NO.- ${COMPANY_DETAILS.phone}</div>` : ''}
        ${COMPANY_DETAILS.gstin ? `<div>GSTIN/UIN : ${COMPANY_DETAILS.gstin}</div>` : ''}
        <div>State Name : ${COMPANY_DETAILS.state}${sellerCode ? `, Code : ${sellerCode}` : ''}</div>
        ${COMPANY_DETAILS.email ? `<div>E-Mail : ${COMPANY_DETAILS.email}</div>` : ''}

        <div class="buyer-block">
          <div class="section-head">Buyer (Bill to)</div>
          <div class="label">${invoiceParty.name || '-'}</div>
          ${invoiceParty.address ? `<div>${invoiceParty.address}</div>` : ''}
          ${invoiceParty.phone ? `<div>M.NO.- ${invoiceParty.phone}</div>` : ''}
          ${invoiceParty.email ? `<div>E-Mail : ${invoiceParty.email}</div>` : ''}
          ${invoiceParty.gstNumber ? `<div>GSTIN/UIN : ${invoiceParty.gstNumber}</div>` : ''}
          <div>State Name : ${invoiceParty.gstState || '-'}${buyerStateCode ? `, Code : ${buyerStateCode}` : ''}</div>
        </div>
      </div>

      <div class="cell">
        <table class="meta-table">
          <tr><td>Invoice No.</td><td>${invoiceNo}</td></tr>
          <tr><td>Dated</td><td>${invoiceDate}</td></tr>
          <tr><td>Delivery Note</td><td>${booking.payment_method ? `Mode/Terms of Payment: ${String(booking.payment_method).replace(/_/g, ' ').toUpperCase()}` : ''}</td></tr>
          <tr><td>Reference No. & Date.</td><td>${booking.booking_number || ''}</td></tr>
          <tr><td>Buyer's Order No.</td><td>${booking.booking_number || ''}</td></tr>
          <tr><td>Dispatch Doc No.</td><td></td></tr>
          <tr><td>Dispatched through</td><td></td></tr>
          <tr><td>Destination</td><td>${invoiceParty.gstState || ''}</td></tr>
          <tr><td>Stay Dates</td><td>${checkIn} to ${checkOut}</td></tr>
          <tr><td>Rooms / Nights</td><td>${booking.rooms_booked || 1} Room(s) / ${nights} Night(s)</td></tr>
        </table>
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:18px">Sl No.</th>
          <th>Description of Goods / Services</th>
          <th style="width:48px">HSN/SAC</th>
          <th style="width:42px">Quantity</th>
          <th style="width:48px">Rate</th>
          <th style="width:34px">Per</th>
          <th style="width:38px">Disc. %</th>
          <th style="width:72px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `
          <tr>
            <td class="centered">${index + 1}</td>
            <td>${item.desc}</td>
            <td class="centered">${item.sac}</td>
            <td class="centered">${item.qty}</td>
            <td class="right">${fmt(item.rate)}</td>
            <td class="centered">${item.unit}</td>
            <td class="centered">0</td>
            <td class="right">${fmt(item.amount)}</td>
          </tr>
        `).join('')}
        <tr>
          <td colspan="8" class="desc"></td>
        </tr>
        <tr class="totals-line">
          <td colspan="3"></td>
          <td class="centered">${items.reduce((sum, item) => sum + Number(item.qty || 0), 0)}</td>
          <td colspan="3" class="right">Total</td>
          <td class="right">₹ ${fmt(subtotal)}</td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      <div>
        <div class="words-box">
          <div class="tiny">Amount Chargeable (in words)</div>
          <div class="small"><span class="label">INR ${amountWords} Only</span></div>
        </div>
        <div class="words-box">
          <div class="tiny">Tax Amount (in words)</div>
          <div class="small"><span class="label">INR ${taxWords} Only</span></div>
        </div>
      </div>
      <div class="tax-box">
        <table class="tax-summary">
          <tr>
            <th>Taxable Value</th>
            <th>Rate</th>
            <th>GST Amount</th>
            <th>Total Tax Amount</th>
          </tr>
          <tr>
            <td class="right">${fmt(subtotal)}</td>
            <td class="centered">${isIntraState ? '5%' : '5%'}</td>
            <td class="right">${fmt(taxValue)}</td>
            <td class="right">${fmt(gstTotal)}</td>
          </tr>
          <tr>
            <td colspan="3" class="right label">Total:</td>
            <td class="right label">${fmt(gstTotal)}</td>
          </tr>
        </table>
      </div>
    </div>

    <div class="bottom-grid">
      <div class="declaration">
        <div class="label tiny" style="margin-bottom:4px">Declaration</div>
        <div>We declare that this invoice shows the actual price of the services described and that all particulars are true and correct.</div>
      </div>

      <div class="signature">
        ${bankLines.length ? `
          <div>
            <div class="label tiny" style="margin-bottom:4px">Company's Bank Details</div>
            ${bankLines.map((line) => `<div>${line}</div>`).join('')}
          </div>
        ` : '<div></div>'}
        <div class="sign-line">
          <div>for ${COMPANY_DETAILS.name.toUpperCase()}</div>
          <div style="margin-top:18px">Authorised Signatory</div>
        </div>
      </div>
    </div>

    <div class="footer">This is a Computer Generated Invoice</div>
  </div>
</body>
</html>`
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
