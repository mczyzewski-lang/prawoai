import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4'
import '@fontsource/caveat/600.css'
import './index.css'
import App from './App'
import { AppStoreProvider } from './store/AppStore'
import { ToastProvider } from './components/Toast'
import WaitlistPage, { WaitlistThanksPage } from './pages/WaitlistPage'
import { APP_BASE } from './lib/base'

const path = window.location.pathname
const inApp = path === APP_BASE || path.startsWith(`${APP_BASE}/`)

// Stare adresy aplikacji (sprzed przeniesienia pod /demoav) – przekierowanie z zachowaniem ścieżki.
const APP_SEGMENTS = /^\/(d|zespol|umowy|wzory|analiza|asystent|nowa|dane|inne|terminy|windykacja|powiadomienia)(\/|$)/
if (!inApp && APP_SEGMENTS.test(path)) window.location.replace(`${APP_BASE}${path}${window.location.search}${window.location.hash}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {inApp ? (
      <BrowserRouter basename={APP_BASE}>
        <AppStoreProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppStoreProvider>
      </BrowserRouter>
    ) : (
      // Strona główna: lista oczekujących
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WaitlistPage />} />
          <Route path="/dolacz/:code" element={<WaitlistPage />} />
          <Route path="/waitlist" element={<WaitlistPage />} />
          <Route path="/waitlist/dziekujemy/:ref" element={<WaitlistThanksPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    )}
  </StrictMode>,
)
