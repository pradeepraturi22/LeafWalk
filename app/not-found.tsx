import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#0b0b0b] px-6 py-24 text-center text-white">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#c9a14a]">404</p>
      <h1 className="font-playfair text-4xl text-white">Page not found</h1>
      <p className="mx-auto mt-4 max-w-lg text-white/55">
        The page you are looking for is unavailable or may have moved.
      </p>
      <Link href="/" className="mt-8 inline-flex rounded-full bg-[#c9a14a] px-6 py-3 text-sm font-semibold text-black">
        Back to Home
      </Link>
    </main>
  )
}
