'use client'

import { useEffect, useRef, useState } from 'react'

export default function AnimateZoom({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setActive(true),
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <img
      ref={ref}
      src={src}
      className={`w-full h-full object-cover transition-transform duration-[3000ms]
      ${active ? 'scale-110' : 'scale-100'}`}
      alt=""
    />
  )
}
