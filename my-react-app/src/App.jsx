import { useState } from 'react'
import { useErrorTracker } from '@error-tracker/react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState('')
  const tracker = useErrorTracker()

  const throwHandled = async () => {
    tracker.addBreadcrumb({
      category: 'ui',
      message: 'Clicked Throw handled error',
      level: 'info',
    })
    try {
      await fetch('https://jsonplaceholder.typicode.com/posts/1')
      await fetch('https://jsonplaceholder.typicode.com/users/1')
    } catch {
      // ignore demo network failures
    }
    try {
      throw new Error('Handled demo error from my-react-app')
    } catch (err) {
      tracker.captureException(err, {
        level: 'high',
        tags: { demo: 'handled', page: 'home' },
        context: { count },
      })
      await tracker.flush()
      setStatus('Handled error sent — check admin Errors for network activity on this event.')
    }
  }

  const throwUnhandled = () => {
    tracker.addBreadcrumb({
      category: 'ui',
      message: 'Clicked Throw unhandled error',
      level: 'warning',
    })
    setStatus('Throwing unhandled error (captured by SDK)…')
    setTimeout(() => {
      throw new Error('Unhandled demo crash from my-react-app')
    }, 50)
  }

  const analyze = () => {
    const platform = tracker.analyzeFrontend()
    setStatus(`Platform: ${platform.runtime} · ${platform.device.os} · ${platform.browser.name}`)
    console.log('[ErrorTracker] platform analysis', platform)
  }

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Error Tracker demo</h1>
          <p>
            SDK is wired. Use the buttons below, then open the admin panel Errors list.
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((c) => c + 1)}
        >
          Count is {count}
        </button>

        <div className="sdk-actions">
          <button type="button" onClick={throwHandled}>
            Send handled error
          </button>
          <button type="button" onClick={throwUnhandled}>
            Throw unhandled error
          </button>
          <button type="button" onClick={analyze}>
            Analyze platform
          </button>
        </div>

        {status ? <p className="sdk-status">{status}</p> : null}
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>What this app does</h2>
          <p>ErrorTracker captures crashes, screenshots, and platform info</p>
          <ul>
            <li>
              <a href="http://localhost:3000/analytics" target="_blank" rel="noreferrer">
                Open admin Analytics (engagement)
              </a>
            </li>
            <li>
              <a href="http://localhost:3000/maintenance" target="_blank" rel="noreferrer">
                Toggle maintenance in admin
              </a>
            </li>
            <li>
              <a href="/support">Customer support page</a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>SDK packages</h2>
          <p>Installed from local monorepo packages</p>
          <ul>
            <li>
              <span>@error-tracker/js-sdk</span>
            </li>
            <li>
              <span>@error-tracker/react</span>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
