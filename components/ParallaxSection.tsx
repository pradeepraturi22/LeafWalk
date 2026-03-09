'use client'

import { useEffect, useState } from 'react'

export default function ParallaxSection({
  bg,
  children
}: {
  bg: string
  children: React.ReactNode
}) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY * 0.3)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section
      style={{
        backgroundImage: `url(${bg})`,
        backgroundPositionY: `${offset}px`
      }}
      className="bg-cover bg-center min-h-[70vh] flex items-center justify-center"
    >
      {children}
    </section>
  )
}
