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
 *
 * BLACK-SCREEN FIX (user report: "everything after the intro is black"):
 * the old defaults (brightness 0.35 + a 62% dark overlay) stacked into a
 * ~0.13 luminance scene — visually black on phone panels, while the intro
 * (which applied NO brightness filter) stayed bright. New defaults keep the
 * cafe warm but clearly visible: brightness 0.85 + a very light veil.
 */
const BG_SRC = '/backgrounds/day-stall.webp'

export default function SmartCafeBg({
  blur = 3,
  brightness = 0.85,
  overlayOpacity = 0.3,
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

      {/* Lighter warm veil so the blurred cafe photo actually breathes
          through instead of going black under Telegram's composite.
          Soft warm dark accents now sit strictly at the edges (radial
          vignette), leaving the center bright and visible. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(255,250,238,${Math.round(overlayOpacity * 0.18 * 100) / 100}) 0%, rgba(255,250,238,${Math.round(overlayOpacity * 0.55 * 100) / 100}) 100%)`,
          mixBlendMode: 'overlay',
          zIndex: 1,
        }}
      />

      {/* Warm radial glow centered */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(255,240,200,0.18) 0%, rgba(255,240,200,0.05) 45%, transparent 70%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Legibility scrim — translucent dark so white UI text stays readable
          over the newly-bright photo, without ever going near "black". */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,15,10,0.35)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Soft edge vignette — darker corners only, center stays light. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 55%, rgba(26,15,10,0.55) 100%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
