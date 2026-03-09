import { COMPANY_DETAILS } from '@/lib/constants'

interface GSTBillProps {
  booking: {
    id: string
    invoice_number?: string
    guest_name: string
    guest_email: string
    guest_phone: string
    room?: { name: string }
    check_in: string
    check_out: string
    nights: number
    rooms_booked: number
    total_amount: number
    subtotal?: number
    cgst?: number
    sgst?: number
    gst_total?: number
    payment_status: string
    payment_id?: string
    created_at: string
  }
}

export default function GSTBill({ booking }: GSTBillProps) {
  // Calculate GST if not already in booking
  const subtotal = booking.subtotal || Math.round(booking.total_amount / 1.18 * 100) / 100
  const gstTotal = booking.gst_total || booking.total_amount - subtotal
  const cgst = booking.cgst || Math.round(gstTotal / 2 * 100) / 100
  const sgst = booking.sgst || cgst

  const invoiceNumber = booking.invoice_number || `LWR/TEMP/${booking.id.slice(0, 8)}`
  const invoiceDate = new Date(booking.created_at).toLocaleDateString('en-IN')

  function numberToWords(num: number): string {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']

    if (num === 0) return 'Zero'
    if (num < 10) return ones[num]
    if (num < 20) return teens[num - 10]
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '')
    if (num < 1000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + numberToWords(num % 100) : '')
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 ? ' ' + numberToWords(num % 1000) : '')
    return numberToWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 ? ' ' + numberToWords(num % 100000) : '')
  }

  const amountInWords = numberToWords(Math.floor(booking.total_amount)) + ' Rupees Only'

  return (
    <div className="bg-white text-black p-8 max-w-4xl mx-auto" id="gst-bill">
      {/* Header */}
      <div className="text-center border-b-2 border-black pb-4 mb-4">
        <h1 className="text-3xl font-bold text-[#2c5f2d]">{COMPANY_DETAILS.name}</h1>
        <p className="text-sm mt-2">{COMPANY_DETAILS.address}</p>
        <p className="text-sm">{COMPANY_DETAILS.city}, {COMPANY_DETAILS.state} - {COMPANY_DETAILS.pincode}</p>
        <p className="text-sm">Phone: {COMPANY_DETAILS.phone} | Email: {COMPANY_DETAILS.email}</p>
        <p className="text-sm font-semibold mt-1">GSTIN: {COMPANY_DETAILS.gstin} | PAN: {COMPANY_DETAILS.pan}</p>
      </div>

      {/* Invoice Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold border-2 border-black inline-block px-6 py-2">TAX INVOICE</h2>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <p className="font-semibold">Invoice No: <span className="font-normal">{invoiceNumber}</span></p>
          <p className="font-semibold">Invoice Date: <span className="font-normal">{invoiceDate}</span></p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Booking ID: <span className="font-normal">{booking.id.slice(0, 13)}...</span></p>
          <p className="font-semibold">SAC Code: <span className="font-normal">{COMPANY_DETAILS.sacCode}</span></p>
        </div>
      </div>

      {/* Billing Details */}
      <div className="border-2 border-black p-4 mb-6">
        <h3 className="font-bold mb-2">BILLING TO:</h3>
        <p className="font-semibold">{booking.guest_name}</p>
        <p className="text-sm">{booking.guest_email}</p>
        <p className="text-sm">{booking.guest_phone}</p>
      </div>

      {/* Booking Details */}
      <div className="border-2 border-black p-4 mb-6">
        <h3 className="font-bold mb-2">BOOKING DETAILS:</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p>Room Type:</p>
          <p className="font-semibold">{booking.room?.name || 'N/A'}</p>
          <p>Check-in Date:</p>
          <p className="font-semibold">{new Date(booking.check_in).toLocaleDateString('en-IN')}</p>
          <p>Check-out Date:</p>
          <p className="font-semibold">{new Date(booking.check_out).toLocaleDateString('en-IN')}</p>
          <p>Number of Nights:</p>
          <p className="font-semibold">{booking.nights}</p>
          <p>Number of Rooms:</p>
          <p className="font-semibold">{booking.rooms_booked}</p>
        </div>
      </div>

      {/* Charges Table */}
      <table className="w-full border-2 border-black mb-6">
        <thead className="bg-gray-200">
          <tr>
            <th className="border border-black p-2 text-left">Description</th>
            <th className="border border-black p-2 text-right">HSN/SAC</th>
            <th className="border border-black p-2 text-right">Qty</th>
            <th className="border border-black p-2 text-right">Rate</th>
            <th className="border border-black p-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-2">Room Charges ({booking.nights} nights)</td>
            <td className="border border-black p-2 text-right">{COMPANY_DETAILS.sacCode}</td>
            <td className="border border-black p-2 text-right">{booking.rooms_booked}</td>
            <td className="border border-black p-2 text-right">₹{(subtotal / booking.rooms_booked).toLocaleString()}</td>
            <td className="border border-black p-2 text-right font-semibold">₹{subtotal.toLocaleString()}</td>
          </tr>
          <tr>
            <td colSpan={4} className="border border-black p-2 text-right font-semibold">Subtotal:</td>
            <td className="border border-black p-2 text-right font-semibold">₹{subtotal.toLocaleString()}</td>
          </tr>
          <tr>
            <td colSpan={4} className="border border-black p-2 text-right">CGST @ 9%:</td>
            <td className="border border-black p-2 text-right">₹{cgst.toLocaleString()}</td>
          </tr>
          <tr>
            <td colSpan={4} className="border border-black p-2 text-right">SGST @ 9%:</td>
            <td className="border border-black p-2 text-right">₹{sgst.toLocaleString()}</td>
          </tr>
          <tr className="bg-gray-100">
            <td colSpan={4} className="border border-black p-2 text-right font-bold text-lg">TOTAL AMOUNT:</td>
            <td className="border border-black p-2 text-right font-bold text-lg">₹{booking.total_amount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      {/* Amount in Words */}
      <div className="border-2 border-black p-3 mb-6">
        <p className="font-semibold">Amount in Words: <span className="font-normal italic">{amountInWords}</span></p>
      </div>

      {/* Payment Details */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="font-semibold">Payment Status: <span className={`font-normal ${booking.payment_status === 'paid' ? 'text-green-600' : 'text-orange-600'}`}>{booking.payment_status.toUpperCase()}</span></p>
          {booking.payment_id && <p className="font-semibold">Payment ID: <span className="font-normal">{booking.payment_id}</span></p>}
        </div>
        <div className="text-right">
          <p className="font-semibold">For {COMPANY_DETAILS.name}</p>
          <div className="mt-12 border-t-2 border-black inline-block px-6">
            <p className="text-xs">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="border-t-2 border-black pt-4 mt-6">
        <h4 className="font-bold text-sm mb-2">Terms & Conditions:</h4>
        <ul className="text-xs space-y-1">
          <li>• Check-in time: 2:00 PM | Check-out time: 11:00 AM</li>
          <li>• Valid ID proof required at check-in</li>
          <li>• Cancellation charges apply as per policy</li>
          <li>• This is a computer-generated invoice and does not require a signature</li>
        </ul>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 mt-6">
        <p>Thank you for choosing {COMPANY_DETAILS.name}. We look forward to serving you!</p>
      </div>
    </div>
  )
}
