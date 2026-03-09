// types/index.ts - Complete type definitions

export interface User {
  id: string
  email: string
  name: string
  phone: string
  role: 'user' | 'admin' | 'manager'
  created_at: string
  updated_at: string
  email_verified: boolean
  phone_verified: boolean
  avatar_url?: string
}

export interface Room {
  id: string
  name: string
  slug: string
  description: string
  price: number
  max_guests: number
  total_rooms: number
  amenities: string[]
  images: string[]
  featured_image: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Booking {
  id: string
  user_id: string
  room_id: string
  check_in: string
  check_out: string
  nights: number
  guests: number
  rooms_booked: number
  total_amount: number
  booking_status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
  payment_id?: string
  razorpay_order_id?: string
  razorpay_payment_id?: string
  special_requests?: string
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
  payment_method: 'razorpay' | 'cash' | 'bank_transfer'
  razorpay_order_id?: string
  razorpay_payment_id?: string
  razorpay_signature?: string
  status: 'pending' | 'success' | 'failed' | 'refunded'
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  booking_id: string
  user_id: string
  room_id: string
  rating: number
  title: string
  comment: string
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

export interface Inquiry {
  id: string
  name: string
  email: string
  phone: string
  subject: string
  message: string
  status: 'new' | 'in_progress' | 'resolved'
  created_at: string
  updated_at: string
}

export interface BlogPost {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  featured_image: string
  author_id: string
  published: boolean
  published_at?: string
  created_at: string
  updated_at: string
  author?: User
}

export interface Offer {
  id: string
  title: string
  description: string
  discount_percentage: number
  code: string
  valid_from: string
  valid_until: string
  is_active: boolean
  min_nights?: number
  applicable_rooms?: string[]
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
