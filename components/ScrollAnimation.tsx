'use client'

import { useEffect } from 'react'

export default function ScrollAnimation() {
  useEffect(() => {
    const elements = document.querySelectorAll(
      '.fade-up, .fade-left, .fade-right, .fade-in'
    )

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('show')
          }
        })
      },
      { threshold: 0.2 }
    )

    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return null
}
