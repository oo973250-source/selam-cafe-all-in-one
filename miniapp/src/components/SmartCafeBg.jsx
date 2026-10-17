import React from 'react'

/**
 * SmartCafeBg
 * -----------
 * ONE background for the whole app (per user request): the bright day-stall
 * cafe scene. Previous per-frame / per-service switching (night-taxi,
 * night-stall, dine-in-cozy, takeaway-bustling, customer-served) is gone —
 * legacy props (frame, serviceType, forceBg) are still accepted so callers
 * don't break, but they no longer change the scene.
 *
 * Speed: the image is preloaded in index.html, so the very first paint shows
 * the background instantly — no crossfade machinery, no state, no timers.
 */
const BG_SRC = '/backgrounds/day-stall.webp'

export default function SmartCafeBg({
  blur = 3,
  brightness = 0.35,
  overlayOpacity = 0.6,
}) {
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
      <img
        src={BG_SRC}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          filter: `blur(${blur}px) brightness(${brightness})`,
          transform: 'scale(1.08)', // avoid blurred edge artifacts
          zIndex: 0,
          userSelect: 'none',
        }}
        onError={(e) => {
          // Hide broken image — overlay still shows.
          e.currentTarget.style.display = 'none'
        }}
      />

      {/* Warm dark overlay for legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(26,15,10,${overlayOpacity * 0.7}) 0%, rgba(26,15,10,${overlayOpacity}) 100%)`,
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
