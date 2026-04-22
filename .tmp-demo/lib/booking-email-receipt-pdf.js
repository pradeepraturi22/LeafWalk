"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStyledBookingReceiptPdf = createStyledBookingReceiptPdf;
const jspdf_1 = require("jspdf");
const utils_1 = require("@/lib/utils");
const COLORS = {
    forest: [15, 28, 15],
    gold: [201, 161, 74],
    ink: [24, 24, 27],
    muted: [107, 114, 128],
    border: [229, 231, 235],
    soft: [249, 250, 251],
    successBg: [220, 252, 231],
    successInk: [22, 101, 52],
    warnBg: [254, 243, 199],
    warnInk: [146, 64, 14],
    dangerBg: [254, 226, 226],
    dangerInk: [153, 27, 27],
};
const RESORT = {
    name: 'LEAFWALK RESORT',
    subtitle: 'Stay in Lap of Nature',
    address: 'Vill- Banas, Narad Chatti, Hanuman Chatti',
    city: 'Yamunotri Road, Uttarkashi, Uttarakhand - 249193',
    phone: '+91-9368080535 | +91-8630227541',
    email: 'info@leafwalk.in',
    website: 'www.leafwalk.in',
};
const MEAL_LABELS = {
    EP: 'Room Only (EP)',
    CP: 'With Breakfast (CP)',
    MAP: 'Breakfast + Dinner (MAP)',
    AP: 'All Meals (AP)',
};
function amount(value) {
    return `INR ${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function statusBadge(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'fully_paid')
        return { bg: COLORS.successBg, ink: COLORS.successInk, label: 'FULLY PAID' };
    if (normalized === 'advance_paid')
        return { bg: COLORS.warnBg, ink: COLORS.warnInk, label: 'ADVANCE PAID' };
    if (normalized === 'confirmed')
        return { bg: COLORS.successBg, ink: COLORS.successInk, label: 'CONFIRMED' };
    if (normalized === 'checked_in')
        return { bg: COLORS.successBg, ink: COLORS.successInk, label: 'CHECKED IN' };
    if (normalized === 'hold')
        return { bg: COLORS.warnBg, ink: COLORS.warnInk, label: 'ON HOLD' };
    if (normalized === 'cancelled')
        return { bg: COLORS.dangerBg, ink: COLORS.dangerInk, label: 'CANCELLED' };
    return { bg: COLORS.warnBg, ink: COLORS.warnInk, label: (normalized || 'pending').replace(/_/g, ' ').toUpperCase() };
}
function setFill(doc, color) {
    doc.setFillColor(color[0], color[1], color[2]);
}
function setDraw(doc, color) {
    doc.setDrawColor(color[0], color[1], color[2]);
}
function setText(doc, color) {
    doc.setTextColor(color[0], color[1], color[2]);
}
function writeLabelValue(doc, x, y, label, value, width = 78) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(doc, COLORS.muted);
    doc.text(label.toUpperCase(), x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    setText(doc, COLORS.ink);
    const lines = doc.splitTextToSize(value || '-', width);
    doc.text(lines, x, y + 5);
    return y + 5 + lines.length * 4.5;
}
function drawBadge(doc, x, y, text, bg, ink) {
    const width = Math.max(28, doc.getTextWidth(text) + 8);
    setFill(doc, bg);
    setDraw(doc, bg);
    doc.roundedRect(x, y, width, 8, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    setText(doc, ink);
    doc.text(text, x + width / 2, y + 5.4, { align: 'center' });
}
function createStyledBookingReceiptPdf(booking) {
    const doc = new jspdf_1.jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const right = 178;
    const bookingRef = booking.booking_number || booking.id.slice(0, 8).toUpperCase();
    const issueDate = (0, utils_1.formatDate)(booking.created_at || new Date().toISOString());
    const checkIn = (0, utils_1.formatDate)(booking.check_in);
    const checkOut = (0, utils_1.formatDate)(booking.check_out);
    const mealPlan = MEAL_LABELS[String(booking.meal_plan || '').toUpperCase()] || booking.meal_plan || 'EP';
    const bookingBadge = statusBadge(booking.booking_status);
    const paymentBadge = statusBadge(booking.payment_status);
    const total = Number(booking.total_amount || 0);
    const paid = Number(booking.advance_amount || 0);
    const balance = Number(booking.balance_amount || 0);
    setFill(doc, COLORS.forest);
    doc.rect(0, 0, pageWidth, 30, 'F');
    setText(doc, COLORS.gold);
    doc.setFont('times', 'bold');
    doc.setFontSize(23);
    doc.text(RESORT.name, 16, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(RESORT.subtitle.toUpperCase(), 16, 19);
    setText(doc, [220, 220, 220]);
    doc.setFontSize(8.5);
    doc.text(RESORT.address, right, 10, { align: 'right' });
    doc.text(RESORT.city, right, 14, { align: 'right' });
    doc.text(RESORT.phone, right, 18, { align: 'right' });
    doc.text(`${RESORT.email} | ${RESORT.website}`, right, 22, { align: 'right' });
    setFill(doc, COLORS.gold);
    doc.rect(0, 30, pageWidth, 1.4, 'F');
    setFill(doc, COLORS.soft);
    setDraw(doc, COLORS.border);
    doc.roundedRect(15, 38, 180, 18, 3, 3, 'FD');
    doc.setFont('times', 'bold');
    doc.setFontSize(18);
    setText(doc, COLORS.ink);
    doc.text('Booking Receipt', 20, 46);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setText(doc, COLORS.muted);
    doc.text(`Receipt Ref: ${bookingRef}`, right, 44, { align: 'right' });
    doc.text(`Issued On: ${issueDate}`, right, 49, { align: 'right' });
    drawBadge(doc, 15, 61, bookingBadge.label, bookingBadge.bg, bookingBadge.ink);
    drawBadge(doc, 48, 61, paymentBadge.label, paymentBadge.bg, paymentBadge.ink);
    setDraw(doc, COLORS.border);
    doc.roundedRect(15, 74, 88, 36, 3, 3);
    doc.roundedRect(107, 74, 88, 36, 3, 3);
    writeLabelValue(doc, 20, 82, 'Guest Name', booking.guest_name || '-', 72);
    writeLabelValue(doc, 20, 94, 'Email', booking.guest_email || '-', 72);
    writeLabelValue(doc, 20, 106, 'Phone', booking.guest_phone || '-', 72);
    writeLabelValue(doc, 112, 82, 'Check-in', checkIn, 72);
    writeLabelValue(doc, 112, 94, 'Check-out', checkOut, 72);
    writeLabelValue(doc, 112, 106, 'Stay', `${Number(booking.nights || 0)} nights | ${Number(booking.rooms_booked || 1)} room(s)`, 72);
    doc.roundedRect(15, 118, 180, 28, 3, 3);
    writeLabelValue(doc, 20, 126, 'Room Type', booking.room?.name || booking.room?.category || '-', 52);
    writeLabelValue(doc, 78, 126, 'Meal Plan', mealPlan, 44);
    writeLabelValue(doc, 126, 126, 'Guests', `${Number(booking.adults || 1)} adult(s)`, 28);
    writeLabelValue(doc, 160, 126, 'Source', String(booking.booking_source || 'direct').replace(/_/g, ' '), 28);
    doc.roundedRect(15, 154, 118, 60, 3, 3);
    setFill(doc, COLORS.soft);
    doc.roundedRect(15, 154, 118, 10, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(doc, COLORS.muted);
    doc.text('STAY DETAILS', 20, 160.5);
    setText(doc, COLORS.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(`Booking Reference: ${bookingRef}`, 20, 172);
    doc.text(`Room: ${booking.room?.name || booking.room?.category || '-'}`, 20, 180);
    doc.text(`Meal Plan: ${mealPlan}`, 20, 188);
    doc.text(`Check-in: ${checkIn}`, 20, 196);
    doc.text(`Check-out: ${checkOut}`, 20, 204);
    doc.roundedRect(138, 154, 57, 60, 3, 3);
    setFill(doc, COLORS.soft);
    doc.roundedRect(138, 154, 57, 10, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(doc, COLORS.muted);
    doc.text('PAYMENT SUMMARY', 142, 160.5);
    const paymentRows = [
        ['Booking Total', amount(total)],
        ['Amount Paid', amount(paid)],
        ['Balance Due', amount(balance)],
    ];
    let payY = 172;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    paymentRows.forEach(([label, value]) => {
        setText(doc, COLORS.muted);
        doc.text(label, 142, payY);
        setText(doc, COLORS.ink);
        doc.setFont('helvetica', 'bold');
        doc.text(value, 190, payY, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        payY += 9;
    });
    setFill(doc, COLORS.forest);
    doc.roundedRect(138, 198, 57, 12, 2, 2, 'F');
    setText(doc, COLORS.gold);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(amount(total), 190, 206, { align: 'right' });
    doc.roundedRect(15, 222, 180, 34, 3, 3);
    setFill(doc, COLORS.soft);
    doc.roundedRect(15, 222, 180, 10, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setText(doc, COLORS.muted);
    doc.text('IMPORTANT NOTES', 20, 228.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setText(doc, COLORS.ink);
    const notes = [
        'This receipt is system generated and valid without physical signature.',
        'Standard check-in is after 3:00 PM and check-out is before 11:00 AM.',
        'Please carry a valid government ID for all staying guests.',
        'For assistance contact LeafWalk Resort at +91-9368080535.',
    ];
    let notesY = 238;
    notes.forEach((note) => {
        doc.text(`- ${note}`, 20, notesY);
        notesY += 5.4;
    });
    setFill(doc, COLORS.soft);
    doc.rect(0, 279, pageWidth, 18, 'F');
    setDraw(doc, COLORS.border);
    doc.line(15, 279, 195, 279);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    setText(doc, COLORS.muted);
    doc.text('LeafWalk Resort | info@leafwalk.in | www.leafwalk.in', 15, 286);
    doc.setFont('times', 'bold');
    doc.setFontSize(13);
    setText(doc, COLORS.gold);
    doc.text('Thank you for booking with LeafWalk Resort', 195, 286, { align: 'right' });
    return Buffer.from(doc.output('arraybuffer'));
}
