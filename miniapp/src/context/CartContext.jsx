import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'

/**
 * CartContext
 * ------------
 * Holds the entire ordering state for the cafe mini app:
 *   - serviceType        'dine_in' | 'takeaway' | 'delivery'
 *   - items              [{ id, nameEn, nameAm, price, quantity }]
 *   - currentCategory    { id, nameEn, nameAm, icon } | null
 *   - customerName       string
 *   - customerLocation   { lat, lon, address }
 *   - trustLevel         number  (0..3) — unlocks payment options
 *   - successfulPayments number  — running count of successful payments
 *
 * Exposes dispatch helpers + computed totals via useCart().
 */

const CartContext = createContext(null)

// ------------------------------------------------------------------
// Initial state
// ------------------------------------------------------------------
const initialState = {
  serviceType: null,
  items: [],
  currentCategory: null,
  customerName: '',
  customerLocation: null,
  trustLevel: 0,
  successfulPayments: 0,
}

// ------------------------------------------------------------------
// Reducer
// ------------------------------------------------------------------
function cartReducer(state, action) {
  switch (action.type) {
    case 'SET_SERVICE_TYPE':
      return { ...state, serviceType: action.payload }

    case 'ADD_ITEM': {
      const item = action.payload
      const existing = state.items.find((i) => i.id === item.id)
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return {
        ...state,
        items: [...state.items, { ...item, quantity: 1 }],
      }
    }

    case 'REMOVE_ITEM': {
      const id = action.payload
      const existing = state.items.find((i) => i.id === id)
      if (!existing) return state
      if (existing.quantity <= 1) {
        return { ...state, items: state.items.filter((i) => i.id !== id) }
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.id === id ? { ...i, quantity: i.quantity - 1 } : i
        ),
      }
    }

    case 'DELETE_ITEM':
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload),
      }

    case 'SET_CATEGORY':
      return { ...state, currentCategory: action.payload }

    case 'SET_CUSTOMER_NAME':
      return { ...state, customerName: action.payload }

    case 'SET_CUSTOMER_LOCATION':
      return { ...state, customerLocation: action.payload }

    case 'CLEAR_CART':
      return {
        ...initialState,
        // Preserve trust across cart clears — it tracks the customer's history.
        trustLevel: state.trustLevel,
        successfulPayments: state.successfulPayments,
        serviceType: state.serviceType,
      }

    case 'RECORD_SUCCESSFUL_PAYMENT':
      return {
        ...state,
        successfulPayments: state.successfulPayments + 1,
        // trustLevel steps up at 1 and 2 successful payments for dine-in/takeaway,
        // and at 3 for delivery. We just track the raw count here; trust gates
        // are derived in the payment component.
        trustLevel: Math.min(3, state.trustLevel + 1),
      }

    case 'HYDRATE_TRUST':
      return {
        ...state,
        successfulPayments: action.payload.successfulPayments ?? 0,
        trustLevel: action.payload.trustLevel ?? 0,
      }

    default:
      return state
  }
}

// ------------------------------------------------------------------
// Provider
// ------------------------------------------------------------------
export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  // Persist trust + successfulPayments to localStorage so unlocks survive reloads.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cafe-trust')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (
          parsed &&
          typeof parsed.successfulPayments === 'number' &&
          typeof parsed.trustLevel === 'number'
        ) {
          dispatch({ type: 'HYDRATE_TRUST', payload: parsed })
        }
      }
    } catch (e) {
      /* localStorage may be unavailable (Telegram private mode); ignore. */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(
        'cafe-trust',
        JSON.stringify({
          successfulPayments: state.successfulPayments,
          trustLevel: state.trustLevel,
        })
      )
    } catch (e) {
      /* ignore */
    }
  }, [state.successfulPayments, state.trustLevel])

  // Computed: total price + total quantity
  const total = useMemo(
    () => state.items.reduce((s, i) => s + i.price * i.quantity, 0),
    [state.items]
  )

  const itemCount = useMemo(
    () => state.items.reduce((s, i) => s + i.quantity, 0),
    [state.items]
  )

  const value = useMemo(
    () => ({
      ...state,
      total,
      itemCount,
      dispatch,
      // convenience helpers
      setServiceType: (t) => dispatch({ type: 'SET_SERVICE_TYPE', payload: t }),
      setCategory: (c) => dispatch({ type: 'SET_CATEGORY', payload: c }),
      addItem: (item) => dispatch({ type: 'ADD_ITEM', payload: item }),
      removeItem: (id) => dispatch({ type: 'REMOVE_ITEM', payload: id }),
      deleteItem: (id) => dispatch({ type: 'DELETE_ITEM', payload: id }),
      setCustomerName: (n) => dispatch({ type: 'SET_CUSTOMER_NAME', payload: n }),
      setCustomerLocation: (loc) =>
        dispatch({ type: 'SET_CUSTOMER_LOCATION', payload: loc }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),
      recordSuccessfulPayment: () =>
        dispatch({ type: 'RECORD_SUCCESSFUL_PAYMENT' }),
    }),
    [state, total, itemCount]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// ------------------------------------------------------------------
// Hook
// ------------------------------------------------------------------
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return ctx
}
