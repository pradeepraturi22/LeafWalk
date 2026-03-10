'use client'
import React from 'react'
import { useEffect, useRef, useState } from 'react'

export default function AnimateFadeUp({
  children
}: {
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.15 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out
      ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-16'}`}
    >
      {children}
    </div>
  )
}
