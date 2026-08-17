import React, { useEffect, useRef, useState } from 'react'

/**
 * ClocheAnimation
 * ----------------
 * Plays a 9-frame cloche reveal animation.
 *
 * Frames: /cloche/frame-001.png ... /cloche/frame-009.png
 * Each frame is shown for FRAME_DURATION ms (222ms), totalling ~2s.
 * After the last frame, hold for HOLD_MS (400ms) then call onComplete.
 *
 * Steam particles (3 rising circles) appear once currentFrame >= 3.
 *
 * While preloading, a small gold spinner is shown.
 */

const FRAME_COUNT = 9
const FRAME_DURATION = 222 // ms
const HOLD_MS = 400 // ms hold after last frame before onComplete
const STEAM_DELAY = 80 // ms stagger between steam particles

function frameUrl(i) {
  // i is 1..9
  const n = String(i).padStart(3, '0')
  return `/cloche/frame-${n}.png`
}

export default function ClocheAnimation({ onComplete }) {
  const [loaded, setLoaded] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(1)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Preload all 9 frames before playing.
  useEffect(() => {
    let cancelled = false
    Promise.all(
      Array.from({ length: FRAME_COUNT }, (_, i) =>
        new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = frameUrl(i + 1)
        })
      )
    )
      .then(() => {
        if (!cancelled) setLoaded(true)
      })
      .catch(() => {
        // If any frame fails, still proceed (we'll show whatever loaded).
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Play frames once loaded.
  useEffect(() => {
    if (!loaded) return
    let timer = null
    let i = 1

    const tick = () => {
      i += 1
      if (i > FRAME_COUNT) {
        // hold then complete
        timer = setTimeout(() => {
          onCompleteRef.current?.()
        }, HOLD_MS)
        return
      }
      setCurrentFrame(i)
      timer = setTimeout(tick, FRAME_DURATION)
    }

    // Schedule the first advance.
    timer = setTimeout(tick, FRAME_DURATION)
    return () => clearTimeout(timer)
  }, [loaded])

  // ----- Render -----
  if (!loaded) {
    return (
      <div
        style={{
          width: 240,
          height: 240,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Loading"
      >
        <div
          className="anim-spin"
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '3px solid rgba(212,168,83,0.2)',
            borderTopColor: 'var(--accent-gold)',
          }}
        />
      </div>
    )
  }

  // Show only the current frame; steam from frame 3 onwards.
  const showSteam = currentFrame >= 3

  return (
    <div className="cloche-stage" aria-label="Cloche reveal animation">
      <div className="cloche-frame">
        <img src={frameUrl(currentFrame)} alt="" draggable={false} />
      </div>

      {showSteam && (
        <>
          <div
            className="steam-particle"
            style={{
              animation: `clocheSteam 2.4s ease-in-out infinite`,
              animationDelay: '0ms',
              left: '40%',
            }}
          />
          <div
            className="steam-particle"
            style={{
              animation: `clocheSteam 2.4s ease-in-out infinite`,
              animationDelay: `${STEAM_DELAY * 2}ms`,
              left: '50%',
            }}
          />
          <div
            className="steam-particle"
            style={{
              animation: `clocheSteam 2.4s ease-in-out infinite`,
              animationDelay: `${STEAM_DELAY * 4}ms`,
              left: '60%',
            }}
          />
        </>
      )}
    </div>
  )
}
