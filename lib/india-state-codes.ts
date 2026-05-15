export type IndiaStateCodeOption = {
  code: string
  name: string
  label: string
}

export const INDIA_STATE_CODE_OPTIONS: IndiaStateCodeOption[] = [
  { code: '01', name: 'Jammu & Kashmir', label: '01 - Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh', label: '02 - Himachal Pradesh' },
  { code: '03', name: 'Punjab', label: '03 - Punjab' },
  { code: '04', name: 'Chandigarh', label: '04 - Chandigarh' },
  { code: '05', name: 'Uttarakhand', label: '05 - Uttarakhand' },
  { code: '06', name: 'Haryana', label: '06 - Haryana' },
  { code: '07', name: 'Delhi', label: '07 - Delhi' },
  { code: '08', name: 'Rajasthan', label: '08 - Rajasthan' },
  { code: '09', name: 'Uttar Pradesh', label: '09 - Uttar Pradesh' },
  { code: '10', name: 'Bihar', label: '10 - Bihar' },
  { code: '11', name: 'Sikkim', label: '11 - Sikkim' },
  { code: '12', name: 'Arunachal Pradesh', label: '12 - Arunachal Pradesh' },
  { code: '13', name: 'Nagaland', label: '13 - Nagaland' },
  { code: '14', name: 'Manipur', label: '14 - Manipur' },
  { code: '15', name: 'Mizoram', label: '15 - Mizoram' },
  { code: '16', name: 'Tripura', label: '16 - Tripura' },
  { code: '17', name: 'Meghalaya', label: '17 - Meghalaya' },
  { code: '18', name: 'Assam', label: '18 - Assam' },
  { code: '19', name: 'West Bengal', label: '19 - West Bengal' },
  { code: '20', name: 'Jharkhand', label: '20 - Jharkhand' },
  { code: '21', name: 'Odisha', label: '21 - Odisha' },
  { code: '22', name: 'Chhattisgarh', label: '22 - Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh', label: '23 - Madhya Pradesh' },
  { code: '24', name: 'Gujarat', label: '24 - Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu', label: '26 - Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra', label: '27 - Maharashtra' },
  { code: '28', name: 'Andhra Pradesh (Old)', label: '28 - Andhra Pradesh (Old)' },
  { code: '29', name: 'Karnataka', label: '29 - Karnataka' },
  { code: '30', name: 'Goa', label: '30 - Goa' },
  { code: '31', name: 'Lakshadweep', label: '31 - Lakshadweep' },
  { code: '32', name: 'Kerala', label: '32 - Kerala' },
  { code: '33', name: 'Tamil Nadu', label: '33 - Tamil Nadu' },
  { code: '34', name: 'Puducherry', label: '34 - Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands', label: '35 - Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana', label: '36 - Telangana' },
  { code: '37', name: 'Andhra Pradesh (New)', label: '37 - Andhra Pradesh (New)' },
  { code: '38', name: 'Ladakh', label: '38 - Ladakh' },
  { code: '97', name: 'Other Territory', label: '97 - Other Territory' },
]

function normalizeStateName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function getIndiaStateCodeByName(value?: string | null) {
  const normalized = normalizeStateName(value)
  if (!normalized) return null
  const found = INDIA_STATE_CODE_OPTIONS.find((option) => normalizeStateName(option.name) === normalized)
  return found?.code || null
}

export function getIndiaStateLabelByName(value?: string | null) {
  const normalized = normalizeStateName(value)
  if (!normalized) return null
  const found = INDIA_STATE_CODE_OPTIONS.find((option) => normalizeStateName(option.name) === normalized)
  return found?.label || null
}
