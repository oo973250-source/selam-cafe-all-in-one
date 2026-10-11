import React, { useEffect, useState } from 'react'
import CafeLogo from './CafeLogo.jsx'
import { brandConfig, subscribeLogo } from '../data/brand.js'

/**
 * BrandLogo
 * ----------
 * Renders the cafe logo. Reads the LIVE cafe_profile logo from the server
 * (`/api/brand` + `brand:update` socket pushes — see brand.js) so a change
 * made in the Admin Mini App Profile page updates EVERY corner logo in the
 * customer Mini App within seconds — no redeploy needed.
 *
 * Behavior:
 *   - If a live logoUrl is set AND the image loads successfully, renders an
 *     <img> with that src (cache-busted with updated_at so the same URL with
 *     a new image also refetches).
 *   - Otherwise (no URL OR image fails to load), falls back to the emoji-based
 *     <CafeLogo> (🪶☕🪶).
 *
 * Props:
 *   size      pixel size of the longest edge (default: brandConfig.logoSize)
 *   className optional CSS class
 *   style     optional inline styles (merged on top of defaults)
 */
export default function BrandLogo({ size, className, style }) {
  const [imgError, setImgError] = useState(false)
  const [, forceRender] = useState(0)

  // Re-render whenever the live brand config changes (socket push or the
  // initial /api/brand fetch completing).
  useEffect(() => subscribeLogo(() => {
    setImgError(false) // a NEW logo may already be on screen — retry loading
    forceRender((n) => n + 1)
  }), [])

  const finalSize = size ?? brandConfig.logoSize
  const logoUrl = brandConfig.logoUrl

  // No URL configured → use emoji fallback
  if (!logoUrl || imgError) {
    return <CafeLogo size={finalSize} className={className} />
  }

  return (
    <img
      src={logoUrl}
      alt={`${brandConfig.name} logo`}
      className={className}
      onError={() => setImgError(true)}
      draggable={false}
      style={{
        width: finalSize,
        height: finalSize,
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
