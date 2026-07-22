# @isaiiai/error-trackers-react

React bindings for **Isaii Error Tracker**: provider, error boundary, support widget / page, and maintenance gate.

## Install

```bash
npm install @isaiiai/error-trackers-js-sdk @isaiiai/error-trackers-react
```

`react` is a peer dependency (`>=17`).

## Quick start

```tsx
import ErrorTracker from '@isaiiai/error-trackers-js-sdk';
import {
  ErrorTrackerProvider,
  ErrorBoundary,
  SupportWidget,
} from '@isaiiai/error-trackers-react';

const tracker = new ErrorTracker({
  projectKey: 'YOUR_PROJECT_KEY',
  secretKey: 'YOUR_SECRET_KEY',
  dsn: 'https://YOUR_API_HOST/api/v1/errors',
  environment: 'production',
});

export function App() {
  return (
    <ErrorTrackerProvider tracker={tracker}>
      <ErrorBoundary tracker={tracker}>
        <YourApp />
        <SupportWidget />
      </ErrorBoundary>
    </ErrorTrackerProvider>
  );
}
```

## Exports

| Export | Description |
|--------|-------------|
| `ErrorTrackerProvider` / `useErrorTracker` | Share the SDK instance via React context |
| `ErrorBoundary` | Catches render errors and reports them as `critical` |
| `SupportWidget` | Floating help button / ticket form |
| `SupportPage` | Full-page support experience |
| `MaintenancePage` | Blocks UI when maintenance is active |
| `LazySupportPage` / `LazyMaintenancePage` | Code-split entry points |

### Lazy subpaths

```ts
import { LazySupportPage } from '@isaiiai/error-trackers-react/support';
import { LazyMaintenancePage } from '@isaiiai/error-trackers-react/maintenance';
```

## Maintenance gate example

```tsx
import { MaintenancePage } from '@isaiiai/error-trackers-react';

<MaintenancePage tracker={tracker}>
  <App />
</MaintenancePage>
```

When the API reports an active maintenance window, users see the maintenance screen instead of your app.

## License

MIT
