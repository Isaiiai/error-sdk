import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import {
  ErrorTrackerProvider,
  ErrorBoundary,
  SupportWidget,
  MaintenancePage,
  SdkLoadingFallback,
} from '@isaiiai/error-trackers-react'
import './index.css'
import App from './App.jsx'
import { tracker } from './errorTracker.js'

// Support UI is a separate chunk — only fetched when /support is visited.
const SupportPage = lazy(() =>
  import('@isaiiai/error-trackers-react/support').then((m) => ({ default: m.SupportPage }))
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorTrackerProvider tracker={tracker}>
      <ErrorBoundary tracker={tracker}>
        <BrowserRouter>
          {/* Thin gate; heavy MaintenanceScreen loads only when maintenance is active */}
          <MaintenancePage logoSrc="/isaii-logo.png" brandName="Isaii AI">
            <Routes>
              <Route path="/" element={<App />} />
              <Route
                path="/support"
                element={
                  <Suspense fallback={<SdkLoadingFallback label="Loading help center…" />}>
                    <SupportPage
                      brandName="Isaii AI"
                      logoSrc="/isaii-logo.png"
                      headerAction={
                        <a href="/" style={{ fontWeight: 600, color: '#fff', textDecoration: 'none' }}>
                          ← Back to app
                        </a>
                      }
                    />
                  </Suspense>
                }
              />
            </Routes>
            <SupportWidget buttonLabel="Help / Report" pageHref="/support" />
          </MaintenancePage>
        </BrowserRouter>
      </ErrorBoundary>
    </ErrorTrackerProvider>
  </StrictMode>,
)
