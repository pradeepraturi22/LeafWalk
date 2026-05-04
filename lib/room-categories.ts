export const PUBLIC_ROOM_CATEGORIES = ['deluxe', 'premium'] as const
export const ADMIN_ROOM_CATEGORIES = [...PUBLIC_ROOM_CATEGORIES, 'super_deluxe'] as const

export type PublicRoomCategory = (typeof PUBLIC_ROOM_CATEGORIES)[number]
export type AdminRoomCategory = (typeof ADMIN_ROOM_CATEGORIES)[number]

export function isPublicRoomCategory(value: unknown): value is PublicRoomCategory {
  return PUBLIC_ROOM_CATEGORIES.includes(String(value || '').trim().toLowerCase() as PublicRoomCategory)
}

export function isAdminRoomCategory(value: unknown): value is AdminRoomCategory {
  return ADMIN_ROOM_CATEGORIES.includes(String(value || '').trim().toLowerCase() as AdminRoomCategory)
}

export function getRoomCategoryOrder(category: string) {
  if (category === 'premium') return 0
  if (category === 'deluxe') return 1
  if (category === 'super_deluxe') return 2
  return 10
}

export function getRoomCategoryLabel(category: string) {
  if (category === 'super_deluxe') return 'Super Deluxe'
  if (category === 'premium') return 'Premium'
  if (category === 'deluxe') return 'Deluxe'
  return category
}
