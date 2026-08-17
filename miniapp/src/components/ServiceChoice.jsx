import React, { useState } from 'react'
import { motion } from 'framer-motion'
import SmartCafeBg from './SmartCafeBg.jsx'
import BrandLogo from './BrandLogo.jsx'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import { getT } from '../utils/i18n.js'

/**
 * ServiceChoice (Frame 1) — v3
 * -----------------------------
 * Layout (matches the user's reference sketch):
 *
 *   ┌─────────────────────────────────────────────┐
 *   │                                       ⚪️   │  ← top-right: cafe logo in white circle
 *   │                                              │
 *   │           "How would you like to enjoy?"     │  ← title
 *   │           Choose a service to begin          │  ← subtitle
 *   │                                              │
 *   │              ┌──────────────────┐            │
 *   │              │                  │            │
 *   │              │  CHEF HOLDING    │            │  ← owner image (transparent bg)
 *   │              │  GOLDEN TRAY     │            │
 *   │              │                  │            │
 *   │              │  ┌──┐ ┌──┐ ┌──┐  │            │  ← 3 buttons positioned
 *   │              │  │  │ │  │ │  │  │            │    ABSOLUTELY on top of
 *   │              │  └──┘ └──┘ └──┘  │            │    the plate (at 48% of img height)
 *   │              └──────────────────┘            │
 *   │                                              │
 *   └─────────────────────────────────────────────┘
 *
 * Key fixes in v3 (after user feedback "buttons not aligned with plate,
 * owner image and buttons must levitate up and down very small and slowly"):
 *
 *   1. PLATE ALIGNMENT
 *      Plate detection script (/scripts/detect_plate.py) found the plate
 *      is at 48.1% from the top of the image. The 3 service buttons are
 *      now positioned ABSOLUTELY at top: 48% of the owner image's height,
 *      so they sit right on the plate — not 130px below it.
 *
 *   2. SHARED LEVITATION (slow + small)
 *      The owner image AND the buttons are wrapped in ONE shared motion.div
 *      that floats y: [0, -4, 0] over 3.6s with easeInOut.
 *      - Amplitude: ±4px ("very small")
 *      - Duration: 3.6s ("slowly")
 *      - Shared wrapper → buttons stay glued to the plate as it floats
 *
 *   3. NO BLACK BACKGROUND
 *      The owner image was re-processed by /scripts/process_owner.py to
 *      strip the original black background to transparent alpha. The image
 *      now blends naturally into any background.
 */

// Smooth + FAST levitation: 1.2s cycle, ±4px amplitude, easeInOut
// (was 3.6s with 9 keyframes — too slow. 5 keyframes over 1.2s is butter-smooth.)
const floatKeyframes = [0, -2, -4, -2, 0]
const floatTransition = {
  duration: 1.2,
  repeat: Infinity,
  ease: [0.45, 0, 0.55, 1],
}

// Plate position detected by /scripts/detect_plate.py
// (48.1% from top of the owner image)
// Buttons moved up slightly (44%) so they sit higher on the plate.
const PLATE_TOP_PERCENT = 44

const SERVICES = [
  {
    key: 'dine_in',
    icon: '🍽️',
    labelKey: 'dineIn',
    descKey: 'dineInDesc',
    bg: 'dine-in-cozy',
  },
  {
    key: 'takeaway',
    icon: '🥡',
    labelKey: 'takeaway',
    descKey: 'takeawayDesc',
    bg: 'takeaway-bustling',
  },
  {
    key: 'delivery',
    icon: '🚗',
    labelKey: 'delivery',
    descKey: 'deliveryDesc',
    bg: 'night-taxi',
  },
]

export default function ServiceChoice({ onAdvance, bgProps }) {
  const { setServiceType } = useCart()
  const { hapticFeedback, userLanguage } = useTelegram()
  const t = getT(userLanguage)
  const [hoveredBg, setHoveredBg] = useState(null)

  const handleSelect = (svc) => {
    hapticFeedback.impactOccurred('light')
    setServiceType(svc.key)
    onAdvance?.()
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <SmartCafeBg
        {...bgProps}
        forceBg={hoveredBg || bgProps?.forceBg}
        blur={3}
        brightness={0.35}
      />

      {/* ────────────────────────────────────────────────────────────
          Top-right: cafe logo in a white circle
          (matches the reference sketch's white circle in top-right)
      ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
        style={{
          position: 'absolute',
          top: 'calc(var(--safe-top, 0px) + 14px)',
          right: 14,
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.96)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(60, 40, 10, 0.22), 0 0 0 1px rgba(212, 168, 83, 0.4)',
          zIndex: 30,
        }}
      >
        <BrandLogo size={40} />
      </motion.div>

      {/* Main content — vertically centered, no header text */}
      <div
        className="frame-scroll no-bottom-bar"
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          paddingTop: 'calc(var(--safe-top, 0px) + 10px)',
          paddingBottom: 'calc(var(--safe-bottom, 0px) + 10px)',
          paddingLeft: 12,
          paddingRight: 12,
        }}
      >
        {/* ────────────────────────────────────────────────────────────
            Owner + Buttons SHARED LEVITATION WRAPPER
            Both elements float together so buttons stay glued to plate.
            Inner stage is position:relative; buttons are absolutely
            positioned at PLATE_TOP_PERCENT of the image height.
        ──────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 4,
            marginBottom: 8,
          }}
        >
          {/* Shared levitation stage — both image and buttons float together */}
          <motion.div
            animate={{ y: floatKeyframes }}
            transition={floatTransition}
            style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'center',
              filter: 'drop-shadow(0 14px 24px rgba(0,0,0,0.55))',
            }}
          >
            <img
              src="/owner/pose-1-holding-plate.webp"
              alt="Cafe owner holding a golden tray"
              draggable={false}
              loading="eager"
              decoding="async"
              fetchpriority="high"
              style={{
                height: '100vh',
                maxHeight: 900,
                width: 'auto',
                maxWidth: '100%',
                objectFit: 'contain',
                objectPosition: 'center top',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />

            {/* ─────────────────────────────────────────────────────
                "Choose now" label — positioned absolutely just ABOVE
                the plate (at 34% of image height).
                Part of the shared levitation stage so it floats with
                the image and buttons.
            ────────────────────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              style={{
                position: 'absolute',
                top: '34%',
                left: 0,
                right: 0,
                textAlign: 'center',
                zIndex: 6,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  padding: '5px 16px',
                  borderRadius: 999,
                  background:
                    'linear-gradient(180deg, rgba(212, 168, 83, 0.95) 0%, rgba(170, 130, 50, 0.95) 100%)',
                  color: '#1a0e05',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.45)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('chooseNow')}
              </span>
            </motion.div>

            {/* ───────────────────────────────────────────────────────
                Service buttons — positioned ABSOLUTELY at plate level.
                Plate is at 48% of image height (from detect_plate.py).
                Buttons are centered horizontally and sit on the plate.
            ─────────────────────────────────────────────────────── */}
            <div
              style={{
                position: 'absolute',
                top: `${PLATE_TOP_PERCENT}%`,
                left: 0,
                right: 0,
                display: 'flex',
                gap: 6,
                padding: '0 8px',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 5,
                // Translate up by half the button height so the plate line
                // passes through the vertical center of the buttons.
                transform: 'translateY(-50%)',
              }}
            >
              {SERVICES.map((svc, i) => (
                <motion.button
                  key={svc.key}
                  type="button"
                  initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onMouseEnter={() => setHoveredBg(svc.bg)}
                  onMouseLeave={() => setHoveredBg(null)}
                  onTouchStart={() => {
                    setHoveredBg(svc.bg)
                    hapticFeedback.selectionChanged()
                  }}
                  onTouchEnd={() => setHoveredBg(null)}
                  onClick={() => handleSelect(svc)}
                  style={{
                    flex: 0,
                    width: 108,
                    padding: '10px 6px',
                    borderRadius: 13,
                    border: '1px solid rgba(212, 168, 83, 0.55)',
                    background:
                      'linear-gradient(180deg, rgba(26, 14, 5, 0.96) 0%, rgba(10, 6, 2, 0.98) 100%)',
                    color: '#FFF8E7',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    boxShadow:
                      '0 3px 10px rgba(0,0,0,0.6), 0 0 0 1px rgba(212, 168, 83, 0.25) inset',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                  }}
                >
                  <span style={{ fontSize: 26, lineHeight: 1 }}>{svc.icon}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(svc.labelKey)}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>

      </div>
    </div>
  )
}
