import React, { useEffect, useRef, useState } from 'react'
import { CartProvider, useCart } from './context/CartContext.jsx'
import { useTelegram } from './hooks/useTelegram.js'

import SmartCafeBg from './components/SmartCafeBg.jsx'
import IntroFrame from './components/IntroFrame.jsx'
import ServiceChoice from './components/ServiceChoice.jsx'
import MainMenu from './components/MainMenu.jsx'
import CategoryMenu from './components/CategoryMenu.jsx'
import AllDone from './components/AllDone.jsx'
import ConfirmOrder from './components/ConfirmOrder.jsx'
import PaymentFrame from './components/PaymentFrame.jsx'
import LocationName from './components/LocationName.jsx'

/**
 * App
 * ----
 * Frame controller. Renders one of 8 frames (0..7) and handles the
 * fade-out / fade-in transition between them.
 *
 *   Frame 0  IntroFrame         (cloche reveal + welcome)
 *   Frame 1  ServiceChoice      (dine_in / takeaway / delivery)
 *   Frame 2  MainMenu           (foods / drinks tabs + category grid)
 *   Frame 3  CategoryMenu       (items in selected category)
 *   Frame 4  AllDone            (cart summary)
 *   Frame 5  ConfirmOrder       (adjust quantities + confirm)
 *   Frame 6  PaymentFrame       (options / processing / success / error)
 *   Frame 7  LocationName       (name + delivery location -> sendData)
 */

function AppInner() {
  const { serviceType } = useCart()
  const { ready } = useTelegram()

  const [currentFrame, setCurrentFrame] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false) // true while fade-out is in progress
  const animTimer = useRef(null)

  // bgProps shared with every frame
  const bgProps = {
    frame: currentFrame,
    serviceType,
  }

  // Advance to a new frame with a 300ms fade-out -> swap -> 400ms fade-in.
  const goToFrame = (next) => {
    if (next === currentFrame) return
    if (animTimer.current) {
      // fast click — skip directly
      clearTimeout(animTimer.current)
    }
    setIsAnimating(true) // triggers 'is-leaving' class -> opacity 0 (300ms)
    animTimer.current = setTimeout(() => {
      setCurrentFrame(next)
      // Allow fade-in on next paint
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(false))
      })
      animTimer.current = null
    }, 300)
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (animTimer.current) clearTimeout(animTimer.current)
    }
  }, [])

  // Render the current frame.
  const renderFrame = () => {
    switch (currentFrame) {
      case 0:
        return <IntroFrame onAdvance={() => goToFrame(1)} />
      case 1:
        return (
          <ServiceChoice
            bgProps={bgProps}
            onAdvance={() => goToFrame(2)}
          />
        )
      case 2:
        return (
          <MainMenu
            bgProps={bgProps}
            onAdvance={() => goToFrame(3)}
          />
        )
      case 3:
        return (
          <CategoryMenu
            bgProps={bgProps}
            onBack={() => goToFrame(2)}
            onNext={() => goToFrame(4)}
          />
        )
      case 4:
        return (
          <AllDone
            bgProps={bgProps}
            onAddMore={() => goToFrame(2)}
            onDone={() => goToFrame(5)}
          />
        )
      case 5:
        return (
          <ConfirmOrder
            bgProps={bgProps}
            onCancel={() => goToFrame(4)}
            onPay={() => goToFrame(6)}
          />
        )
      case 6:
        return (
          <PaymentFrame
            bgProps={bgProps}
            onSuccess={() => goToFrame(7)}
            onError={() => goToFrame(4)}
          />
        )
      case 7:
        return <LocationName bgProps={bgProps} />
      default:
        return null
    }
  }

  // While waiting for Telegram SDK to init, show a minimal placeholder so the
  // very first paint isn't a blank white screen.
  if (!ready) {
    return (
      <div className="app-shell">
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: 14,
          }}
        >
          Loading…
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* Persistent background — but each frame also renders its own SmartCafeBg
          so forceBg / blur / brightness can vary per frame. This outer one is
          just a safety net to avoid white flashes during transitions. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--bg-primary)',
          zIndex: 0,
        }}
      />

      <div
        className={`frame-host ${isAnimating ? 'is-leaving' : 'is-entering'}`}
        style={{
          transition: 'opacity 300ms ease',
        }}
      >
        {renderFrame()}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <CartProvider>
      <AppInner />
    </CartProvider>
  )
}
