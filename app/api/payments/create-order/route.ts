import { NextRequest, NextResponse } from 'next/server'
import Razorpay from 'razorpay'

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, receipt, notes } = body

    // Validate amount
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      )
    }

    // Validate API keys
    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay API keys not configured')
      return NextResponse.json(
        { error: 'Payment gateway not configured' },
        { status: 500 }
      )
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
      notes: notes || {}
    })

    console.log('Order created successfully:', order.id)

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      }
    })

  } catch (error: any) {
    console.error('Error creating Razorpay order:', error)
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create order',
        details: error.error?.description || 'Please check your payment configuration'
      },
      { status: 500 }
    )
  }
}