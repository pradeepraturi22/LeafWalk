import { GST_RATE, CGST_RATE, SGST_RATE } from './constants'

export interface GSTCalculation {
  baseAmount: number
  subtotal: number
  gstTotal: number
  cgst: number
  sgst: number
  totalAmount: number
}

export function calculateGST(baseAmount: number): GSTCalculation {
  const subtotal = Math.round(baseAmount / (1 + GST_RATE) * 100) / 100
  const gstTotal = baseAmount - subtotal
  const cgst = Math.round(gstTotal / 2 * 100) / 100
  const sgst = cgst

  return {
    baseAmount,
    subtotal,
    gstTotal,
    cgst,
    sgst,
    totalAmount: baseAmount
  }
}

export function calculateGSTFromSubtotal(subtotal: number): GSTCalculation {
  const cgst = Math.round(subtotal * CGST_RATE * 100) / 100
  const sgst = Math.round(subtotal * SGST_RATE * 100) / 100
  const gstTotal = cgst + sgst
  const totalAmount = subtotal + gstTotal

  return {
    baseAmount: totalAmount,
    subtotal,
    gstTotal,
    cgst,
    sgst,
    totalAmount
  }
}

export function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']

  function convert(n: number): string {
    if (n === 0) return ''
    if (n < 10) return ones[n]
    if (n < 20) return teens[n - 10]
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '')
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '')
    return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '')
  }

  if (num === 0) return 'Zero'
  return convert(Math.floor(num)) + ' Rupees Only'
}

export function generateInvoiceNumber(sequenceNumber: number, fiscalYear?: string): string {
  const year = fiscalYear || getCurrentFiscalYear()
  return `LWR/${year}/${String(sequenceNumber).padStart(4, '0')}`
}

export function getCurrentFiscalYear(): string {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(-2)}`
  } else {
    return `${year - 1}-${String(year).slice(-2)}`
  }
}
