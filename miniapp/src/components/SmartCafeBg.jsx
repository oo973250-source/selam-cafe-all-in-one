import React from 'react'

/**
 * SmartCafeBg
 * -----------
 * ONE background for the whole app: the bright day-stall cafe scene,
 * with an automatic DAY/NIGHT switch driven by Ethiopian local time.
 * Legacy props (frame, serviceType, forceBg) are still accepted so callers
 * don't break, but they no longer change the scene.
 *
 * Time-of-day mode (user request: "when it is 1:00 in local time the bg
 * changes to night time background" — Ethiopia local time):
 *   ETHIOPIA_UX_OFFSET = EAT (UTC+3). Night window = 19:00–05:59 EAT.
 *   At night the same photo is dimmed and given a deep navy-blue tint so
 *   it reads as an evening cafe scene (no separate night asset needed,
 *   and no asset downloads at night).
 *
 * BLACK-SCREEN FIX: defaults keep the photo clearly visible — brightness
 * 0.85 + small veil by day; night multiplies to ~0.5 but stays above the
 * video-black threshold (~13% luminance) the app used to have.
 *
 * DIM MODE (user request: darker bg on the name/location screen so typing
 * and buttons are easy): pass `dim` to add a solid dark scrim on top of
 * whatever day/night mode is active.
 */
const BG_SRC = '/backgrounds/day-stall.webp'

// EAT = UTC+3 (Ethiopia has no DST).
const ETHIOPIA_UTC_OFFSET = 3

function isNightInEthiopia() {
  const eatHour = (new Date().getUTCHours() + ETHIOPIA_UTC_OFFSET) % 24
  return eatHour >= 19 || eatHour < 6
}

export default function SmartCafeBg({
  blur = 3,
  brightness = 0.85,
  overlayOpacity = 0.3,
  dim = false,
}) {
  const night = isNightInEthiopia()
  // Night dims the photo to half of whatever the frame asked for, but the
  // night tint keeps it clearly visible (not black).
  const effectiveBrightness = night ? Math.max(brightness * 0.55, 0.28) : brightness

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
          filter: `blur(${blur}px) brightness(${effectiveBrightness})`,
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
          through instead of going black under Telegram's composite. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(255,250,238,${Math.round(overlayOpacity * 0.18 * 100) / 100}) 0%, rgba(255,250,238,${Math.round(overlayOpacity * 0.55 * 100) / 100}) 100%)`,
          mixBlendMode: 'overlay',
          zIndex: 1,
        }}
      />

      {/* Deep-NIGHT tint (19:00–05:59 EAT): navy-blue wash over the whole
          scene so the cafe photo reads as evening. Not the old black-out —
          the photo still shows through. */}
      {night && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(9,16,38,0.50) 0%, rgba(12,10,30,0.62) 100%)',
            zIndex: 1,
          }}
        />
      )}

      {/* Ambient glow — warm by day, cool moonlight at night */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: night
            ? 'radial-gradient(ellipse at center, rgba(120,150,255,0.12) 0%, rgba(120,150,255,0.04) 45%, transparent 70%)'
            : 'radial-gradient(ellipse at center, rgba(255,240,200,0.18) 0%, rgba(255,240,200,0.05) 45%, transparent 70%)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* Legibility scrim — translucent dark so white UI text stays readable
          over the photo, without ever going near "black". Night uses a
          lighter pass (the navy tint already handles contrast). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: night ? 'rgba(26,15,10,0.15)' : 'rgba(26,15,10,0.35)',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      />

      {/* DIM MODE (frames that need maximum input readability, e.g. the
          name/location form): one extra solid dark layer. */}
      {dim && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(12,8,5,0.45)',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

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
