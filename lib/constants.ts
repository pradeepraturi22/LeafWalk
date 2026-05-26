// Company Details for GST Bill
export const COMPANY_DETAILS = {
  name: "Leafwalk Resort",
  address: process.env.COMPANY_ADDRESS || "Vill- Banas, Narad Chatti, Hanuman Chatti",
  city: process.env.COMPANY_CITY || "Yamunotri Road, Uttarkashi",
  state: process.env.COMPANY_STATE || "Uttarakhand",
  pincode: process.env.COMPANY_PINCODE || "249141",
  phone: process.env.COMPANY_PHONE || "+91 8630227541",
  email: process.env.COMPANY_EMAIL || "bookings@leafwalk.in",
  gstin: process.env.COMPANY_GSTIN || "05BFOPR6010R1ZU",
  pan: process.env.COMPANY_PAN || "",
  website: process.env.COMPANY_WEBSITE || "www.leafwalk.in",
  corporateOfficeAddress: process.env.COMPANY_CORPORATE_OFFICE_ADDRESS || "House number:210, Lane No-2, Krishna Puram, Majri Mafi, Dehradun-248005",
  corporateOfficePhone: process.env.COMPANY_CORPORATE_OFFICE_PHONE || "+91-9368080535",
  sacCode: "996311",         // SAC for Hotel accommodation services
  bankAccountName: process.env.COMPANY_BANK_ACCOUNT_NAME || "LeafWalk Resorts",
  bankName: process.env.COMPANY_BANK_NAME || "Punjab National Bank",
  accountNumber: process.env.COMPANY_ACCOUNT_NUMBER || "6408002100001783",
  ifsc: process.env.COMPANY_IFSC || "PUNB0640800",
  branch: process.env.COMPANY_BANK_BRANCH || "Barkot",
}

// GST Rates
export const GST_RATE = 0.05  // 5% total (CGST 2.5% + SGST 2.5%)
export const CGST_RATE = 0.025 // 2.5%
export const SGST_RATE = 0.025 // 2.5%
