import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/inter'
import '@fontsource-variable/source-serif-4'
import '@fontsource/caveat/600.css'
import './index.css'
import App from './App'
import { AppStoreProvider } from './store/AppStore'
import { ToastProvider } from './components/Toast'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStoreProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppStoreProvider>
    </BrowserRouter>
  </StrictMode>,
)
