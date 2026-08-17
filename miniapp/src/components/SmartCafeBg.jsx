import React, { useEffect, useRef, useState } from 'react'

/**
 * SmartCafeBg
 * ------------
 * Context-aware background. Renders a full-screen <img> with a blur+brightness
 * filter, plus a gradient overlay for legibility, plus a warm radial glow.
 *
 * Resolution priority:
 *   1. forceBg prop override
 *   2. Frame+Service combo (e.g. Frame 7 + delivery -> night-taxi)
 *   3. Frame override (e.g. Frame 5,6 -> customer-served)
 *   4. Service override (Frame 1 only: dine_in -> dine-in-cozy, etc.)
 *   5. Day/night auto-detect (6am-6pm = day, else night)
 *
 * Day/night is re-checked every 60 seconds.
 */

const BG_MAP = {
  'night-taxi':        '/backgrounds/night-taxi.png',
  'night-stall':       '/backgrounds/night-stall.png',
  'day-stall':         '/backgrounds/day-stall.png',
  'dine-in-cozy':      '/backgrounds/dine-in-cozy.png',
  'takeaway-bustling': '/backgrounds/takeaway-bustling.png',
  'customer-served':   '/backgrounds/customer-served.png',
}

function resolveBgKey({ frame, serviceType, forceBg }) {
  // 1. explicit override
  if (forceBg && BG_MAP[forceBg]) return forceBg

  // 2. frame + service combo
  if (frame === 7 && serviceType === 'delivery') return 'night-taxi'

  // 3. frame-only override
  if (frame === 5 || frame === 6) return 'customer-served'

  // 4. service override on frame 1
  if (frame === 1) {
    if (serviceType === 'dine_in')   return 'dine-in-cozy'
    if (serviceType === 'takeaway')  return 'takeaway-bustling'
    if (serviceType === 'delivery')  return 'night-taxi'
  }

  // 5. day/night auto-detect
  const hr = new Date().getHours()
  const isDay = hr >= 6 && hr < 18
  return isDay ? 'day-stall' : 'night-stall'
}

function useIsDay() {
  const [isDay, setIsDay] = useState(() => {
    const hr = new Date().getHours()
    return hr >= 6 && hr < 18
  })
  useEffect(() => {
    const id = setInterval(() => {
      const hr = new Date().getHours()
      setIsDay(hr >= 6 && hr < 18)
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return isDay
}

export default function SmartCafeBg({
  serviceType = null,
  frame = null,
  forceBg = null,
  blur = 3,
  brightness = 0.35,
  overlayOpacity = 0.6,
}) {
  // We track the current bg key plus the previous one for crossfade.
  const isDay = useIsDay()
  const [currentKey, setCurrentKey] = useState(() =>
    resolveBgKey({ frame, serviceType, forceBg })
  )
  const [prevKey, setPrevKey] = useState(null)

  useEffect(() => {
    const next = resolveBgKey({ frame, serviceType, forceBg })
    if (next !== currentKey) {
      setPrevKey(currentKey)
      setCurrentKey(next)
      // clear prev after the crossfade completes
      const id = setTimeout(() => setPrevKey(null), 520)
      return () => clearTimeout(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, serviceType, forceBg, isDay])

  const renderImg = (key, opacity) => {
    const src = BG_MAP[key]
    if (!src) return null
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: `blur(${blur}px) brightness(${brightness})`,
          opacity,
          transition: 'opacity 500ms ease',
          transform: 'scale(1.08)', // avoid blurred edge artifacts
          zIndex: 0,
        }}
        onError={(e) => {
          // Hide broken image — overlay still shows.
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        zIndex: 0,
        background: 'var(--bg-primary)',
      }}
      aria-hidden="true"
    >
      {/* Background image (crossfade between prev & current) */}
      {renderImg(prevKey, prevKey ? 0 : 0)}
      {renderImg(currentKey, 1)}

      {/* Gradient overlay — darker purple at night, lighter warm wash by day */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: isDay
            ? `linear-gradient(180deg, rgba(26,15,10,${overlayOpacity * 0.7}) 0%, rgba(26,15,10,${overlayOpacity}) 100%)`
            : `linear-gradient(180deg, rgba(26,15,10,${overlayOpacity * 0.85}) 0%, rgba(20,8,28,${overlayOpacity}) 100%)`,
          zIndex: 1,
        }}
      />

      {/* Warm radial glow centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(212,168,83,0.06) 0%, transparent 60%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
