// lib/validations.ts - Zod validation schemas

import { z } from 'zod'

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})

// Booking schema
export const bookingSchema = z.object({
  room_id: z.string().uuid('Invalid room ID'),
  check_in: z.date().min(new Date(), 'Check-in date must be in the future'),
  check_out: z.date(),
  guests: z.number().min(1, 'At least 1 guest required').max(20, 'Maximum 20 guests'),
  rooms: z.number().min(1, 'At least 1 room required').max(10, 'Maximum 10 rooms'),
  special_requests: z.string().max(500, 'Special requests too long').optional()
}).refine((data) => data.check_out > data.check_in, {
  message: 'Check-out must be after check-in',
  path: ['check_out']
})

// Contact form schema
export const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number'),
  subject: z.string().min(5, 'Subject must be at least 5 characters'),
  message: z.string().min(20, 'Message must be at least 20 characters').max(1000, 'Message too long')
})

// Review schema
export const reviewSchema = z.object({
  booking_id: z.string().uuid('Invalid booking ID'),
  rating: z.number().min(1, 'Rating required').max(5, 'Maximum rating is 5'),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title too long'),
  comment: z.string().min(20, 'Comment must be at least 20 characters').max(1000, 'Comment too long')
})

// Room schema (admin)
export const roomSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  price: z.number().min(100, 'Price must be at least ₹100'),
  max_guests: z.number().min(1, 'At least 1 guest capacity required'),
  total_rooms: z.number().min(1, 'At least 1 room required'),
  amenities: z.array(z.string()).min(1, 'At least one amenity required')
})

// Offer schema
export const offerSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  discount_percentage: z.number().min(1, 'Discount must be at least 1%').max(100, 'Discount cannot exceed 100%'),
  code: z.string().min(3, 'Code must be at least 3 characters').max(20, 'Code too long'),
  valid_from: z.date(),
  valid_until: z.date()
}).refine((data) => data.valid_until > data.valid_from, {
  message: 'Valid until must be after valid from',
  path: ['valid_until']
})

// Profile update schema
export const profileUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid phone number').optional(),
  avatar_url: z.string().url('Invalid URL').optional()
})

// Password change schema
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, 'Current password required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
})
