import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { installPress } from './lib/motion'
import './index.css'

/* Chaque controle repond au doigt, avant meme que React ne monte: un seul
   ecouteur, pour toute l'application, voir src/lib/motion.js. */
installPress()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
