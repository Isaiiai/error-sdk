import ErrorTracker from '@isaiiai/error-trackers-js-sdk'

const projectKey = import.meta.env.VITE_ERROR_PROJECT_KEY
const secretKey = import.meta.env.VITE_ERROR_SECRET_KEY
const dsn = import.meta.env.VITE_ERROR_DSN || 'http://localhost:5050/api/v1/errors'

if (!projectKey || !secretKey) {
  console.warn(
    '[ErrorTracker] Missing VITE_ERROR_PROJECT_KEY / VITE_ERROR_SECRET_KEY in .env'
  )
}

export const tracker = new ErrorTracker({
  projectKey: projectKey || 'missing',
  secretKey: secretKey || 'missing',
  dsn,
  environment: import.meta.env.VITE_ERROR_ENVIRONMENT || import.meta.env.MODE || 'development',
  version: '0.0.0',
  debug: true,
  captureScreenshot: true,
  captureUnhandledRejections: true,
})

tracker.setUser({
  id: 'demo-user',
  email: 'demo@my-react-app.local',
  username: 'demo',
})

tracker.addBreadcrumb({
  category: 'app',
  message: 'ErrorTracker initialized in my-react-app',
  level: 'info',
})

export default tracker
