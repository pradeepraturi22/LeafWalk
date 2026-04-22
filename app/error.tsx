'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-[#0b0b0b] px-6 py-24 text-center text-white">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#c9a14a]">LeafWalk Resort</p>
      <h1 className="font-playfair text-4xl text-white">Something went wrong</h1>
      <p className="mx-auto mt-4 max-w-lg text-white/55">
        We could not load this page safely. Please try again, or contact LeafWalk Resort if the issue continues.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-full bg-[#c9a14a] px-6 py-3 text-sm font-semibold text-black"
      >
        Try Again
      </button>
    </main>
  )
}
