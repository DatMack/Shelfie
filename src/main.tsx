import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { DailyQuestBoard } from './components/DailyQuestBoard'
import { ReaderProgressCard } from './components/ReaderProgressCard'
import './styles.css'
import './future.css'
import './readerProgress.css'
import './dailyQuests.css'
import './dragDrop.css'
import './shelfAppearance.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ReaderProgressCard />
    <DailyQuestBoard />
  </React.StrictMode>,
)
