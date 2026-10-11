import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { enableLiveBrand } from './data/brand.js'

// Global styles + animations + frame layout helpers
import './styles/global.css'
import './styles/animations.css'
import './styles/frames.css'

// Live cafe identity: fetch /api/brand + subscribe to `brand:update` socket
// pushes, so an admin logo/name change reaches every corner logo instantly.
enableLiveBrand()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
