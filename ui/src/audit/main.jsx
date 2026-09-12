import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AuditApp from './AuditApp.jsx'
import '../styles.css'
import './audit.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuditApp />
  </StrictMode>,
)
