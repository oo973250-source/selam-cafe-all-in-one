import React, { useState } from 'react'
import CafeLogo from './CafeLogo.jsx'
import { brandConfig } from '../data/brand.js'

/**
 * BrandLogo
 * ----------
 * Renders the cafe logo. Reads from `brandConfig.logoUrl` so the admin
 * can swap the logo file without editing code.
 *
 * Behavior:
 *   - If `brandConfig.logoUrl` is set AND the image loads successfully,
 *     renders an <img> with that src.
 *   - Otherwise (logoUrl is null OR image fails to load), falls back to
 *     the emoji-based <CafeLogo> (🪶☕🪶).
 *
 * Props:
 *   size      pixel size of the longest edge (default: brandConfig.logoSize)
 *   className optional CSS class
 *   style     optional inline styles (merged on top of defaults)
 *
 * To swap the logo later:
 *   1. Replace /public/brand/logo.png with the new logo, OR
 *   2. Edit /src/data/brand.js and set logoUrl to a different URL.
 */
export default function BrandLogo({ size, className, style }) {
  const [imgError, setImgError] = useState(false)
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
