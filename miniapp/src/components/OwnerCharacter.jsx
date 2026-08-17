import React, { useState } from 'react'

/**
 * OwnerCharacter
 * ---------------
 * Renders the cafe owner character at one of four named poses.
 *
 * Props:
 *   pose      'holding-plate' | 'standing' | 'different-outfit' | 'looking'
 *   position  'left' | 'right' | 'center' (default 'center')
 *   size      pixel size of the longest edge (default 160)
 *   className optional extra classes
 *   style     optional inline styles
 *
 * - 'looking' pose uses the gentler 2s float; others use the slow 3s float.
 * - onError fallback: render a 👩‍🍳 emoji inside a dashed box.
 */

const POSE_IMAGES = {
  'holding-plate':     '/owner/pose-1-holding-plate.png',
  'standing':          '/owner/pose-2-arms-open.png',
  'different-outfit':  '/owner/pose-3-different-outfit.png',
  'looking':           '/owner/pose-4-arms-on-board.png',
}

export default function OwnerCharacter({
  pose = 'standing',
  position = 'center',
  size = 160,
  className = '',
  style = {},
}) {
  const [failed, setFailed] = useState(false)
  const src = POSE_IMAGES[pose] || POSE_IMAGES.standing

  // 'looking' uses the more subtle 2s float, others use slow 3s float.
  const floatClass = pose === 'looking' ? 'anim-floatGentle' : 'anim-floatSlow'

  // Position helpers (margin auto etc. handled by parent if 'center')
  const posStyle = {}
  if (position === 'left')  { posStyle.marginRight = 'auto' }
  if (position === 'right') { posStyle.marginLeft = 'auto' }

  const boxStyle = {
    width: size,
    height: size,
    position: 'relative',
    ...posStyle,
    ...style,
  }

  if (failed) {
    return (
      <div
        className={`${floatClass} ${className}`}
        style={{
          ...boxStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px dashed var(--border-active)',
          borderRadius: '14px',
          fontSize: Math.floor(size * 0.4),
          background: 'rgba(255,248,240,0.04)',
        }}
        aria-label="Cafe owner"
        role="img"
      >
        👩‍🍳
      </div>
    )
  }

  return (
    <div className={`${floatClass} ${className}`} style={boxStyle}>
      <img
        src={src}
        alt="Cafe owner"
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'bottom center',
          filter: 'drop-shadow(0 14px 24px rgba(0,0,0,0.55))',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
    </div>
  )
}
