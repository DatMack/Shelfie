import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthGate } from './components/AuthGate'
import './styles.css'
import './future.css'
import './readerProgress.css'
import './dailyQuests.css'
import './dragDrop.css'
import './shelfAppearance.css'
import './bookDetailsDisplay.css'
import './welcome.css'
import './authSession.css'
import './libraryFreedom.css'
import './shelfClippingFix.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
)
