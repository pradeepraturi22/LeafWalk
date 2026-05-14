export type InvoicePartyBookingLike = {
  booking_source?: string | null
  guest_name?: string | null
  guest_email?: string | null
  guest_phone?: string | null
  guest_phone_country?: string | null
  guest_address?: string | null
  guest_district?: string | null
  guest_state?: string | null
  guest_country?: string | null
  gst_invoice_requested?: boolean | null
  gst_company_name?: string | null
  gst_number?: string | null
  gst_state?: string | null
  payment_status?: string | null
  tour_operator?: {
    company_name?: string | null
    contact_person?: string | null
    email?: string | null
    phone?: string | null
    gst_number?: string | null
    pan_number?: string | null
    address?: string | null
    city?: string | null
    state?: string | null
  } | null
}

function clean(value?: string | null) {
  return String(value || '').trim()
}

function deriveStateCode(gstNumber?: string | null) {
  const normalized = clean(gstNumber)
  const match = normalized.match(/^(\d{2})/)
  return match ? match[1] : null
}

function buildGuestAddress(booking: InvoicePartyBookingLike) {
  return [
    clean(booking.guest_address),
    clean(booking.guest_district),
    clean(booking.guest_state),
    clean(booking.guest_country) && clean(booking.guest_country) !== 'India' ? clean(booking.guest_country) : '',
  ].filter(Boolean).join(', ')
}

function buildOperatorAddress(booking: InvoicePartyBookingLike) {
  return [
    clean(booking.tour_operator?.address),
    clean(booking.tour_operator?.city),
    clean(booking.tour_operator?.state),
  ].filter(Boolean).join(', ')
}

export function getInvoicePartyName(booking: InvoicePartyBookingLike) {
  return getInvoicePartyMeta(booking).name
}

export function getInvoicePartyMeta(booking: InvoicePartyBookingLike) {
  const guestName = clean(booking.guest_name) || 'Guest'
  const guestEmail = clean(booking.guest_email) || null
  const guestPhoneRaw = `${clean(booking.guest_phone_country)}${clean(booking.guest_phone)}`
  const guestPhone = guestPhoneRaw || null
  const guestAddress = buildGuestAddress(booking) || null

  const companyName = clean(booking.gst_company_name)
  const wantsGstInvoice = Boolean(booking.gst_invoice_requested)
  const isFullyPaid = clean(booking.payment_status).toLowerCase() === 'fully_paid'
  const bookingSource = clean(booking.booking_source).toLowerCase()

  const operator = booking.tour_operator || null
  const operatorName = clean(operator?.company_name) || clean(operator?.contact_person)
  const operatorEmail = clean(operator?.email) || null
  const operatorPhone = clean(operator?.phone) || null
  const operatorAddress = buildOperatorAddress(booking) || null
  const operatorGstNumber = clean(operator?.gst_number) || null
  const operatorState = clean(operator?.state) || null
  const operatorStateCode = deriveStateCode(operatorGstNumber)

  if (isFullyPaid && bookingSource === 'tour_operator' && operatorName) {
    return {
      name: operatorName,
      email: operatorEmail,
      phone: operatorPhone,
      address: operatorAddress,
      gstNumber: operatorGstNumber,
      gstState: operatorState,
      stateCode: operatorStateCode,
      usesCompanyName: true,
      isTourOperatorInvoice: true,
    }
  }

  if (isFullyPaid && wantsGstInvoice && companyName) {
    return {
      name: companyName,
      email: guestEmail,
      phone: guestPhone,
      address: guestAddress,
      gstNumber: clean(booking.gst_number) || null,
      gstState: clean(booking.gst_state) || null,
      stateCode: deriveStateCode(booking.gst_number),
      usesCompanyName: true,
      isTourOperatorInvoice: false,
    }
  }

  return {
    name: guestName,
    email: guestEmail,
    phone: guestPhone,
    address: guestAddress,
    gstNumber: null,
    gstState: null,
    stateCode: null,
    usesCompanyName: false,
    isTourOperatorInvoice: false,
  }
}
