/**
 * CafeLogo.jsx
 * ------------
 * Logo for Selam Cafe: a coffee cup with two feathers sweeping outward.
 *
 * Uses the 🪶 feather emoji flanking the ☕ coffee emoji. Emoji are
 * rendered by the OS font stack and are universally read as feathers
 * (whereas hand-drawn SVG feathers tend to be misread as wheat/bread
 * at small display sizes).
 *
 * A subtle gradient halo behind the cup ties the composition together.
 *
 * NOTE: The same composition is rendered to /public/brand/logo.png by
 * /home/z/my-project/scripts/render_logo.py. If you change this file,
 * re-run that script so the static PNG matches.
 */

export default function CafeLogo({ size = 44, className }) {
  // Size the emoji relative to the circle size
  const cupSize = Math.round(size * 0.62)
  const featherSize = Math.round(size * 0.46)

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        // Slight golden halo behind the cup
        background:
          'radial-gradient(circle at 50% 55%, rgba(212, 168, 83, 0.18) 0%, transparent 65%)',
        borderRadius: '50%',
      }}
      role="img"
      aria-label="Selam Cafe logo — coffee cup with feathers"
    >
      {/* Inner flex container — sizes to content so rotated feathers
          aren't clipped by the outer circle. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Left feather — tilted outward to the left */}
        <span
          style={{
            fontSize: featherSize,
            lineHeight: 1,
            transform: 'rotate(-32deg) translateY(2px)',
            display: 'inline-block',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
            marginRight: -Math.round(size * 0.06),
          }}
        >
          🪶
        </span>

        {/* Center coffee cup */}
        <span
          style={{
            fontSize: cupSize,
            lineHeight: 1,
            transform: 'translateY(2px)',
            display: 'inline-block',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.2))',
            zIndex: 2,
          }}
        >
          ☕
        </span>

        {/* Right feather — tilted outward to the right (mirrored) */}
        <span
          style={{
            fontSize: featherSize,
            lineHeight: 1,
            transform: 'rotate(32deg) scaleX(-1) translateY(2px)',
            display: 'inline-block',
            filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
            marginLeft: -Math.round(size * 0.06),
          }}
        >
          🪶
        </span>
      </div>
    </div>
  )
}
