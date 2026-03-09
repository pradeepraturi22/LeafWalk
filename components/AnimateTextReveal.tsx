'use client'

import { useEffect, useRef, useState } from 'react'

export default function AnimateTextReveal({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setShow(true),
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <h2
      ref={ref}
      className={`overflow-hidden font-serif transition-all duration-1000
      ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      {text}
    </h2>
  )
}
