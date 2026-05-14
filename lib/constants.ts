// Company Details for GST Bill
export const COMPANY_DETAILS = {
  name: "Leafwalk Resort",
  address: process.env.COMPANY_ADDRESS || "Village Kanatal, Tehri Garhwal",
  city: process.env.COMPANY_CITY || "Uttarakhand",
  state: process.env.COMPANY_STATE || "Uttarakhand",
  pincode: process.env.COMPANY_PINCODE || "249130",
  phone: process.env.COMPANY_PHONE || "+91 8630227541",
  email: process.env.COMPANY_EMAIL || "bookings@leafwalk.in",
  gstin: process.env.COMPANY_GSTIN || "",
  pan: process.env.COMPANY_PAN || "",
  website: process.env.COMPANY_WEBSITE || "www.leafwalk.in",
  sacCode: "996311",         // SAC for Hotel accommodation services
  bankAccountName: process.env.COMPANY_BANK_ACCOUNT_NAME || "",
  bankName: process.env.COMPANY_BANK_NAME || "",
  accountNumber: process.env.COMPANY_ACCOUNT_NUMBER || "",
  ifsc: process.env.COMPANY_IFSC || "",
  branch: process.env.COMPANY_BANK_BRANCH || "",
}

// GST Rates
export const GST_RATE = 0.05  // 5% total (CGST 2.5% + SGST 2.5%)
export const CGST_RATE = 0.025 // 2.5%
export const SGST_RATE = 0.025 // 2.5%
