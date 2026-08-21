import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthGate } from './components/AuthGate'
import './lib/demoDataCleanup'
import './lib/shelfHoverCard'
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
import './customization.css'
import './shelfRealism.css'
import './organizeShelf.css'
import './shelfCleanup.css'
import './shelfProfiles.css'
import './realBookCovers.css'
import './shelfHoverCard.css'
import './shelfGeometryFix.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
)
