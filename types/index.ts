export type UserRole = 'user' | 'admin' | 'manager'
export type RoomCategory = 'deluxe' | 'premium'
export type MealPlan = 'EP' | 'CP' | 'MAP' | 'AP'
export type TariffRateType = 'lwweb' | 'b2b' | 'b2c' | 'ota'
export type BookingSource = 'website' | 'direct' | 'walk_in' | 'tour_operator' | 'ota'
export type BookingType = 'lwweb' | 'b2b' | 'b2c'
export type BookingStatus =
  | 'hold'
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show'
  | 'completed'
export type BookingPaymentStatus = 'pending' | 'advance_paid' | 'fully_paid' | 'failed' | 'refunded'
export type RefundStatus = 'pending' | 'processed' | 'not_applicable'
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'razorpay' | 'online'
export type PaymentType = 'advance' | 'balance' | 'full' | 'refund'
export type BookingLedgerPaymentType = 'advance' | 'final' | 'partial' | 'refund' | 'adjustment'
export type OfferDiscountType = 'percentage' | 'fixed'
export type InquiryStatus = 'new' | 'in_progress' | 'resolved'

export interface User {
  id: string
  email: string
  name: string
  phone?: string | null
  role: UserRole
  avatar_url?: string | null
  email_verified: boolean
  phone_verified: boolean
  created_at: string
  updated_at: string
}

export interface Room {
  id: string
  name: string
  slug: string
  category: RoomCategory
  description?: string | null
  price?: number
  max_guests: number
  max_extra_beds?: number
  total_rooms: number
  amenities: string[]
  images: string[]
  featured_image?: string | null
  display_price_from?: number | null
  is_active: boolean
  offer_label?: string | null
  offer_badge_text?: string | null
  offer_discount_percent?: number | null
  offer_is_active?: boolean
  offer_valid_until?: string | null
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  booking_number?: string | null
  user_id?: string | null
  room_id: string
  guest_name: string
  guest_email?: string | null
  guest_phone: string
  guest_phone_country?: string | null
  guest_id_type?: string | null
  guest_id_number?: string | null
  guest_address?: string | null
  guest_state?: string | null
  guest_district?: string | null
  guest_country?: string | null
  booking_source: BookingSource
  booking_type?: BookingType
  check_in: string
  check_out: string
  nights: number
  guests?: number | null
  adults: number
  children_below_5?: number
  children_5_to_12?: number
  children_above_12?: number
  extra_beds?: number
  rooms_booked: number
  meal_plan: MealPlan
  rate_per_room_per_night?: number
  extra_bed_rate_per_night?: number
  child_rate_per_night?: number
  discount_amount?: number
  discount_percent?: number
  discount_reason?: string | null
  promo_code?: string | null
  subtotal?: number | null
  cgst?: number | null
  sgst?: number | null
  gst_total?: number | null
  total_amount: number
  payment_status: BookingPaymentStatus
  advance_amount?: number
  advance_paid_at?: string | null
  balance_amount?: number
  payment_method?: PaymentMethod | null
  payment_id?: string | null
  payment_ref?: string | null
  payment_date?: string | null
  payment_due_date?: string | null
  payment_notes?: string | null
  transaction_number?: string | null
  razorpay_order_id?: string | null
  razorpay_payment_id?: string | null
  razorpay_signature?: string | null
  invoice_number?: string | null
  booking_status: BookingStatus
  confirmed_at?: string | null
  checked_in_at?: string | null
  checked_out_at?: string | null
  cancellation_reason?: string | null
  cancelled_at?: string | null
  refund_amount?: number
  refund_status?: RefundStatus | null
  special_requests?: string | null
  admin_notes?: string | null
  hold_expires_at?: string | null
  hold_notes?: string | null
  held_at?: string | null
  created_at: string
  updated_at: string
  user?: User
  room?: Room
}

export interface Payment {
  id: string
  booking_id: string
  amount: number
  currency: string
  payment_type?: PaymentType | null
  payment_method?: PaymentMethod | null
  transaction_id?: string | null
  razorpay_order_id?: string | null
  razorpay_payment_id?: string | null
  razorpay_signature?: string | null
  status: 'pending' | 'success' | 'failed' | 'refunded'
  notes?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface BookingPaymentLedgerEntry {
  id: number
  booking_id: string
  booking_number?: string | null
  payment_type: BookingLedgerPaymentType
  amount: number
  payment_method?: PaymentMethod | null
  payment_ref?: string | null
  payment_date: string
  payment_due_date?: string | null
  notes?: string | null
  recorded_by?: string | null
  created_at: string
}

export interface Review {
  id: string
  booking_id?: string | null
  user_id?: string | null
  room_id?: string | null
  rating: number
  title?: string | null
  comment: string
  reviewer_name?: string | null
  reviewer_image?: string | null
  review_images?: string[]
  is_approved: boolean
  created_at: string
  updated_at: string
  user?: User
  room?: Room
}

export interface RoomAvailability {
  room_id: string
  date: string
  available_rooms: number
  booked_rooms: number
}

export interface CategoryDailyAvailability {
  date: string
  category: RoomCategory
  total_rooms: number
  booked_rooms: number
  available_rooms: number
}

export interface OtaAvailabilityChannel {
  id: string
  channel_code: string
  channel_name: string
  is_active: boolean
  webhook_url?: string | null
  api_endpoint?: string | null
  auth_type?: string | null
  auth_config?: Record<string, any> | null
  last_sync_at?: string | null
  created_at: string
  updated_at: string
}

export interface OtaAvailabilityOutboxItem {
  id: string
  channel_id: string
  room_category: RoomCategory
  availability_date: string
  total_rooms: number
  booked_rooms: number
  available_rooms: number
  payload?: Record<string, any> | null
  sync_status: 'pending' | 'processing' | 'synced' | 'failed'
  retry_count: number
  last_error?: string | null
  synced_at?: string | null
  created_at: string
  updated_at: string
}

export interface Inquiry {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  status: InquiryStatus
  admin_notes?: string | null
  created_at: string
  updated_at: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt?: string | null
  featured_image?: string | null
  author_id?: string | null
  published: boolean
  published_at?: string | null
  created_at: string
  updated_at: string
  author?: User
}

export interface Offer {
  id: string
  title: string
  description?: string | null
  discount_type: OfferDiscountType
  discount_value: number
  code: string
  valid_from: string
  valid_until: string
  min_nights?: number | null
  max_uses?: number | null
  used_count?: number
  applicable_rooms?: string[]
  applicable_categories?: string[]
  max_discount_amount?: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  total_bookings: number
  total_revenue: number
  pending_bookings: number
  confirmed_bookings: number
  cancelled_bookings: number
  occupancy_rate: number
  average_booking_value: number
  total_users: number
  new_inquiries: number
  pending_reviews: number
}

export interface BookingFormData {
  room_id: string
  check_in: Date
  check_out: Date
  guests: number
  rooms: number
  special_requests?: string
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
}

export interface SignupData {
  email: string
  password: string
  name: string
  phone: string
}

export interface LoginData {
  email: string
  password: string
}

export interface ContactFormData {
  name: string
  email: string
  phone: string
  subject: string
  message: string
}

export interface CheckoutData {
  booking: BookingFormData
  user: {
    name: string
    email: string
    phone: string
  }
  payment_method: 'online' | 'cash'
}

export interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: RazorpayResponse) => void
  prefill: {
    name: string
    email: string
    contact: string
  }
  theme: {
    color: string
  }
}

export interface RazorpayResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}
