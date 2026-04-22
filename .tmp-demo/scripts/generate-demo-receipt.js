"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const booking_email_receipt_pdf_1 = require("../lib/booking-email-receipt-pdf");
const demoBooking = {
    id: 'demo-booking-0001',
    booking_number: 'LWR-DEMO-2026-001',
    guest_name: 'Pradeep Sharma',
    guest_email: 'demo.guest@example.com',
    guest_phone: '9876543210',
    room: { name: 'Premium Cottage', category: 'Cottage' },
    check_in: '2026-04-15',
    check_out: '2026-04-17',
    created_at: '2026-04-09T10:00:00.000Z',
    nights: 2,
    rooms_booked: 1,
    adults: 2,
    meal_plan: 'MAP',
    total_amount: 12500,
    advance_amount: 12500,
    balance_amount: 0,
    booking_status: 'confirmed',
    payment_status: 'fully_paid',
    booking_source: 'website',
};
const outputDir = (0, path_1.join)(process.cwd(), 'tmp');
(0, fs_1.mkdirSync)(outputDir, { recursive: true });
const pdf = (0, booking_email_receipt_pdf_1.createStyledBookingReceiptPdf)(demoBooking);
const outputPath = (0, path_1.join)(outputDir, 'demo-online-booking-receipt.pdf');
(0, fs_1.writeFileSync)(outputPath, pdf);
console.log(outputPath);
