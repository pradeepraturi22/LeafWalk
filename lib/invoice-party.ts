export type InvoicePartyBookingLike = {
  guest_name?: string | null
  gst_invoice_requested?: boolean | null
  gst_company_name?: string | null
  gst_number?: string | null
  gst_state?: string | null
  payment_status?: string | null
}

export function getInvoicePartyName(booking: InvoicePartyBookingLike) {
  const guestName = String(booking.guest_name || '').trim() || 'Guest'
  const companyName = String(booking.gst_company_name || '').trim()
  const wantsGstInvoice = Boolean(booking.gst_invoice_requested)
  const isFullyPaid = String(booking.payment_status || '').trim().toLowerCase() === 'fully_paid'

  if (isFullyPaid && wantsGstInvoice && companyName) {
    return companyName
  }

  return guestName
}

export function getInvoicePartyMeta(booking: InvoicePartyBookingLike) {
  return {
    name: getInvoicePartyName(booking),
    gstNumber: String(booking.gst_number || '').trim() || null,
    gstState: String(booking.gst_state || '').trim() || null,
    usesCompanyName:
      Boolean(booking.gst_invoice_requested) &&
      String(booking.payment_status || '').trim().toLowerCase() === 'fully_paid' &&
      Boolean(String(booking.gst_company_name || '').trim()),
  }
}
