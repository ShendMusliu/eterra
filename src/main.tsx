import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'
import App from './App.tsx'
import { amplifyReady } from './amplify-config' // Must be first

const rootEl = document.getElementById('root')!

// Ensure Amplify is configured before rendering so refreshes keep the session.
amplifyReady.finally(() => {
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>,
  )
})
