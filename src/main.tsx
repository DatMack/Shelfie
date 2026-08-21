import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ReaderProgressCard } from './components/ReaderProgressCard'
import './styles.css'
import './future.css'
import './readerProgress.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <ReaderProgressCard />
  </React.StrictMode>,
)
