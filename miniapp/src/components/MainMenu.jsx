import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CafeLogo from './CafeLogo.jsx'
import { menuData } from '../data/menuData.js'
import { useCart } from '../context/CartContext.jsx'
import { useTelegram } from '../hooks/useTelegram.js'
import { getT } from '../utils/i18n.js'

/**
 * MainMenu (Frame 2 — rebuilt v3 to match the user's reference sketch)
 * --------------------------------------------------------------------
 * Layout (matches the reference image exactly):
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ [Breakfast | Lunch | Dinner | Snacks]  [logo]│  ← top bar
 *   │                                              │
 *   │              ┌─ menu ─┐                      │
 *   │              │  ┊  ┊  │                      │
 *   │      ┌───────┘   │   └───────┐               │
 *   │   🍲 FOODS              DRINKS 🥤            │
 *   │   ┌───────┐         ┌───────┐                │
 *   │   │ Cat 1 │         │ Cat 1 │                │
 *   │   ├───────┤         ├───────┤                │
 *   │   │ Cat 2 │         │ Cat 2 │                │
 *   │   ├───────┤         ├───────┤                │
 *   │   │ Cat 3 │  👩‍🍳   │ Cat 3 │  ← owner in     │
 *   │   ├───────┤  owner  ├───────┤    lower-left  │
 *   │   │ Cat 4 │  hands  │ Cat 4 │    presenting  │
 *   │   ├───────┤  raised │ Cat 5 │    the buttons │
 *   │   │ Cat 5 │  below  ├───────┤                │
 *   │   ├───────┤  pills  │ Cat 6 │                │
 *   │   │ Cat 6 │         ├───────┤                │
 *   │   ├───────┤         │ Cat 7 │                │
 *   │   │ Cat 7 │         └───────┘                │
 *   │   └───────┘                                  │
 *   └─────────────────────────────────────────────┘
 *
 * Key alignment rules (from user feedback):
 *   - Owner sits in the LOWER-LEFT corner (bottom ~40% of screen)
 *   - Owner's hands are raised into a presenting pose, but they
 *     do NOT cross or touch the category pills (pills live in a
 *     separate column on the right)
 *   - 7 pills per column × 2 columns = 14 categories
 *   - Owner levitates at "fast normal" speed (~1.8s per cycle)
 *   - Single language (no Amharic subtitles)
 *   - Background: blurred coffee-themed pattern
 */

// Fast-normal levitation: 1.8s per full cycle, ±8px amplitude (visible).
// Smooth sine-wave keyframes (9 samples per cycle).
const floatKeyframes = [0, -2, -4, -6, -8, -6, -4, -2, 0]
const floatTransition = {
  duration: 1.8,
  repeat: Infinity,
  ease: [0.45, 0, 0.55, 1],
}

const MEAL_TABS = [
  // 'All' is the DEFAULT selection — shows every category that exists
  // (real + placeholder). The other 4 tabs filter the menu to just the
  // categories whose `mealTimes` array includes the selected meal.
  { key: 'all',       labelKey: 'all' },
  { key: 'breakfast', labelKey: 'breakfast' },
  { key: 'lunch',     labelKey: 'lunch' },
  { key: 'dinner',    labelKey: 'dinner' },
  { key: 'snacks',    labelKey: 'snacks' },
]

export default function MainMenu({ onAdvance, bgProps }) {
  const { setCategory } = useCart()
  const { hapticFeedback, userLanguage } = useTelegram()
  const t = getT(userLanguage)
  const [activeMeal, setActiveMeal] = useState('all')
  // Two-tap pattern: 1st tap expands the pill to show full category name,
  // 2nd tap on the same pill confirms selection and advances to Frame 3.
  // Tapping a different pill collapses the previous one and expands the new.
  const [expandedCatId, setExpandedCatId] = useState(null)

  // MEAL-TIME FILTERING (per user spec):
  //   - 'all' (default) → show every non-hidden category
  //   - 'breakfast'/'lunch'/'dinner'/'snacks' → show only categories whose
  //     `mealTimes` array includes the selected meal.
  // Example: the Snacks category (which contains sambusa) has
  //   mealTimes: ['snacks'] — so selecting 'Breakfast' hides it entirely,
  //   because sambusa is not served in the morning. The Breakfast
  //   category has mealTimes: ['breakfast'], so it shows ONLY when
  //   'Breakfast' (or 'All') is selected.
  // Drinks: Hot Drinks has mealTimes covering every meal (coffee is served
  //   all day); Cold Drinks is hidden at breakfast (juice/soda not typical
  //   morning fare) but visible at lunch/dinner/snacks.
  const filterByMeal = (cat) => {
    if (cat.hidden) return false
    if (activeMeal === 'all') return true
    return Array.isArray(cat.mealTimes) && cat.mealTimes.includes(activeMeal)
  }
  const foodCats = useMemo(
    () => menuData.foods.categories.filter(filterByMeal),
    [activeMeal]
  )
  const drinkCats = useMemo(
    () => menuData.drinks.categories.filter(filterByMeal),
    [activeMeal]
  )

  // Resolve localized category name based on user language.
  const localizedCatName = (cat) =>
    userLanguage === 'am' ? cat.nameAm : cat.nameEn

  const handlePick = (cat, sectionKey) => {
    if (expandedCatId === cat.id) {
      // Second tap on the SAME expanded pill → confirm selection + advance.
      hapticFeedback.impactOccurred('light')
      setCategory({
        id: cat.id,
        nameEn: cat.nameEn,
        nameAm: cat.nameAm,
        icon: cat.icon,
        sectionKey,
      })
      onAdvance?.()
    } else {
      // First tap (or tap on a different pill) → expand to reveal full name.
      hapticFeedback.selectionChanged()
      setExpandedCatId(cat.id)
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        // New coffee-themed line-art background (user-supplied, v2).
        backgroundImage: 'url(/backgrounds/coffee-pattern-v2.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
      }}
    >
      {/* Soft warm overlay on top of the background image.
          The new background is a clean line-art pattern on cream, so we
          only need a light cream veil + slight brightness boost — no
          heavy blur (the pattern is already low-noise and won't compete
          with the foreground UI). */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(250, 244, 232, 0.45) 0%, rgba(245, 234, 216, 0.55) 100%)',
          zIndex: 1,
        }}
      />

      {/* Top-right: cafe logo (consistent with Frame 1) */}
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
        <CafeLogo size={40} />
      </motion.div>

      {/* Top: meal-time segmented control (5 tabs: All / Breakfast / Lunch / Dinner / Snacks) */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          top: 'calc(var(--safe-top, 0px) + 16px)',
          left: 14,
          right: 76,
          display: 'flex',
          gap: 3,
          background: 'rgba(255, 255, 255, 0.75)',
          padding: 4,
          borderRadius: 14,
          border: '1px solid rgba(139, 100, 32, 0.2)',
          boxShadow: '0 2px 8px rgba(60, 40, 10, 0.1)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 25,
        }}
      >
        {MEAL_TABS.map((tab) => {
          const active = activeMeal === tab.key
          return (
            <motion.button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveMeal(tab.key)
                // Reset any expanded pill so a stale expansion from a
                // different meal doesn't persist into the new meal.
                setExpandedCatId(null)
                hapticFeedback.selectionChanged()
              }}
              whileTap={{ scale: 0.94 }}
              style={{
                flex: 1,
                padding: '8px 2px',
                borderRadius: 10,
                border: 'none',
                background: active
                  ? 'linear-gradient(180deg, #3A2410 0%, #1A0E05 100%)'
                  : 'transparent',
                color: active ? '#FFF8E7' : '#5C3A1E',
                fontWeight: 600,
                fontSize: 10,
                cursor: 'pointer',
                transition: 'background 200ms, color 200ms',
                boxShadow: active
                  ? '0 2px 6px rgba(58, 36, 16, 0.4)'
                  : 'none',
              }}
            >
              {t(tab.labelKey)}
            </motion.button>
          )
        })}
      </motion.div>

      {/* ────────────────────────────────────────────────────────────
          Info box — small guidance card in the empty space ABOVE the
          owner's head. Per user feedback v10:
            - LOWER (top: 108 → 200) so it doesn't overlap an expanded
              category pill when the first pill is tapped.
            - SMALLER: dropped the subtitle + 4th step (added in v9),
              tighter padding, smaller fonts, narrower width. The user
              said "smaller is much cool".
      ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          // Pushed DOWN to 200px so it sits BELOW the first row of pills
          // (first pill at y≈120, expanded overlay spans y≈112-190).
          // The box now lives in the gap between the first pill row and
          // the owner's head, leaving the expanded overlay clear.
          top: 'calc(var(--safe-top, 0px) + 200px)',
          left: 14,
          width: '38%',
          maxWidth: 148,
          background: 'rgba(40, 28, 16, 0.88)',
          borderRadius: 12,
          border: '1px solid rgba(212, 168, 83, 0.35)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.24)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          // Tight padding (was 12px 12px 14px in v9).
          padding: '8px 10px 10px',
          color: '#FFF8E7',
          // SENT TO BACK (v11): was 15, now 8 — sits BELOW the menu
          // columns container (zIndex 10). When a category pill is
          // tapped, its expanded overlay (which lives INSIDE the
          // columns container's stacking context) needs to paint ON
          // TOP of this info box. Because the overlay's zIndex: 30 is
          // nested under the columns container's zIndex: 10, the only
          // way to guarantee the overlay wins is to make this box's
          // root-level zIndex lower than 10. Owner image is at
          // zIndex 5 (bottom-left, no spatial overlap with this box
          // at top: 200), so 8 is a safe slot between them.
          zIndex: 8,
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {/* Header pill — smaller (was 8.5 / 3px 9px) */}
        <div
          style={{
            display: 'inline-block',
            background: 'rgba(20, 14, 8, 0.95)',
            color: '#FCD34D',
            fontSize: 7.5,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            padding: '2px 7px',
            borderRadius: 5,
            marginBottom: 5,
          }}
        >
          {t('infoTitle')}
        </div>
        {/* 3-step instructions (back to v8 count, but tighter) */}
        <div style={{ fontSize: 8.5, lineHeight: 1.4, color: 'rgba(255, 248, 231, 0.92)' }}>
          <div>{t('infoStep1')}</div>
          <div>{t('infoStep2')}</div>
          <div>{t('infoStep3')}</div>
        </div>
      </motion.div>

      {/* ────────────────────────────────────────────────────────────
          Owner image — LOWER-LEFT corner, BIG + LOWERED.
          Reference: Tg cafe(2).jpg shows chef taking up large vertical
          space with body/apron clipped below screen. We achieve this by:
            1. Making the container big (width 55%, height 84%)
            2. Pushing the container DOWN off-screen (bottom: -200)
               so the lower ~33% of the chef is clipped, leaving the
               upper body (head + chest + raised hands) visible in the
               bottom-left of the screen.
          The parent div has overflow:hidden so the clipped portion is
          never visible. Width is capped at 230px so the chef never
          touches the buttons column (which starts at left: 45%).
      ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          left: -25,
          bottom: -200,
          width: '55%',
          maxWidth: 230,
          height: '84%',
          maxHeight: 620,
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <motion.div
          initial={{ y: 0 }}
          animate={{ y: floatKeyframes }}
          transition={floatTransition}
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            // Align to TOP because the container is pushed below the
            // screen (bottom: -160). With top alignment, the image's
            // head/chest/hands stay visible while the lower body
            // (apron/feet) is clipped below the screen — making the
            // chef appear "lowered" with ~35% of her body cut off.
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <img
            src="/owner/pose-6-presenting.png"
            alt="Cafe owner presenting the menu"
            draggable={false}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              objectPosition: 'top center',
              filter: 'drop-shadow(0 8px 18px rgba(60, 40, 10, 0.3))',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </motion.div>
      </motion.div>

      {/* ────────────────────────────────────────────────────────────
          Right side: tree header + two columns of 7 category pills.
          Left edge moved from 45% → 42% (per user v10: "move the menu
          to the left") to give the drinks column more right-edge
          breathing room so the expanded overlay is never clipped on
          phone ratio. 42% on a 390px viewport = ~164px — just past
          the owner chef figure's visible right edge (~165px), so the
          menu doesn't visually cross the owner.
          Right margin increased from 10 → 16 for extra safety.
      ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          top: 'calc(var(--safe-top, 0px) + 70px)',
          bottom: 'calc(var(--safe-bottom, 0px) + 8px)',
          left: '42%',
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
        }}
      >
        {/* Tree header: menu → foods / drinks */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 4,
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          {/* Root node: "menu" */}
          <div
            style={{
              padding: '3px 12px',
              borderRadius: 10,
              background: 'rgba(58, 36, 16, 0.92)',
              color: '#FFF8E7',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'lowercase',
              boxShadow: '0 2px 6px rgba(58, 36, 16, 0.3)',
            }}
          >
            {t('menuRoot')}
          </div>
          {/* Branch lines (SVG) */}
          <svg
            width="100%"
            height="14"
            viewBox="0 0 200 14"
            preserveAspectRatio="none"
            style={{ overflow: 'visible' }}
          >
            <path
              d="M 100 0 C 100 6, 50 5, 50 13"
              stroke="#8B6420"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="3 3"
            />
            <path
              d="M 100 0 C 100 6, 150 5, 150 13"
              stroke="#8B6420"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="3 3"
            />
          </svg>
          {/* Two column headers */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              padding: '0 2px',
              marginTop: -1,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: '#5C3A1E',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              🍲 {t('foods')}
            </div>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: '#5C3A1E',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              {t('drinks')} 🥤
            </div>
          </div>
        </div>

        {/* Two columns of 7 category pills each.
            TWO-TAP PATTERN (per user feedback):
              1st tap → pill EXPANDS into a WIDER centered overlay
                       (~170px, escaping the narrow ~95px column) that
                       shows the FULL localized category name on ONE
                       HORIZONTAL LINE — no vertical wrapping.
              2nd tap on SAME pill → confirms selection + advances
                                       to Frame 3 (CategoryMenu)
              Tap on a DIFFERENT pill → collapses the previous,
                                       expands the new one.
            Compact pills stay small (46px) so the column stays tidy;
            only the expanded one becomes a wide floating card. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: 4,
            minHeight: 0,
            // Allow expanded overlays to escape the column horizontally.
            overflow: 'visible',
          }}
        >
          {/* Foods column — compact pills (same pattern as the drinks
              column). Filtered by the active meal tab via `mealTimes`.
              When 'All' is selected, every non-hidden foods category is
              shown (real + placeholders). When a specific meal is picked,
              only categories whose `mealTimes` includes that meal appear —
              e.g., selecting 'Breakfast' shows only the Breakfast category
              and HIDES Snacks (which contains sambusa, not served at
              breakfast). Two-tap pattern preserved: 1st tap expands the
              pill into a wider horizontal overlay showing the full
              category name; 2nd tap on the same pill advances to Frame 3. */}
          <div
            style={{
              flex: 1,
              // minWidth: 0 is CRITICAL — without it, flex items won't
              // shrink below their content's min-width (which is the
              // default `min-width: auto`). This was causing the drinks
              // column to overflow past the menu container's right edge
              // by ~26px, which in turn pushed the expanded overlay
              // off-screen on phone ratio. With minWidth: 0, both
              // columns are forced to equal width (= half the container).
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              justifyContent: 'flex-start',
              overflow: 'visible',
              paddingBottom: 2,
              position: 'relative',
            }}
          >
            {foodCats.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#8B6420',
                  fontSize: 10,
                  textAlign: 'center',
                  padding: 12,
                  fontStyle: 'italic',
                  lineHeight: 1.4,
                }}
              >
                Nothing on the menu for this meal time.
              </div>
            )}
            {foodCats.map((cat, i) => {
              const isExpanded = expandedCatId === cat.id
              return (
                <div
                  key={cat.id}
                  style={{
                    position: 'relative',
                    height: 46,
                    flexShrink: 0,
                  }}
                >
                  {/* Compact pill */}
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: isExpanded ? 0 : 1, y: 0 }}
                    transition={{
                      delay: 0.4 + i * 0.04,
                      duration: 0.25,
                    }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handlePick(cat, 'foods')}
                    style={{
                      height: 46,
                      width: '100%',
                      padding: '0 8px',
                      borderRadius: 14,
                      border: '1px solid rgba(139, 100, 32, 0.2)',
                      background: 'rgba(255, 255, 255, 0.88)',
                      boxShadow: '0 1px 2px rgba(60, 40, 10, 0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      textAlign: 'left',
                      position: 'relative',
                      backdropFilter: 'blur(4px)',
                      WebkitBackdropFilter: 'blur(4px)',
                      pointerEvents: isExpanded ? 'none' : 'auto',
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{cat.icon}</span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#3A2410',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {localizedCatName(cat)}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        color: '#8B6420',
                        background: 'rgba(212, 168, 83, 0.18)',
                        padding: '1px 5px',
                        borderRadius: 6,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {cat.items.length}
                    </span>
                  </motion.button>

                  {/* Expanded overlay — wider card anchored to the RIGHT
                      edge of the pill (extends LEFT). This is the SAME
                      pattern as the drinks column: stays on-screen for
                      phone ratio because the right edge is aligned with
                      the original pill (matches user request: "make it
                      in the same spot where the button was — just
                      zoomed bigger"). The full localized category name
                      is shown on ONE horizontal line (no wrapping). */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onClick={() => handlePick(cat, 'foods')}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: 0,
                          // Shrunk from 170 → 140 (v10) so the overlay
                          // is guaranteed not to clip on phone ratio even
                          // when the menu container is at left: 42%.
                          width: 140,
                          height: 56,
                          borderRadius: 14,
                          border: '1.5px solid #D4A853',
                          background:
                            'linear-gradient(180deg, #FFF8E7 0%, #F5E6C8 100%)',
                          boxShadow:
                            '0 6px 18px rgba(60, 40, 10, 0.4), 0 0 0 3px rgba(255, 248, 231, 0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 10px',
                          gap: 6,
                          cursor: 'pointer',
                          zIndex: 30,
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                          {cat.icon}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#3A2410',
                            lineHeight: 1.1,
                            whiteSpace: 'nowrap',
                            overflow: 'visible',
                            textOverflow: 'clip',
                          }}
                        >
                          {localizedCatName(cat)}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            color: '#5C3A1E',
                            background: 'rgba(212, 168, 83, 0.35)',
                            padding: '2px 5px',
                            borderRadius: 5,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {cat.items.length}
                        </span>
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08, duration: 0.18 }}
                          style={{
                            position: 'absolute',
                            bottom: -12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 8,
                            color: '#5C3A1E',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            background: 'rgba(255, 248, 231, 0.95)',
                            padding: '2px 7px',
                            borderRadius: 7,
                            border: '1px solid rgba(212, 168, 83, 0.5)',
                            boxShadow: '0 2px 6px rgba(60, 40, 10, 0.15)',
                          }}
                        >
                          {t('tapToSelect')}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>

          {/* Drinks column */}
          <div
            style={{
              flex: 1,
              // minWidth: 0 — same fix as foods column (see comment above).
              // Without this, the drinks column overflows the menu
              // container and the expanded overlay gets clipped on
              // phone ratio.
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              justifyContent: 'flex-start',
              overflow: 'visible',
              paddingBottom: 2,
              position: 'relative',
            }}
          >
            {drinkCats.map((cat, i) => {
              const isExpanded = expandedCatId === cat.id
              return (
                <div
                  key={cat.id}
                  style={{
                    position: 'relative',
                    height: 46,
                    flexShrink: 0,
                  }}
                >
                  {/* Compact pill */}
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: isExpanded ? 0 : 1, y: 0 }}
                    transition={{
                      delay: 0.4 + i * 0.04,
                      duration: 0.25,
                    }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handlePick(cat, 'drinks')}
                    style={{
                      height: 46,
                      width: '100%',
                      padding: '0 8px',
                      borderRadius: 14,
                      border: '1px solid rgba(139, 100, 32, 0.2)',
                      background: 'rgba(255, 255, 255, 0.88)',
                      boxShadow: '0 1px 2px rgba(60, 40, 10, 0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      textAlign: 'left',
                      position: 'relative',
                      backdropFilter: 'blur(4px)',
                      WebkitBackdropFilter: 'blur(4px)',
                      pointerEvents: isExpanded ? 'none' : 'auto',
                    }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{cat.icon}</span>
                    <span
                      style={{
                        flex: 1,
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#3A2410',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {localizedCatName(cat)}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        color: '#8B6420',
                        background: 'rgba(212, 168, 83, 0.18)',
                        padding: '1px 5px',
                        borderRadius: 6,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {cat.items.length}
                    </span>
                  </motion.button>

                  {/* Expanded overlay — wider card anchored to the RIGHT
                      edge of the pill (extends LEFT into the foods column
                      area). This keeps the overlay on-screen for the drinks
                      column (which is on the right edge of the screen) and
                      matches the user request: "make it in the same spot
                      where the button was" — left/right edges stay aligned
                      with the original pill, just bigger. */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        onClick={() => handlePick(cat, 'drinks')}
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: 0,
                          // Shrunk from 170 → 140 (v10) so the overlay
                          // is guaranteed not to clip on phone ratio even
                          // when the menu container is at left: 42%.
                          width: 140,
                          height: 56,
                          borderRadius: 14,
                          border: '1.5px solid #D4A853',
                          background:
                            'linear-gradient(180deg, #FFF8E7 0%, #F5E6C8 100%)',
                          boxShadow:
                            '0 6px 18px rgba(60, 40, 10, 0.4), 0 0 0 3px rgba(255, 248, 231, 0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 10px',
                          gap: 6,
                          cursor: 'pointer',
                          zIndex: 30,
                          userSelect: 'none',
                        }}
                      >
                        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                          {cat.icon}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#3A2410',
                            lineHeight: 1.1,
                            whiteSpace: 'nowrap',
                            overflow: 'visible',
                            textOverflow: 'clip',
                          }}
                        >
                          {localizedCatName(cat)}
                        </span>
                        <span
                          style={{
                            fontSize: 8.5,
                            color: '#5C3A1E',
                            background: 'rgba(212, 168, 83, 0.35)',
                            padding: '2px 5px',
                            borderRadius: 5,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {cat.items.length}
                        </span>
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.08, duration: 0.18 }}
                          style={{
                            position: 'absolute',
                            bottom: -12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 8,
                            color: '#5C3A1E',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            background: 'rgba(255, 248, 231, 0.95)',
                            padding: '2px 7px',
                            borderRadius: 7,
                            border: '1px solid rgba(212, 168, 83, 0.5)',
                            boxShadow: '0 2px 6px rgba(60, 40, 10, 0.15)',
                          }}
                        >
                          {t('tapToSelect')}
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
