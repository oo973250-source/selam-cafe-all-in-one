/**
 * brand.js
 * --------
 * Central brand configuration for Selam Cafe.
 *
 * Admin-editable fields (in the future, these will be editable via the
 * admin section — for now they live here so they're easy to find and
 * swap manually).
 *
 *   logoUrl  →  if set, an <img> with this src is used as the logo
 *               everywhere <BrandLogo> is rendered. Set to null to
 *               fall back to the emoji-based <CafeLogo> (🪶☕🪶).
 *
 *   logoSize →  default size (px) of the longest edge of the logo.
 *
 *   name     →  cafe display name (used in intro title fallback,
 *               page <title>, PWA manifest, etc.)
 *
 * To swap the logo later:
 *   1. Drop the new logo image into /public/brand/logo.png
 *   2. Either keep logoUrl pointing to '/brand/logo.png' (default)
 *      or set it to a different URL.
 *   3. Rebuild (`npm run build`).
 *
 * In the future admin section, this object will be loaded from the
 * backend (e.g., GET /api/brand) and cached in localStorage.
 */

export const brandConfig = {
  // Default: serve the logo from /public/brand/logo.png
  // Admin can replace that file or override this URL.
  logoUrl: '/brand/logo.png',

  // Default logo size (px). Components can override per-use.
  logoSize: 80,

  // Cafe name (used in intro title, page title, etc.)
  name: 'Selam Cafe',

  // Tagline (used in intro subtitle, footer, etc.)
  tagline: 'Fresh. Warm. Made with love.',
}

/**
 * Get the current brand config.
 * In the future this could merge with localStorage-cached admin edits.
 */
export function getBrand() {
  return brandConfig
}
