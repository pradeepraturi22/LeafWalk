'use client'

import { useEffect } from 'react'

function isProtectedElement(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('img, video'))
}

export default function MediaProtection() {
  useEffect(() => {
    const preventContextMenu = (event: MouseEvent) => {
      if (isProtectedElement(event.target)) {
        event.preventDefault()
      }
    }

    const preventDrag = (event: DragEvent) => {
      if (isProtectedElement(event.target)) {
        event.preventDefault()
      }
    }

    const preventSaveShortcuts = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const ctrlOrMeta = event.ctrlKey || event.metaKey
      if (
        key === 'f12' ||
        (ctrlOrMeta && key === 's') ||
        (ctrlOrMeta && event.shiftKey && ['i', 'j', 'c'].includes(key))
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const addProtectionAttrs = () => {
      document.querySelectorAll('img').forEach((node) => {
        node.setAttribute('draggable', 'false')
      })
      document.querySelectorAll('video').forEach((node) => {
        node.setAttribute('controlsList', 'nodownload noremoteplayback nofullscreen')
        node.setAttribute('disablePictureInPicture', 'true')
        node.setAttribute('playsinline', 'true')
      })
    }

    const observer = new MutationObserver(() => addProtectionAttrs())
    addProtectionAttrs()
    observer.observe(document.body, { childList: true, subtree: true })

    document.addEventListener('contextmenu', preventContextMenu, true)
    document.addEventListener('dragstart', preventDrag, true)
    document.addEventListener('keydown', preventSaveShortcuts, true)

    return () => {
      observer.disconnect()
      document.removeEventListener('contextmenu', preventContextMenu, true)
      document.removeEventListener('dragstart', preventDrag, true)
      document.removeEventListener('keydown', preventSaveShortcuts, true)
    }
  }, [])

  return null
}
