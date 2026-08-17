import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Global styles + animations + frame layout helpers
import './styles/global.css'
import './styles/animations.css'
import './styles/frames.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
