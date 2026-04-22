import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions | LeafWalk Resort',
  description: 'Terms and conditions, booking policies, cancellation policy, and refund policy for LeafWalk Resort, Uttarkashi, Uttarakhand.',
  alternates: { canonical: 'https://leafwalk.in/terms' },
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0b0b0b] py-16 px-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.3em] font-semibold mb-3">Legal</p>
          <h1 className="font-playfair text-5xl text-white mb-4">Terms &amp; Conditions</h1>
          <p className="text-white/45 text-sm">Last updated: January 2025 · LeafWalk Resort, Uttarkashi, Uttarakhand</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-10 text-white/65 text-sm leading-relaxed">

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">1. Acceptance of Terms</h2>
            <p>By making a booking at LeafWalk Resort (hereinafter "the Resort") through our website leafwalk.in, by phone, WhatsApp, or any other channel, you agree to be bound by these Terms & Conditions. Please read them carefully before booking.</p>
          </section>

          <section id="checkin">
            <h2 className="font-playfair text-2xl text-white mb-4">2. Check-in &amp; Check-out Policy</h2>
            <ul className="space-y-2">
              <li>• <strong className="text-white/80">Check-in time:</strong> 3:00 PM (15:00). Early check-in subject to availability.</li>
              <li>• <strong className="text-white/80">Check-out time:</strong> 11:00 AM. Late check-out subject to availability and additional charges.</li>
              <li>• Valid government-issued photo ID (Aadhaar, Passport, Driving License, Voter ID) is mandatory for all adult guests at check-in.</li>
              <li>• The Resort reserves the right to refuse check-in if valid ID is not presented.</li>
              <li>• Guests must complete check-in formalities within 2 hours of arrival.</li>
            </ul>
          </section>

          <section id="cancellation">
            <h2 className="font-playfair text-2xl text-white mb-4">3. Cancellation Policy</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/15">
                    <th className="text-left py-3 pr-6 text-white/70 font-semibold">Cancellation Period</th>
                    <th className="text-left py-3 text-white/70 font-semibold">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {[
                    ['More than 7 days before check-in', 'Full refund (100%)'],
                    ['3–7 days before check-in', '50% refund'],
                    ['Less than 3 days before check-in', 'No refund (0%)'],
                    ['No-show', 'No refund'],
                    ['Peak season (Dec 20 – Jan 10 & May–Jun)', 'Non-refundable'],
                  ].map(([period, refund]) => (
                    <tr key={period}>
                      <td className="py-3 pr-6 text-white/60">{period}</td>
                      <td className="py-3 text-white/80">{refund}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-white/45 text-xs">All cancellations must be made in writing via email to info@leafwalk.in or WhatsApp to +91-9368080535.</p>
          </section>

          <section id="refund">
            <h2 className="font-playfair text-2xl text-white mb-4">4. Refund Policy</h2>
            <ul className="space-y-2">
              <li>• Eligible refunds will be processed within 5–7 business days to the original payment method.</li>
              <li>• Razorpay transaction charges (if any) are non-refundable.</li>
              <li>• Refunds for cash payments will be made via bank transfer (NEFT/IMPS).</li>
              <li>• In case of natural calamity, road blockage, or force majeure events, full credit note will be issued valid for 1 year.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">5. Booking &amp; Payment</h2>
            <ul className="space-y-2">
              <li>• Bookings are confirmed only after full payment is received.</li>
              <li>• Prices are quoted in Indian Rupees (INR) and include 12% GST unless stated otherwise.</li>
              <li>• The Resort accepts: Cash, UPI, Credit/Debit Cards, Net Banking, and Bank Transfer.</li>
              <li>• Online payments are processed securely through Razorpay.</li>
              <li>• Booking confirmation will be sent via WhatsApp/email within 30 minutes of payment.</li>
            </ul>
          </section>

          <section id="children">
            <h2 className="font-playfair text-2xl text-white mb-4">6. Children Policy</h2>
            <ul className="space-y-2">
              <li>• Children below 5 years — complimentary (no extra bed).</li>
              <li>• Children 5–12 years — 30% of adult rate (with extra bed).</li>
              <li>• Children above 12 years — charged as adults.</li>
              <li>• Maximum 2 children per room.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">7. General Rules</h2>
            <ul className="space-y-2">
              <li>• Smoking is strictly prohibited inside rooms. Designated areas available outside.</li>
              <li>• Outside food and beverages are not allowed on resort premises.</li>
              <li>• Pets are not allowed inside the resort.</li>
              <li>• The Resort is not responsible for loss of valuables. Safe deposit available at front desk.</li>
              <li>• Guests are responsible for any damage caused to resort property during their stay.</li>
              <li>• Noise is not permitted after 10:00 PM in respect of other guests.</li>
              <li>• The Resort reserves the right to terminate the stay of any guest found violating rules.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">8. Liability</h2>
            <p>LeafWalk Resort shall not be liable for any indirect, incidental, or consequential damages. Trekking, outdoor activities, and adventure sports are undertaken at the guest's own risk. The Resort recommends adequate travel insurance.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">9. Privacy</h2>
            <p>Your personal information is handled as described in our <Link href="/privacy" className="text-[#c9a14a] hover:underline">Privacy Policy</Link>.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">10. Governing Law</h2>
            <p>These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Uttarkashi, Uttarakhand.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">11. Contact</h2>
            <p>For any queries regarding these terms, please contact:</p>
            <div className="mt-3 p-4 bg-white/3 border border-white/10 rounded-xl space-y-1.5">
              <p className="text-white/70"><strong className="text-white/80">LeafWalk Resort</strong></p>
              <p>Vill- Banas, Narad Chatti, Hanuman Chatti, Yamunotri Road, Uttarkashi — 249193</p>
              <p>📞 <a href="tel:+919368080535" className="text-[#c9a14a]">+91-9368080535</a></p>
              <p>✉ <a href="mailto:info@leafwalk.in" className="text-[#c9a14a]">info@leafwalk.in</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex gap-4 text-sm">
          <Link href="/privacy" className="text-[#c9a14a] hover:underline">Privacy Policy</Link>
          <span className="text-white/20">·</span>
          <Link href="/rooms" className="text-white/40 hover:text-[#c9a14a] transition-colors">Book a Room</Link>
          <span className="text-white/20">·</span>
          <Link href="/" className="text-white/40 hover:text-[#c9a14a] transition-colors">← Home</Link>
        </div>
      </div>
    </div>
  )
}
