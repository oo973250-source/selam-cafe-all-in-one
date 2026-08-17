import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BrandLogo from './BrandLogo.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import { getT } from '../utils/i18n.js'
import { brandConfig } from '../data/brand.js'

/**
 * IntroFrame (Frame 0) — CafeIntro v3
 * ------------------------------------
 * 2-phase animated splash screen:
 *
 *   Phase 1 (0 → 1.8s)
 *     - Cafe background slowly zooms (scale 1.05 → 1.25)
 *     - BrandLogo (from brandConfig.logoUrl) springs in (rotation -8° → 0°)
 *     - "Welcome to Selam Cafe" title fades in
 *     - "Fresh. Warm. Made with love." subtitle fades in
 *
 *   Phase 2 (1.8s → 3.2s)
 *     - Background continues zooming toward 1.25
 *     - Welcome text cross-fades out
 *     - Bouncing 🍽️ plate emoji appears
 *     - "How would you like your order?" text fades in
 *
 *   Auto-advance at 3.2s OR tap anywhere to skip immediately.
 *
 *   Progress dots at the bottom indicate the current phase.
 *
 * Background: /backgrounds/night-stall.png (Ethiopian street-food stall at night,
 * warm purple sky with stars — used as the cafe-night image).
 *
 * Logo: loads from brandConfig.logoUrl (default: /brand/logo.png).
 * Admin can swap /public/brand/logo.png to change the logo everywhere
 * it appears (intro, top-right of frames 1 & 2, etc.).
 */
export default function IntroFrame({ onAdvance }) {
  const { userLanguage } = useTelegram()
  const t = getT(userLanguage)
  const [phase, setPhase] = useState(1) // 1 = welcome, 2 = choose-service

  // Phase timer — phase 1 → 2 at 1.8s, auto-advance at 3.2s
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(2), 1800)
    const t2 = setTimeout(() => onAdvance?.(), 3200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [onAdvance])

  return (
    <div
      onClick={() => onAdvance?.()}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        zIndex: 1,
      }}
    >
      {/* ────────────────────────────────────────────────────────────
          Background: night-stall.png
          Slow zoom across both phases for cinematic feel.
      ──────────────────────────────────────────────────────────── */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/backgrounds/night-stall.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        animate={{ scale: phase === 2 ? 1.25 : 1.05 }}
        transition={{ duration: 1.6, ease: 'easeInOut' }}
      />

      {/* Dark gradient overlay for text legibility */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.40) 0%, rgba(0,0,0,0.30) 50%, rgba(0,0,0,0.60) 100%)',
        }}
      />

      {/* ────────────────────────────────────────────────────────────
          Cross-fade content area: phase 1 = welcome, phase 2 = prompt
      ──────────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {phase === 1 ? (
          <motion.div
            key="intro-phase-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6 }}
            style={{
              position: 'relative',
              zIndex: 10,
              textAlign: 'center',
              padding: '0 32px',
            }}
          >
            {/* Cafe logo — spring-in with slight rotation.
                Reads from brandConfig.logoUrl so admin can swap the
                logo file later without touching code.
                Wrapped in a flex container to guarantee horizontal
                centering (img is inline-level and textAlign inheritance
                through motion.div can be unreliable). */}
            <motion.div
              initial={{ rotate: -8, scale: 0.8, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 100 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                marginBottom: '16px',
                filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6))',
              }}
            >
              <BrandLogo size={96} />
            </motion.div>

            {/* Title */}
            <h1
              style={{
                fontSize: '36px',
                fontWeight: 800,
                color: '#FFFFFF',
                margin: 0,
                letterSpacing: '0.005em',
                textShadow: '0 2px 16px rgba(0,0,0,0.7)',
              }}
            >
              {t('introTitle')}
            </h1>

            {/* Subtitle */}
            <p
              style={{
                color: 'rgba(255, 224, 150, 0.95)',
                marginTop: '12px',
                fontSize: '14px',
                maxWidth: '320px',
                marginLeft: 'auto',
                marginRight: 'auto',
                textShadow: '0 1px 6px rgba(0,0,0,0.6)',
              }}
            >
              {t('introSubtitle')}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="intro-phase-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              position: 'relative',
              zIndex: 10,
              textAlign: 'center',
              padding: '0 32px',
            }}
          >
            {/* Bouncing plate emoji */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              style={{
                fontSize: '60px',
                lineHeight: 1,
                marginBottom: '12px',
                filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.6))',
              }}
            >
              🍽️
            </motion.div>

            <p
              style={{
                color: 'rgba(255, 224, 150, 1)',
                fontSize: '18px',
                fontWeight: 600,
                margin: 0,
                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
              }}
            >
              {t('introPrompt')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ────────────────────────────────────────────────────────────
          "Tap anywhere to continue" hint (fades in after 1s)
      ──────────────────────────────────────────────────────────── */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 1 }}
        style={{
          position: 'absolute',
          bottom: 'calc(var(--safe-bottom, 0px) + 32px)',
          color: 'rgba(255, 224, 150, 0.7)',
          fontSize: '12px',
          zIndex: 10,
          margin: 0,
          letterSpacing: '0.04em',
        }}
      >
        {t('introTapHint')}
      </motion.p>

      {/* ────────────────────────────────────────────────────────────
          Progress dots (2 phases)
      ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(var(--safe-bottom, 0px) + 16px)',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '6px',
          zIndex: 10,
        }}
      >
        <span
          style={{
            height: '6px',
            width: phase === 1 ? '24px' : '6px',
            borderRadius: '999px',
            background: phase === 1 ? '#FCD34D' : 'rgba(255,255,255,0.4)',
            transition: 'all 300ms ease',
          }}
        />
        <span
          style={{
            height: '6px',
            width: phase === 2 ? '24px' : '6px',
            borderRadius: '999px',
            background: phase === 2 ? '#FCD34D' : 'rgba(255,255,255,0.4)',
            transition: 'all 300ms ease',
          }}
        />
      </div>
    </div>
  )
}
