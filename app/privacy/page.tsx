import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | LeafWalk Resort',
  description: 'Privacy policy for LeafWalk Resort. How we collect, use, and protect your personal information.',
  alternates: { canonical: 'https://leafwalk.in/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0b0b0b] py-16 px-6">
      <div className="max-w-3xl mx-auto">

        <div className="mb-12">
          <p className="text-[#c9a14a] text-xs uppercase tracking-[0.3em] font-semibold mb-3">Legal</p>
          <h1 className="font-playfair text-5xl text-white mb-4">Privacy Policy</h1>
          <p className="text-white/45 text-sm">Last updated: January 2025 · LeafWalk Resort, Uttarkashi</p>
        </div>

        <div className="space-y-10 text-white/65 text-sm leading-relaxed">

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">1. Introduction</h2>
            <p>LeafWalk Resort ("we", "us", "our") is committed to protecting your privacy. This policy explains how we collect, use, store, and protect your personal information when you use our website leafwalk.in or make a booking with us.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-white/80 font-semibold mb-2">Information you provide directly:</h3>
                <ul className="space-y-1.5">
                  <li>• Name, email address, and phone number (for booking)</li>
                  <li>• Government ID details (required at check-in per law)</li>
                  <li>• Payment information (processed securely via Razorpay)</li>
                  <li>• Special requests or preferences</li>
                </ul>
              </div>
              <div>
                <h3 className="text-white/80 font-semibold mb-2">Information collected automatically:</h3>
                <ul className="space-y-1.5">
                  <li>• Browser type and device information</li>
                  <li>• IP address and approximate location</li>
                  <li>• Pages visited and time spent on site</li>
                  <li>• Referral source</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">3. How We Use Your Information</h2>
            <ul className="space-y-2">
              <li>• To process and confirm your booking</li>
              <li>• To send booking confirmation and updates via WhatsApp/email</li>
              <li>• To provide customer support</li>
              <li>• To comply with legal requirements (government reporting for tourism)</li>
              <li>• To improve our website and services</li>
              <li>• To send promotional offers (only with your consent)</li>
              <li>• To prevent fraud and ensure security</li>
            </ul>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">4. Payment Security</h2>
            <p>We do not store your credit/debit card information. All payments are processed through <strong className="text-white/80">Razorpay</strong>, which is PCI DSS compliant. Your payment data is encrypted using industry-standard SSL/TLS technology.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">5. Data Sharing</h2>
            <p className="mb-3">We do not sell, rent, or trade your personal information. We may share your data only with:</p>
            <ul className="space-y-2">
              <li>• <strong className="text-white/80">Razorpay</strong> — for payment processing</li>
              <li>• <strong className="text-white/80">Government authorities</strong> — as required by law (e.g., tourist registration)</li>
              <li>• <strong className="text-white/80">Service providers</strong> — who help us operate our business (under strict confidentiality)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">6. Data Retention</h2>
            <p>We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy and to comply with legal obligations. Booking records are retained for 7 years as required by Indian tax laws.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">7. Cookies</h2>
            <p>Our website uses cookies to improve user experience, remember preferences, and analyze traffic. You can control cookie settings in your browser. Essential cookies are necessary for the website to function properly.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">8. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="space-y-2">
              <li>• Access the personal data we hold about you</li>
              <li>• Request correction of inaccurate data</li>
              <li>• Request deletion of your data (subject to legal requirements)</li>
              <li>• Opt out of promotional communications at any time</li>
              <li>• Lodge a complaint with relevant authorities</li>
            </ul>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">9. Children's Privacy</h2>
            <p>Our services are not directed at children under 18 years of age. We do not knowingly collect personal information from minors without parental consent.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">10. WhatsApp Communication</h2>
            <p>By providing your phone number during booking, you consent to receiving booking confirmations, reminders, and updates via WhatsApp from LeafWalk Resort. You can opt out at any time by replying "STOP".</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">11. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Changes will be posted on this page with an updated date. Continued use of our services after changes constitutes acceptance of the new policy.</p>
          </section>

          <section>
            <h2 className="font-playfair text-2xl text-white mb-4">12. Contact Us</h2>
            <p className="mb-3">For privacy-related queries or to exercise your rights:</p>
            <div className="p-4 bg-white/3 border border-white/10 rounded-xl space-y-1.5">
              <p className="text-white/80 font-semibold">LeafWalk Resort — Data Controller</p>
              <p>Vill- Banas, Narad Chatti, Hanuman Chatti, Uttarkashi, Uttarakhand — 249193</p>
              <p>📞 <a href="tel:+919368080535" className="text-[#c9a14a]">+91-9368080535</a></p>
              <p>✉ <a href="mailto:info@leafwalk.in" className="text-[#c9a14a]">info@leafwalk.in</a></p>
            </div>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex gap-4 text-sm">
          <Link href="/terms" className="text-[#c9a14a] hover:underline">Terms & Conditions</Link>
          <span className="text-white/20">·</span>
          <Link href="/rooms" className="text-white/40 hover:text-[#c9a14a] transition-colors">Book a Room</Link>
          <span className="text-white/20">·</span>
          <Link href="/" className="text-white/40 hover:text-[#c9a14a] transition-colors">← Home</Link>
        </div>
      </div>
    </div>
  )
}
