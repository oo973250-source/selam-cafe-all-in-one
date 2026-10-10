// Shared internal-scroll container with a far-left scroll indicator (per mocks).
//   variant="capsule" → wide outlined rail + white pill thumb (Pages 3 & 4)
//   variant="thin"    → slim rail + small subtle thumb, browser-style (Page 5)
// The thumb is hidden when content fits; size = visible/total ratio; position
// tracks scrollTop; ResizeObserver keeps it correct after refetches.
import React, { useCallback, useEffect, useRef, useState } from 'react'

export default function VScroll({ children, variant = 'capsule' }) {
  const viewRef = useRef(null)
  const [thumb, setThumb] = useState({ show: false, h: 0, y: 0 })

  const update = useCallback(() => {
    const el = viewRef.current
    if (!el) return
    const { clientHeight, scrollHeight, scrollTop } = el
    if (scrollHeight <= clientHeight + 4) {
      setThumb((t) => (t.show ? { ...t, show: false } : t))
      return
    }
    const min = variant === 'thin' ? 22 : 30
    const h = Math.max(min, (clientHeight / scrollHeight) * clientHeight)
    const maxScroll = scrollHeight - clientHeight
    const y = maxScroll > 0 ? (scrollTop / maxScroll) * (clientHeight - h) : 0
    setThumb({ show: true, h, y })
  }, [variant])

  useEffect(() => {
    update()
    const el = viewRef.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [update])

  return (
    <div className={`vscroll ${variant === 'thin' ? 'vscroll-thin' : ''}`}>
      <div className="vscroll-track" aria-hidden="true">
        {thumb.show && (
          <div className="vscroll-thumb" style={{ height: thumb.h, transform: `translateY(${thumb.y}px)` }} />
        )}
      </div>
      <div className="vscroll-view" ref={viewRef}>
        {children}
      </div>
    </div>
  )
}
